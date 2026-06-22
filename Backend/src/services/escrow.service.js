// ─────────────────────────────────────────────────────────────────────────────
// src/services/escrow.service.js
// Pure internal virtual wallet settlement bypassing Razorpay loop.
// ─────────────────────────────────────────────────────────────────────────────
import { TeacherProfile, StudentWallet, Payment, Payout } from "../models/index.js";
import logger from "../config/logger.config.js";
import { calcCase1Split, calcCase2Split, calcCase3Split, calcTeacherDeposit } from "../utils/finance.util.js";
import { NotificationService } from "./notification.service.js";
import { PAYOUT_STATUS } from "../constants/enums.js";

export const EscrowService = {
  async chargeTeacherDeposit(teacherId, enrollmentId, enrollmentFeePaise, session = null) {
    const deposit = calcTeacherDeposit(enrollmentFeePaise);

    const profile = await TeacherProfile.findOneAndUpdate(
      { userId: teacherId, walletPaise: { $gte: deposit } },
      { $inc: { walletPaise: -deposit } },
      { new: true, session }
    );

    if (!profile) {
      logger.warn("Teacher insufficient internal virtual balance for deposit", { teacherId, deposit });
      await Payment.create([{
        payerId: teacherId,
        enrollmentId,
        totalAmountPaise: deposit,
        purpose: "teacher_deposit",
        status: "created",
      }], { session });
      return { charged: false, depositPaise: deposit };
    }

    await Payment.create([{
      payerId: teacherId,
      enrollmentId,
      totalAmountPaise: deposit,
      purpose: "teacher_deposit",
      status: "captured",
    }], { session });

    return { charged: true, depositPaise: deposit };
  },

  async settleCase1(enrollment, teacherUser, studentUsers) {
    const split = calcCase1Split(enrollment.feesPaidPaise);

    await TeacherProfile.findOneAndUpdate(
      { userId: teacherUser._id },
      { $inc: { walletPaise: split.teacherPayout } }
    );

    await Payout.create({
      teacherId: teacherUser._id,
      classroomId: enrollment.classroomId,
      grossFeesCollectedPaise: enrollment.feesPaidPaise,
      teacherPayoutPaise: split.teacherPayout,
      status: PAYOUT_STATUS.COMPLETED,
    });

    await NotificationService.notifyPayoutReleased(teacherUser, split.teacherPayout);
    return split;
  },

  async settleCase2(enrollment, studentUser) {
    const split = calcCase2Split(enrollment.feesPaidPaise);

    await StudentWallet.findOneAndUpdate(
      { studentId: studentUser._id },
      { $inc: { cashBalancePaise: split.studentRefund } }
    );

    await NotificationService.notifyRefundInitiated(studentUser, split.studentRefund);
    return split;
  },

  async settleCase3(enrollment, teacherUser, studentUser, classesAfterMidpoint, extraConducted) {
    const split = calcCase3Split(enrollment.feesPaidPaise, classesAfterMidpoint, extraConducted);

    if (split.studentRefund > 0) {
      await StudentWallet.findOneAndUpdate(
        { studentId: studentUser._id },
        { $inc: { cashBalancePaise: split.studentRefund } }
      );
      await NotificationService.notifyRefundInitiated(studentUser, split.studentRefund);
    }

    if (split.teacherPayout > 0) {
      await TeacherProfile.findOneAndUpdate(
        { userId: teacherUser._id },
        { $inc: { walletPaise: split.teacherPayout } }
      );
      await NotificationService.notifyPayoutReleased(teacherUser, split.teacherPayout);
    }

    return split;
  }
};