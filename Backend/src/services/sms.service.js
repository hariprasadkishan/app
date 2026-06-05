// src/services/sms.service.js
//
// Pluggable SMS service. Provider is selected via SMS_PROVIDER env var.
// Supported: msg91 | fast2sms | twilio | mock
//
// The NotificationService delegates to this instead of calling the gateway
// directly, keeping gateway churn isolated to this file.

import env from '../config/env.config.js';
import logger from '../config/logger.config.js';

// ── Provider implementations ──────────────────────────────────────────────────

const providers = {

  // ── MSG91 ─────────────────────────────────────────────────────────────────
  async msg91(phone, message) {
    if (!env.MSG91_API_KEY || !env.MSG91_TEMPLATE_ID) {
      throw new Error('MSG91 credentials not configured');
    }

    const normalised = phone.startsWith('+') ? phone.slice(1) : phone;

    const response = await fetch(
      `https://api.msg91.com/api/v5/otp?template_id=${env.MSG91_TEMPLATE_ID}&mobile=${normalised}`,
      {
        method:  'POST',
        headers: {
          authkey:        env.MSG91_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`MSG91 error ${response.status}: ${body}`);
    }

    return response.json();
  },

  // ── Fast2SMS ──────────────────────────────────────────────────────────────
  async fast2sms(phone, message) {
    const FAST2SMS_API_KEY = process.env.FAST2SMS_API_KEY;
    if (!FAST2SMS_API_KEY) {
      throw new Error('FAST2SMS_API_KEY not configured');
    }

    // Strip country code for Fast2SMS (accepts 10-digit numbers)
    const mobile = phone.replace(/^\+?91/, '');

    const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method:  'POST',
      headers: {
        authorization: FAST2SMS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        route:   'q',
        message,
        numbers: mobile,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Fast2SMS error ${response.status}: ${body}`);
    }

    return response.json();
  },

  // ── Twilio ────────────────────────────────────────────────────────────────
  async twilio(phone, message) {
    const TWILIO_SID   = process.env.TWILIO_ACCOUNT_SID;
    const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
    const TWILIO_FROM  = process.env.TWILIO_PHONE_NUMBER;

    if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) {
      throw new Error('Twilio credentials not configured');
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;
    const credentials = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64');

    const body = new URLSearchParams({
      From: TWILIO_FROM,
      To:   phone,
      Body: message,
    });

    const response = await fetch(url, {
      method:  'POST',
      headers: {
        Authorization:  `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(`Twilio error ${data.status}: ${data.message}`);
    }

    return response.json();
  },

  // ── Mock (development / test) ─────────────────────────────────────────────
  async mock(phone, message) {
    logger.debug('[SMS MOCK]', {
      phone:   phone.slice(-4).padStart(phone.length, '*'),
      message,
    });
    return { success: true, mock: true };
  },
};

// ── Public service ────────────────────────────────────────────────────────────

export const SmsService = {
  /**
   * Send an SMS via the configured provider.
   * Never throws in production — logs the failure and returns gracefully.
   */
  async send(phone, message) {
    const provider = env.SMS_PROVIDER || 'mock';
    const handler  = providers[provider];

    if (!handler) {
      logger.error('Unknown SMS provider', { provider });
      return null;
    }

    try {
      const result = await handler(phone, message);
      logger.info('SMS sent', { provider, phone: phone.slice(-4) });
      return result;
    } catch (err) {
      logger.error('SMS delivery failed', {
        provider,
        phone:   phone.slice(-4),
        message: err.message,
      });
      return null;  // Non-fatal — callers use .catch(() => {})
    }
  },

  /**
   * Send OTP SMS with standardised format.
   */
  async sendOtp(phone, otp, expiryMinutes = 10) {
    const message = `Your TrueEd OTP is ${otp}. Valid for ${expiryMinutes} minutes. Do not share this with anyone.`;
    return this.send(phone, message);
  },
};