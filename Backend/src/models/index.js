// ─────────────────────────────────────────────────────────────────────────────
// src/models/index.js
// Single import point for all models in the application.
// Usage: import { User, Booking, Payment } from '../models/index.js'
// ─────────────────────────────────────────────────────────────────────────────

export { User }           from './User.model.js';
export { TeacherProfile } from './TeacherProfile.model.js';
export { Document }       from './Document.model.js';
export { Booking }        from './Booking.model.js';
export { Payment }        from './Payment.model.js';
export { Payout }         from './Payout.model.js';
export { RefundRequest }  from './RefundRequest.model.js';
export { OtpSession }     from './OtpSession.model.js';