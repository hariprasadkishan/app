/**
 * idempotency.middleware.js
 *
 * Prevents duplicate side-effects (double payment capture, double token
 * purchase, double enrollment) when a client retries a request — common
 * on flaky mobile networks or a user double-tapping "Pay".
 *
 * CONTRACT: Client sends an `Idempotency-Key` header (a UUID it generates
 * once per logical action). For the configured TTL:
 *   - First request with a given key   → proceeds normally, response is cached.
 *   - Repeat request with the same key → the cached response is replayed
 *     WITHOUT re-running the handler.
 *   - A different key, or no key on a non-required route → proceeds normally.
 *
 * STORAGE: In-memory Map for single-instance MVP. THIS DOES NOT WORK
 * ACROSS MULTIPLE NODE PROCESSES/INSTANCES — once you scale horizontally
 * or deploy with a process manager running >1 worker, swap this for
 * Redis (`SET key value NX EX ttl`), which is a drop-in replacement for
 * the three methods below. REDIS_URL is already reserved in env.config.js
 * for this purpose.
 *
 * WHY REQUIRED (NOT OPTIONAL) ON PAYMENT ROUTES: For ₹19 token purchases
 * and enrollment-fee payments, silently allowing unkeyed requests through
 * means a network retry can double-charge a student. Use
 * `requireIdempotencyKey` on every route that moves money.
 */

import ApiError from '../utils/ApiError.js';
import { IDEMPOTENCY } from '../constants/enums.js';

// key -> { status: 'in_progress' | 'completed', statusCode, body, expiresAt }
const store = new Map();

function cleanup() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) store.delete(key);
  }
}
setInterval(cleanup, 10 * 60 * 1000).unref?.();

function buildScopedKey(req, rawKey) {
  // Scope by user so two different users can't collide on the same key
  const userId = req.user?._id?.toString() ?? 'anon';
  return `${userId}:${rawKey}`;
}

/**
 * requireIdempotencyKey — mandatory on all money-moving routes
 * (token purchase, enrollment payment, payout requests).
 */
export const requireIdempotencyKey = (req, res, next) => {
  const rawKey = req.headers[IDEMPOTENCY.HEADER.toLowerCase()];

  if (!rawKey || typeof rawKey !== 'string' || rawKey.length < 8 || rawKey.length > 128) {
    throw new ApiError(
      400,
      `A valid '${IDEMPOTENCY.HEADER}' header (8-128 chars) is required for this action`,
      [],
      'IDEMPOTENCY_KEY_REQUIRED',
    );
  }

  const key = buildScopedKey(req, rawKey);
  const existing = store.get(key);

  if (existing) {
    if (existing.status === 'in_progress') {
      throw new ApiError(409, 'A request with this idempotency key is already being processed', [], 'IDEMPOTENCY_IN_PROGRESS');
    }
    // Replay the cached response — handler never runs again
    return res.status(existing.statusCode).json(existing.body);
  }

  store.set(key, { status: 'in_progress', expiresAt: Date.now() + IDEMPOTENCY.TTL_MS });
  req.idempotencyKey = key;

  // Capture the response so subsequent retries get the exact same result
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode < 500) {
      store.set(key, {
        status: 'completed',
        statusCode: res.statusCode,
        body,
        expiresAt: Date.now() + IDEMPOTENCY.TTL_MS,
      });
    } else {
      // Don't cache server errors — allow the client to safely retry
      store.delete(key);
    }
    return originalJson(body);
  };

  next();
};

/**
 * optionalIdempotency — same replay behaviour, but doesn't reject the
 * request when the header is missing. Use on routes where duplication is
 * undesirable but not money-critical (e.g. creating a doubt/announcement).
 */
export const optionalIdempotency = (req, res, next) => {
  const rawKey = req.headers[IDEMPOTENCY.HEADER.toLowerCase()];
  if (!rawKey) return next();
  return requireIdempotencyKey(req, res, next);
};
