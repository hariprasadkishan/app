// ─────────────────────────────────────────────────────────────────────────────
// src/services/notification.service.js
// Domain-level notification dispatcher.
// Delegates to SmsService and (stub) push/email providers.
// ─────────────────────────────────────────────────────────────────────────────
import logger from "../config/logger.config.js";
import { SmsService } from "./sms.service.js";
import { paiseToRupees } from "../utils/finance.util.js";

const pushStub = async (fcmTokens, { title, body }) => {
  if (!fcmTokens?.length) return;
  logger.info("[PUSH STUB]", { title, tokenCount: fcmTokens.length, body });
  // TODO: Firebase Admin SDK
};

export const NotificationService = {
  // ── Primitives ──────────────────────────────────────────────────────────────
  async sendSms(phone, message) {
    return SmsService.send(phone, message);
  },

  async sendPush(fcmTokens, payload) {
    return pushStub(fcmTokens, payload);
  },

  // ── Auth ────────────────────────────────────────────────────────────────────
  async notifyTeacherApproved(teacher) {
    await this.sendSms(
      teacher.phone,
      `Congratulations! Your TrueEd teacher account has been approved. You can now create classrooms.`
    );
  },

  async notifyTeacherRejected(teacher, reason = "") {
    await this.sendSms(
      teacher.phone,
      `Your TrueEd teacher application was rejected. ${reason ? `Reason: ${reason}.` : ""} Contact support for help.`
    );
  },

  // ── Query flow ──────────────────────────────────────────────────────────────
  async notifyTeacherNewQuery(teacher, student, classroom) {
    await this.sendSms(
      teacher.phone,
      `New enrollment request from ${student.name} for your classroom "${classroom.title}". Log in to respond.`
    );
  },

  async notifyStudentQueryAccepted(student, classroom) {
    await this.sendSms(
      student.phone,
      `Your request for "${classroom.title}" was accepted! You have 5 days to enroll by paying the fees.`
    );
  },

  async notifyStudentQueryRejected(student, classroom) {
    await this.sendSms(
      student.phone,
      `Your request for "${classroom.title}" was rejected. 1 token has been refunded to your wallet.`
    );
  },

  async notifyStudentQueryExpired(student, classroom) {
    await this.sendSms(
      student.phone,
      `Your request for "${classroom.title}" expired (no response in 5 days). 1 token refunded.`
    );
  },

  // ── Enrollment ──────────────────────────────────────────────────────────────
  async notifyEnrollmentConfirmed(student, teacher, classroom) {
    await this.sendSms(
      student.phone,
      `Enrollment confirmed for "${classroom.title}"! Check your dashboard for the schedule.`
    );
    await this.sendSms(
      teacher.phone,
      `${student.name} has enrolled in your classroom "${classroom.title}".`
    );
  },

  // ── Payment ─────────────────────────────────────────────────────────────────
  async notifyPaymentSuccess(user, amountPaise, purpose) {
    await this.sendSms(
      user.phone,
      `Payment of ₹${paiseToRupees(amountPaise)} received on TrueEd for ${purpose}. Thank you!`
    );
  },

  async notifyRefundInitiated(user, amountPaise) {
    await this.sendSms(
      user.phone,
      `Refund of ₹${paiseToRupees(amountPaise)} has been initiated and will reflect in 5-7 business days.`
    );
  },

  // ── Teacher payout ──────────────────────────────────────────────────────────
  async notifyPayoutReleased(teacher, amountPaise) {
    await this.sendSms(
      teacher.phone,
      `₹${paiseToRupees(amountPaise)} payout released to your bank account. It will reflect in 2-3 business days.`
    );
  },

  // ── Classroom ───────────────────────────────────────────────────────────────
  async notifyNewMaterial(students, classroom, materialTitle) {
    const msg = `New material "${materialTitle}" posted in "${classroom.title}". Check your classroom.`;
    await Promise.allSettled(students.map((s) => this.sendSms(s.phone, msg)));
  },

  async notifyNewAnnouncement(students, classroom, excerpt) {
    const msg = `📢 Announcement in "${classroom.title}": ${excerpt}`;
    await Promise.allSettled(students.map((s) => this.sendSms(s.phone, msg)));
  },

  async notifyNewAssignment(students, classroom, assignmentTitle, dueDate) {
    const msg = `New assignment "${assignmentTitle}" in "${classroom.title}" due on ${new Date(dueDate).toLocaleDateString("en-IN")}. Submit on time!`;
    await Promise.allSettled(students.map((s) => this.sendSms(s.phone, msg)));
  },

  async notifyDoubtAnswered(student, classroom, topic) {
    await this.sendSms(
      student.phone,
      `Your doubt on "${topic}" in "${classroom.title}" has been answered. Check it now.`
    );
  },

  async notifyClassReminder(students, classroom, scheduledAt) {
    const time = new Date(scheduledAt).toLocaleString("en-IN");
    const msg  = `Reminder: Class for "${classroom.title}" starts at ${time}.`;
    await Promise.allSettled(students.map((s) => this.sendSms(s.phone, msg)));
  },

  async notifyExtraClassApproved(teacher, classroom) {
    await this.sendSms(
      teacher.phone,
      `Your extra class request for "${classroom.title}" has been approved by admin.`
    );
  },

  async notifyExtraClassRejected(teacher, classroom) {
    await this.sendSms(
      teacher.phone,
      `Your extra class request for "${classroom.title}" was rejected by admin.`
    );
  },

  async notifyEarlyEndVoteStarted(students, classroom) {
    const msg = `Vote to end "${classroom.title}" early is now open. Log in to cast your vote.`;
    await Promise.allSettled(students.map((s) => this.sendSms(s.phone, msg)));
  },

  async notifyCourseCompleted(students, teacher, classroom) {
    const msg = `"${classroom.title}" has been marked as completed. Thank you for learning!`;
    await Promise.allSettled(students.map((s) => this.sendSms(s.phone, msg)));
    await this.sendSms(teacher.phone, `Your classroom "${classroom.title}" has been marked as completed.`);
  },

  async notifyTeacherDepositCharged(teacher, amountPaise, classroom) {
    await this.sendSms(
      teacher.phone,
      `₹${paiseToRupees(amountPaise)} (4% deposit) deducted from your TrueEd wallet for accepting a student in "${classroom.title}".`
    );
  },

  async notifyTeacherDepositRefunded(teacher, amountPaise) {
    await this.sendSms(
      teacher.phone,
      `₹${paiseToRupees(amountPaise)} deposit refunded to your wallet as the student did not enroll.`
    );
  },

  async notifyAdminReport(adminPhones, reportType, reportId) {
    const msg = `New report (${reportType}) filed on TrueEd. Report ID: ${reportId}. Review in admin panel.`;
    await Promise.allSettled(adminPhones.map((p) => this.sendSms(p, msg)));
  },
};
