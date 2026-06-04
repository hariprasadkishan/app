import logger from "../config/logger.config.js";

export const NotificationService = {
  async sendSms(phone, message) {
    logger.info("SMS stub", { phone: phone.slice(-4), message });
    // TODO: MSG91 / Fast2SMS
  },

  async sendPush(fcmTokens, { title, body, data = {} }) {
    if (!fcmTokens?.length) return;
    logger.info("Push stub", { title, tokenCount: fcmTokens.length });
    // TODO: Firebase Admin SDK
  },

  // Domain-specific notifications — thin wrappers controllers call
  async notifyBookingConfirmed(booking, student, teacher) {
    await this.sendSms(student.phone, `Your session with ${teacher.name} is confirmed for ${booking.scheduledAt}.`);
    await this.sendSms(teacher.phone, `New booking from ${student.name}: ${booking.subject} at ${booking.scheduledAt}.`);
  },

  async notifyBookingCancelled(booking, cancelledByRole, student, teacher) {
    const msg = `Your TrueEd session on ${booking.scheduledAt} was cancelled by ${cancelledByRole}.`;
    await this.sendSms(student.phone, msg);
    await this.sendSms(teacher.phone, msg);
  },

  async notifyPayoutReleased(teacher, payout) {
    await this.sendSms(teacher.phone, `₹${payout.amountPaise / 100} payout released for your session. Bank transfer in 2-3 days.`);
  },
};