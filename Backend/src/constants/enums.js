// ─────────────────────────────────────────────────────────────────────────────
// src/constants/enums.js
// ─────────────────────────────────────────────────────────────────────────────

export const ROLES = Object.freeze({
  STUDENT: "student",
  TEACHER: "teacher",
  ADMIN:   "admin",
});

export const VERIFICATION_STATUS = Object.freeze({
  PENDING:   "pending",
  APPROVED:  "approved",
  REJECTED:  "rejected",
  SUSPENDED: "suspended",
});

export const DOCUMENT_TYPE = Object.freeze({
  AADHAAR:       "aadhaar",
  PAN:           "pan",
  DEGREE:        "degree",
  CERTIFICATE:   "certificate",
  BANK_PASSBOOK: "bank_passbook",
  SELFIE:        "selfie",
});

export const DOCUMENT_STATUS = Object.freeze({
  UPLOADED:     "uploaded",
  UNDER_REVIEW: "under_review",
  APPROVED:     "approved",
  REJECTED:     "rejected",
});

export const ALLOWED_DOCUMENT_TYPES = Object.values(DOCUMENT_TYPE);

// ── Auth provider ─────────────────────────────────────────────────────────────
export const AUTH_PROVIDER = Object.freeze({
  LOCAL:  "local",   // OTP / password
  GOOGLE: "google",
});

// ── Classroom ─────────────────────────────────────────────────────────────────
export const CLASSROOM_STATUS = Object.freeze({
  DRAFT:              "draft",
  ACTIVE:             "active",
  PAUSED:             "paused",
  COMPLETION_PENDING: "completion_pending",
  COMPLETED:          "completed",
  CANCELLED:          "cancelled",
});

export const CLASSROOM_MODE = Object.freeze({
  ONLINE:  "online",
  OFFLINE: "offline",
});

// ── Enrollment Query ──────────────────────────────────────────────────────────
export const QUERY_STATUS = Object.freeze({
  PENDING:  "pending",   // waiting for teacher — auto-expires in 5 days
  ACCEPTED: "accepted",  // teacher accepted — student has 5 days to enroll
  REJECTED: "rejected",  // teacher rejected — token refunded
  EXPIRED:  "expired",   // no response in 5 days — token refunded
  ENROLLED: "enrolled",  // student paid and enrolled
  LAPSED:   "lapsed",    // accepted but student didn't enroll in 5 days — token NOT refunded
});

// ── Enrollment ────────────────────────────────────────────────────────────────
export const ENROLLMENT_STATUS = Object.freeze({
  ACTIVE:    "active",
  COMPLETED: "completed",
  DROPPED:   "dropped",
  EXPELLED:  "expelled",
});

// ── Payment ───────────────────────────────────────────────────────────────────
export const PAYMENT_STATUS = Object.freeze({
  CREATED:            "created",
  AUTHORIZED:         "authorized",
  CAPTURED:           "captured",
  FAILED:             "failed",
  REFUNDED:           "refunded",
  PARTIALLY_REFUNDED: "partially_refunded",
});

export const PAYMENT_PURPOSE = Object.freeze({
  TOKEN_PURCHASE:   "token_purchase",   // ₹19 for 3 tokens
  ENROLLMENT_FEE:   "enrollment_fee",   // classroom enrollment
  TEACHER_DEPOSIT:  "teacher_deposit",  // 4% deducted when teacher accepts query
});

export const ESCROW_STATUS = Object.freeze({
  HOLDING:        "holding",
  RELEASED:       "released",
  REFUNDED:       "refunded",
  PARTIAL_REFUND: "partial_refund",
});

// ── Payout ────────────────────────────────────────────────────────────────────
export const PAYOUT_STATUS = Object.freeze({
  QUEUED:     "queued",
  PROCESSING: "processing",
  COMPLETED:  "completed",
  FAILED:     "failed",
  ON_HOLD:    "on_hold",
});

export const PAYOUT_STAGE = Object.freeze({
  ESCROW_RELEASED:  "escrow_released",
  PAYOUT_INITIATED: "payout_initiated",
  PAYOUT_SETTLED:   "payout_settled",
});

// ── Completion Case (drives payout/refund math) ───────────────────────────────
export const COMPLETION_CASE = Object.freeze({
  CASE_1: "case_1", // fully completed or ≥70% early-end vote → teacher 89%, platform 15%
  CASE_2: "case_2", // teacher left before 50% hours → student full refund, platform keeps 4%
  CASE_3: "case_3", // teacher left after 50% hours → pro-rata split, platform 14%
});

// ── Doubt ─────────────────────────────────────────────────────────────────────
export const DOUBT_VISIBILITY = Object.freeze({
  PUBLIC:  "public",
  PRIVATE: "private",
});

export const DOUBT_STATUS = Object.freeze({
  OPEN:     "open",
  ANSWERED: "answered",
  CLOSED:   "closed",
});

// ── Material ──────────────────────────────────────────────────────────────────
export const MATERIAL_TYPE = Object.freeze({
  PDF:      "pdf",
  PPT:      "ppt",
  VIDEO:    "video",
  LINK:     "link",
  IMAGE:    "image",
  DOCUMENT: "document",
});

// ── Assignment ────────────────────────────────────────────────────────────────
export const ASSIGNMENT_STATUS = Object.freeze({
  DRAFT:     "draft",
  PUBLISHED: "published",
  CLOSED:    "closed",
});

export const SUBMISSION_STATUS = Object.freeze({
  PENDING:   "pending",
  SUBMITTED: "submitted",
  GRADED:    "graded",
  LATE:      "late",
});

// ── Poll ──────────────────────────────────────────────────────────────────────
export const POLL_TYPE = Object.freeze({
  GENERAL:   "general",
  EARLY_END: "early_end", // 70% vote to end course early
});

export const POLL_STATUS = Object.freeze({
  ACTIVE:  "active",
  CLOSED:  "closed",
  EXPIRED: "expired",
});

// ── Extra Class ───────────────────────────────────────────────────────────────
export const EXTRA_CLASS_STATUS = Object.freeze({
  PENDING:  "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
});

// ── Notification ──────────────────────────────────────────────────────────────
export const NOTIFICATION_CHANNEL = Object.freeze({
  SMS:      "sms",
  EMAIL:    "email",
  PUSH:     "push",
  WHATSAPP: "whatsapp",
});

export const NOTIFICATION_TYPE = Object.freeze({
  QUERY_RECEIVED:       "query_received",
  QUERY_ACCEPTED:       "query_accepted",
  QUERY_REJECTED:       "query_rejected",
  QUERY_EXPIRED:        "query_expired",
  ENROLLMENT_CONFIRMED: "enrollment_confirmed",
  PAYMENT_SUCCESS:      "payment_success",
  PAYMENT_FAILED:       "payment_failed",
  REFUND_INITIATED:     "refund_initiated",
  TEACHER_APPROVED:     "teacher_approved",
  TEACHER_REJECTED:     "teacher_rejected",
  CLASS_REMINDER:       "class_reminder",
  NEW_MATERIAL:         "new_material",
  NEW_ANNOUNCEMENT:     "new_announcement",
  NEW_ASSIGNMENT:       "new_assignment",
  DOUBT_ANSWERED:       "doubt_answered",
  PAYOUT_RELEASED:      "payout_released",
  EXTRA_CLASS_APPROVED: "extra_class_approved",
  EXTRA_CLASS_REJECTED: "extra_class_rejected",
  EARLY_END_VOTE:       "early_end_vote",
  COURSE_COMPLETED:     "course_completed",
  REPORT_RECEIVED:      "report_received",
});

// ── Token wallet ──────────────────────────────────────────────────────────────
export const TOKEN_TRANSACTION_TYPE = Object.freeze({
  PURCHASED: "purchased",
  USED:      "used",
  REFUNDED:  "refunded",
  BONUS:     "bonus",
});

// ── OTP ───────────────────────────────────────────────────────────────────────
export const OTP_PURPOSE = Object.freeze({
  LOGIN:        "login",
  REGISTER:     "register",
  RESET:        "reset",
  PHONE_CHANGE: "phone_change",
});

// ── Refund ────────────────────────────────────────────────────────────────────
export const REFUND_STATUS = Object.freeze({
  REQUESTED:    "requested",
  UNDER_REVIEW: "under_review",
  APPROVED:     "approved",
  REJECTED:     "rejected",
  PROCESSED:    "processed",
});

export const REFUND_REASON = Object.freeze({
  TEACHER_ABANDONED:  "teacher_abandoned",
  TEACHER_NO_SHOW:    "teacher_no_show",
  TECHNICAL_ISSUE:    "technical_issue",
  UNSATISFIED:        "unsatisfied",
  DOUBLE_CHARGE:      "double_charge",
  QUERY_AUTO_EXPIRED: "query_auto_expired",
  OTHER:              "other",
});

// ── Report ────────────────────────────────────────────────────────────────────
export const REPORT_TYPE = Object.freeze({
  SCHEDULE_VIOLATION: "schedule_violation",
  INAPPROPRIATE:      "inappropriate",
  FRAUD:              "fraud",
  QUALITY:            "quality",
  OTHER:              "other",
});

export const REPORT_STATUS = Object.freeze({
  OPEN:        "open",
  UNDER_REVIEW: "under_review",
  RESOLVED:    "resolved",
  DISMISSED:   "dismissed",
});

// ── Static domain data ────────────────────────────────────────────────────────
export const INDIAN_BOARDS = Object.freeze([
  "CBSE", "ICSE", "IB", "IGCSE", "State Board", "JEE", "NEET", "Other",
]);

export const SUBJECTS = Object.freeze([
  "Mathematics", "Physics", "Chemistry", "Biology",
  "English", "Hindi", "History", "Geography",
  "Economics", "Computer Science", "Coding",
  "Accountancy", "Business Studies",
  "Music", "Guitar", "Art", "Dance",
  "Spoken English", "Other",
]);

export const CLASS_GRADES = Object.freeze([
  "1","2","3","4","5","6","7","8","9","10","11","12",
  "UG","PG","Competitive","Beginner","Intermediate","Advanced",
]);
