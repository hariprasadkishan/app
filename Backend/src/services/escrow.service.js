// ─────────────────────────────────────────────────────────────────────────────
// src/services/escrow.service.js
// Escrow + teacher-deposit logic.  All business rule math delegates to
// finance.util.js; this file owns DB writes and notification triggers.
// ─────────────────────────────────────────────────────────────────────────────
import mongoose from "mongoose";
import ApiError from "../utils/ApiError.js";
import logger from "../config/logger.config.js";
import {
  calcCase1Split,
  calcCase2Split,
  calcCase3Split,
  calcTeacherDeposit,
} from "../utils/finance.util.js";
import { NotificationService } from "./notification.service.js";
import { PaymentService } from "./payment.service.js";
import {
  ESCROW_STATUS,
  PAYOUT_STATUS,
  COMPLETION_CASE,
  REFUND_STATUS,
  PAYMENT_STATUS,
} from "../constants/enums.js";

const getModels = async () => {
  const { Payment, Payout, RefundRequest, Enrollment, TeacherProfile } =
    await import("../models/index.js");
  return { Payment, Payout, RefundRequest, Enrollment, TeacherProfile };
};

export const EscrowService = {
  /**
   * When teacher accepts a query:
   *   - Deduct 4% deposit from teacher's pending earnings.
   *   - If insufficient, mark teacher account as needing top-up (handled by admin/flow).
   */
  async chargeTeacherDeposit(teacherId, enrollmentId, enrollmentFeePaise, session = null) {
    const { TeacherProfile, Payment } = await getModels();

    const deposit = calcTeacherDeposit(enrollmentFeePaise);

    // Try to deduct from teacher's withdrawable earnings first
    const profile = await TeacherProfile.findOneAndUpdate(
      { user: teacherId, pendingEarningsPaise: { $gte: deposit } },
      { $inc: { pendingEarningsPaise: -deposit } },
      { new: true, session }
    );

    if (!profile) {
      // Insufficient earnings — flag for manual payment
      logger.warn("Teacher has insufficient earnings for deposit", {
        teacherId,
        deposit,
        enrollmentId,
      });
      // Still create a record so admin knows about the liability
      await Payment.create(
        [{
          user:        teacherId,
          enrollment:  enrollmentId,
          amountPaise: deposit,
          purpose:     "teacher_deposit",
          status:      "created",
          note:        "Pending — teacher earnings insufficient",
        }],
        { session }
      );
      return { charged: false, depositPaise: deposit };
    }

    await Payment.create(
      [{
        user:        teacherId,
        enrollment:  enrollmentId,
        amountPaise: deposit,
        purpose:     "teacher_deposit",
        status:      "captured",
      }],
      { session }
    );

    return { charged: true, depositPaise: deposit };
  },

  /**
   * If student doesn't enroll within 5 days after acceptance:
   *   - Refund 4% deposit back to teacher earnings.
   *   - Token NOT refunded (student chose to lapse).
   */
  async refundTeacherDeposit(teacherId, enrollmentId, enrollmentFeePaise) {
    const { TeacherProfile } = await getModels();
    const deposit = calcTeacherDeposit(enrollmentFeePaise);

    await TeacherProfile.findOneAndUpdate(
      { user: teacherId },
      { $inc: { pendingEarningsPaise: deposit } }
    );

    logger.info("Teacher deposit refunded", { teacherId, deposit, enrollmentId });
    return { depositPaise: deposit };
  },

  /**
   * Case 1: Course fully completed or ≥70% early-end vote.
   * Release teacher payout and finalize platform cut.
   */
  async settleCase1(enrollment, teacher, students) {
    const { Payout } = await getModels();
    const split = calcCase1Split(enrollment.feePaidPaise);

    await this._createPayout(teacher._id, enrollment._id, split.teacherPayout, "case_1");

    await NotificationService.notifyPayoutReleased(teacher, split.teacherPayout);
    await NotificationService.notifyCourseCompleted(students, teacher, enrollment.classroom);

    logger.info("Case 1 settlement", { enrollmentId: enrollment._id, split });
    return split;
  },

  /**
   * Case 2: Teacher left before 50% of hours.
   * Full refund to student; platform keeps teacher deposit (4%).
   */
  async settleCase2(enrollment, student, razorpayPaymentId) {
    const split = calcCase2Split(enrollment.feePaidPaise);
    await PaymentService.initiateRefund(razorpayPaymentId, split.studentRefund, {
      reason: "teacher_abandoned_before_50_percent",
      enrollmentId: enrollment._id.toString(),
    });
    await NotificationService.notifyRefundInitiated(student, split.studentRefund);
    logger.info("Case 2 settlement — full refund", { enrollmentId: enrollment._id, split });
    return split;
  },

  /**
   * Case 3: Teacher left after 50% of hours.
   * Pro-rata split.
   */
  async settleCase3(enrollment, teacher, student, razorpayPaymentId, classesAfterMidpoint, extraConducted) {
    const { Payout } = await getModels();
    const split = calcCase3Split(enrollment.feePaidPaise, classesAfterMidpoint, extraConducted);

    if (split.studentRefund > 0) {
      await PaymentService.initiateRefund(razorpayPaymentId, split.studentRefund, {
        reason: "teacher_abandoned_after_50_percent",
        enrollmentId: enrollment._id.toString(),
      });
      await NotificationService.notifyRefundInitiated(student, split.studentRefund);
    }

    if (split.teacherPayout > 0) {
      await this._createPayout(teacher._id, enrollment._id, split.teacherPayout, "case_3");
      await NotificationService.notifyPayoutReleased(teacher, split.teacherPayout);
    }

    logger.info("Case 3 settlement", { enrollmentId: enrollment._id, split });
    return split;
  },

  async _createPayout(teacherId, enrollmentId, amountPaise, caseLabel) {
    const { Payout } = await getModels();
    return Payout.create([{
      teacher:     teacherId,
      enrollment:  enrollmentId,
      amountPaise,
      status:      PAYOUT_STATUS.QUEUED,
      note:        `Settlement ${caseLabel}`,
    }]);
  },
};
