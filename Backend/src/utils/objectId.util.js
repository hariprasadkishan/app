import mongoose from "mongoose";
import ApiError from "./ApiError.js";

export const validateObjectId = (id, fieldName = "ID") => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, `Invalid ${fieldName}`, [], "INVALID_OBJECT_ID");
  }
  return new mongoose.Types.ObjectId(id);
};

export const toObjectId = (id) => new mongoose.Types.ObjectId(id);

export const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
