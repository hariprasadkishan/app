/**
 * Wraps an async Express route handler, forwarding any rejected promise
 * to next(err) so the global error handler picks it up.
 */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export default asyncHandler;
