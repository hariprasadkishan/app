// middlewares/notFound.middleware.js
import ApiError from "../utils/ApiError.js";

export const notFound = (req, _res, next) => {
  next(new ApiError(404, `Route ${req.method} ${req.originalUrl} not found`, [], "ROUTE_NOT_FOUND"));
};