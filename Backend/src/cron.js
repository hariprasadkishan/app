// src/cron.js
// Background automation workers — runs inside the main Node process.
// All jobs bypass the API routing layer completely and operate directly
// on Mongoose models inside managed sessions.
import cron       from 'node-cron';
import mongoose   from 'mongoose';
import { EnrollmentQuery, TeacherProfile, Classroom, Enrollment, Poll } from './models/index.js';
import { WalletService }     from './services/wallet.service.js';
import { NotificationService } from './services/notification.service.js';
import { ClassroomService }  from './services/classroom.service.js';
import { EscrowService }     from './services/escrow.service.js';
import { QUERY_STATUS, CLASSROOM_STATUS, POLL_STATUS, ENROLLMENT_STATUS } from './constants/enums.js';
import logger                from './config/logger.config.js';

// ─────────────────────────────────────────────────────────────────────────────
// JOB 1: Query Expiry — Every 1 hour
// Expire pending queries where teacher hasn't responded in 5 days.
// Refund 1 token to the student for each expired query.
// ─────────────────────────────────────────────────────────────────────────────
async function runQueryExpiryJob() {
  logger.info('[CRON] Query expiry job started');
  const overdueQueries = await EnrollmentQuery.overdueForTeacher();
  if (!overdueQueries.length) return;

  logger.info(`[CRON] Found ${overdueQueries.length} overdue queries to expire`);

  for (const q of overdueQueries) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await EnrollmentQuery.findByIdAndUpdate(q._id, { status: QUERY_STATUS.EXPIRED }, { session });
      await WalletService.refundToken(
        q.studentId,
        q._id,
        'Token refunded: enrollment request auto-expired after 5 days without teacher response',
        session,
      );
      await session.commitTransaction();

      // Non-blocking student notification
      const { User } = await import('./models/index.js');
      Promise.all([
        User.findById(q.studentId).select('phone'),
        Classroom.findById(q.classroomId).select('title'),
      ]).then(([student, classroom]) => {
        if (student && classroom) {
          NotificationService.notifyStudentQueryExpired(student, classroom).catch(() => {});
        }
      });

      logger.info('[CRON] Query expired and token refunded', { queryId: q._id, studentId: q.studentId });
    } catch (err) {
      await session.abortTransaction();
      logger.error('[CRON] Failed to expire query', { queryId: q._id, error: err.message });
    } finally {
      session.endSession();
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// JOB 2: Accepted Query Lapsing — Every 1 hour
// Lapse accepted queries where student hasn't enrolled within 5 days.
// Refund the teacher's 4% deposit back to their wallet.
// ─────────────────────────────────────────────────────────────────────────────
async function runAcceptedQueryLapseJob() {
  logger.info('[CRON] Accepted query lapse job started');
  const overdueAccepted = await EnrollmentQuery.overdueForStudent();
  if (!overdueAccepted.length) return;

  logger.info(`[CRON] Found ${overdueAccepted.length} accepted queries to lapse`);

  for (const q of overdueAccepted) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await EnrollmentQuery.findByIdAndUpdate(q._id, { status: QUERY_STATUS.LAPSED }, { session });

      // Refund teacher's 4% deposit back to their internal wallet
      if (q.teacherDepositPaise && q.teacherDepositPaid) {
        await TeacherProfile.findOneAndUpdate(
          { userId: q.teacherId },
          { $inc: { walletPaise: q.teacherDepositPaise } },
          { session },
        );
        logger.info('[CRON] Teacher deposit refunded on query lapse', {
          queryId:   q._id,
          teacherId: q.teacherId,
          amountPaise: q.teacherDepositPaise,
        });

        // Non-blocking notification
        const { User } = await import('./models/index.js');
        User.findById(q.teacherId).select('phone').then((teacher) => {
          if (teacher) {
            NotificationService.notifyTeacherDepositRefunded(teacher, q.teacherDepositPaise).catch(() => {});
          }
        });
      }

      await session.commitTransaction();
      logger.info('[CRON] Query lapsed', { queryId: q._id });
    } catch (err) {
      await session.abortTransaction();
      logger.error('[CRON] Failed to lapse query', { queryId: q._id, error: err.message });
    } finally {
      session.endSession();
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// JOB 3: Poll Expiry — Every 1 hour
// Expire active polls that have passed their expiresAt time.
// If an early-end poll expires without reaching 70% YES votes, revert
// the classroom status back to active.
// ─────────────────────────────────────────────────────────────────────────────
async function runPollExpiryJob() {
  const expiredPolls = await Poll.find({
    status:    POLL_STATUS.ACTIVE,
    expiresAt: { $lt: new Date() },
  }).lean();

  if (!expiredPolls.length) return;
  logger.info(`[CRON] Expiring ${expiredPolls.length} polls`);

  for (const poll of expiredPolls) {
    try {
      await Poll.findByIdAndUpdate(poll._id, { status: POLL_STATUS.EXPIRED });

      // If early-end poll expired without enough votes → revert classroom to active
      if (poll.type === 'early_end') {
        const classroom = await Classroom.findOne({ earlyEndPollId: poll._id, status: CLASSROOM_STATUS.COMPLETION_PENDING });
        if (classroom) {
          await Classroom.findByIdAndUpdate(classroom._id, {
            status:             CLASSROOM_STATUS.ACTIVE,
            earlyEndRequestedAt: null,
            earlyEndPollId:     null,
          });
          logger.info('[CRON] Early-end poll expired without approval, classroom reverted to active', { classroomId: classroom._id });
        }
      }
    } catch (err) {
      logger.error('[CRON] Poll expiry error', { pollId: poll._id, error: err.message });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// JOB 4: Classroom Overdue Closure — Every 6 hours
// Auto-complete classrooms that have passed their endDate without being closed.
// ─────────────────────────────────────────────────────────────────────────────
async function runClassroomOverdueJob() {
  const overdueClassrooms = await Classroom.overdueActive();
  if (!overdueClassrooms.length) return;

  logger.info(`[CRON] Found ${overdueClassrooms.length} overdue classrooms`);

  for (const classroom of overdueClassrooms) {
    try {
      await Classroom.findByIdAndUpdate(classroom._id, {
        status:         CLASSROOM_STATUS.COMPLETED,
        completedAt:    new Date(),
        completionCase: 'case_1',
      });
      logger.info('[CRON] Classroom auto-completed (endDate passed)', { classroomId: classroom._id });
    } catch (err) {
      logger.error('[CRON] Classroom overdue closure error', { classroomId: classroom._id, error: err.message });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTER ALL JOBS
// ─────────────────────────────────────────────────────────────────────────────
export function initCronJobs() {
  // Every hour at minute 0
  cron.schedule('0 * * * *', async () => {
    try { await runQueryExpiryJob(); }
    catch (err) { logger.error('[CRON] runQueryExpiryJob fatal', { error: err.message }); }
  });

  cron.schedule('30 * * * *', async () => {
    try { await runAcceptedQueryLapseJob(); }
    catch (err) { logger.error('[CRON] runAcceptedQueryLapseJob fatal', { error: err.message }); }
  });

  cron.schedule('15 * * * *', async () => {
    try { await runPollExpiryJob(); }
    catch (err) { logger.error('[CRON] runPollExpiryJob fatal', { error: err.message }); }
  });

  // Every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    try { await runClassroomOverdueJob(); }
    catch (err) { logger.error('[CRON] runClassroomOverdueJob fatal', { error: err.message }); }
  });

  logger.info('✅ Cron jobs initialized: query expiry, query lapse, poll expiry, classroom overdue');
}