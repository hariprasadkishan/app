// ─────────────────────────────────────────────────────────────────────────────
// src/constants/enums.js
// Central registry for every enum used across models.
// Update here, reflected everywhere – zero drift.
// ─────────────────────────────────────────────────────────────────────────────

export const ROLES = Object.freeze({
  STUDENT: 'student',
  TEACHER: 'teacher',
  ADMIN:   'admin',
});

export const VERIFICATION_STATUS = Object.freeze({
  PENDING:  'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  SUSPENDED:'suspended',
});

export const DOCUMENT_TYPE = Object.freeze({
  AADHAAR:      'aadhaar',
  PAN:          'pan',
  DEGREE:       'degree',
  CERTIFICATE:  'certificate',
  BANK_PASSBOOK:'bank_passbook',
  SELFIE:       'selfie',
});

export const DOCUMENT_STATUS = Object.freeze({
  UPLOADED: 'uploaded',
  UNDER_REVIEW: 'under_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
});

export const BOOKING_STATUS = Object.freeze({
  PENDING:    'pending',      // created, awaiting payment
  CONFIRMED:  'confirmed',    // payment captured, escrow held
  IN_PROGRESS:'in_progress',  // session started
  COMPLETED:  'completed',    // session ended, escrow release eligible
  CANCELLED:  'cancelled',    // cancelled before session
  DISPUTED:   'disputed',     // under admin review
  REFUNDED:   'refunded',     // full refund issued
});

export const PAYMENT_STATUS = Object.freeze({
  CREATED:    'created',      // Razorpay order created
  AUTHORIZED: 'authorized',   // payment authorized
  CAPTURED:   'captured',     // funds captured in escrow
  FAILED:     'failed',
  REFUNDED:   'refunded',
  PARTIALLY_REFUNDED: 'partially_refunded',
});

export const ESCROW_STATUS = Object.freeze({
  HOLDING:  'holding',        // funds in escrow
  RELEASED: 'released',       // released to teacher payout queue
  REFUNDED: 'refunded',       // returned to student
  PARTIAL_REFUND: 'partial_refund',
});

export const PAYOUT_STATUS = Object.freeze({
  QUEUED:     'queued',
  PROCESSING: 'processing',
  COMPLETED:  'completed',
  FAILED:     'failed',
  ON_HOLD:    'on_hold',
});

export const PAYOUT_STAGE = Object.freeze({
  ESCROW_RELEASED: 'escrow_released',
  PAYOUT_INITIATED:'payout_initiated',
  PAYOUT_SETTLED:  'payout_settled',
});

export const REFUND_STATUS = Object.freeze({
  REQUESTED: 'requested',
  UNDER_REVIEW: 'under_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  PROCESSED: 'processed',
});

export const REFUND_REASON = Object.freeze({
  TEACHER_NO_SHOW:   'teacher_no_show',
  TECHNICAL_ISSUE:   'technical_issue',
  UNSATISFIED:       'unsatisfied',
  DOUBLE_CHARGE:     'double_charge',
  OTHER:             'other',
});

export const SLOT_DURATION_MINUTES = Object.freeze([30, 60, 90, 120]);

export const INDIAN_BOARDS = Object.freeze([
  'CBSE', 'ICSE', 'IB', 'IGCSE', 'State Board', 'Other',
]);

export const SUBJECTS = Object.freeze([
  'Mathematics', 'Physics', 'Chemistry', 'Biology',
  'English', 'Hindi', 'History', 'Geography',
  'Economics', 'Computer Science', 'Coding',
  'Accountancy', 'Business Studies', 'Other',
]);

export const CLASS_GRADES = Object.freeze([
  '1','2','3','4','5','6','7','8','9','10','11','12',
  'UG','PG','Competitive',
]);

export const NOTIFICATION_CHANNEL = Object.freeze({
  SMS: 'sms', EMAIL: 'email', PUSH: 'push', WHATSAPP: 'whatsapp',
});