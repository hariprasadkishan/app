// ─────────────────────────────────────────────────────────────────────────────
// src/utils/date.util.js
// Date helpers for schedule validation, expiry checks, and cron logic.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Add `days` calendar days to a Date (or now).
 */
export const addDays = (days, from = new Date()) => {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d;
};

/**
 * Add `minutes` to a Date.
 */
export const addMinutes = (minutes, from = new Date()) => {
  return new Date(from.getTime() + minutes * 60 * 1000);
};

/**
 * Return true if the given date is in the past.
 */
export const isPast = (date) => new Date() > new Date(date);

/**
 * Return true if the given date is in the future.
 */
export const isFuture = (date) => new Date() < new Date(date);

/**
 * Returns the number of full days between two dates (absolute).
 */
export const daysBetween = (dateA, dateB) => {
  const ms = Math.abs(new Date(dateA) - new Date(dateB));
  return Math.floor(ms / (1000 * 60 * 60 * 24));
};

/**
 * Returns the start of today (midnight UTC).
 */
export const startOfToday = () => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

/**
 * Returns the end of today (23:59:59.999 UTC).
 */
export const endOfToday = () => {
  const d = new Date();
  d.setUTCHours(23, 59, 59, 999);
  return d;
};

/**
 * Format a Date to ISO date string (YYYY-MM-DD).
 */
export const toISODate = (date) => new Date(date).toISOString().slice(0, 10);

/**
 * Validate that `start` is before `end`.
 */
export const isStartBeforeEnd = (start, end) =>
  new Date(start) < new Date(end);

/**
 * Get milliseconds from minutes.
 */
export const minutesToMs = (m) => m * 60 * 1000;
