/**
 * minorConsent.middleware.js
 *
 * Child-safety gate for sensitive actions (enrollment payment, generating
 * enrollment queries, posting public doubts, joining live class links).
 *
 * RULE: If req.user.isMinor === true, the action is blocked unless
 * parentalConsentVerified === true on the User document.
 *
 * WHY req.user IS TRUSTED HERE: `authenticate` selects `isMinor` and
 * `parentalConsentVerified` directly from the DB on every request — these
 * are never taken from the JWT payload, so a stale/forged token can't
 * bypass this check.
 *
 * NOTE: `authenticate` MUST run before this middleware.
 */

import ApiError from '../utils/ApiError.js';

export const requireParentalConsentIfMinor = (req, _res, next) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required', [], 'AUTH_REQUIRED');
  }

  if (req.user.isMinor && !req.user.parentalConsentVerified) {
    throw new ApiError(
      403,
      'This action requires verified parental/guardian consent.',
      [],
      'PARENTAL_CONSENT_REQUIRED',
    );
  }

  next();
};

/**
 * blockMinors — for actions that are never allowed for minors regardless
 * of consent (e.g. unmoderated public chat, certain payment flows your
 * compliance team decides to gate entirely). Use sparingly.
 */
export const blockMinors = (req, _res, next) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required', [], 'AUTH_REQUIRED');
  }

  if (req.user.isMinor) {
    throw new ApiError(403, 'This action is not available for minor accounts.', [], 'MINOR_BLOCKED');
  }

  next();
};
