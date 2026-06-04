import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";
import ApiError from "../utils/ApiError.js";
import logger from "../config/logger.config.js";

// Upload from buffer (memory storage) — no temp file needed
export const CloudinaryService = {
  async uploadBuffer(buffer, options = {}) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: "auto",
          folder: options.folder || "trueed",
          ...options,
        },
        (error, result) => {
          if (error) {
            logger.error("Cloudinary upload error", { error: error.message });
            reject(new ApiError(500, "File upload failed", [], "UPLOAD_FAILED"));
          } else {
            resolve(result);
          }
        }
      );

      const readable = new Readable();
      readable.push(buffer);
      readable.push(null);
      readable.pipe(uploadStream);
    });
  },

  async delete(publicIdOrUrl) {
    try {
      const publicId = publicIdOrUrl.includes("/")
        ? publicIdOrUrl.split("/").slice(-2).join("/").split(".")[0]  // preserve folder prefix
        : publicIdOrUrl;
      return await cloudinary.uploader.destroy(publicId);
    } catch (error) {
      logger.error("Cloudinary delete error", { error: error.message });
      return null; // Non-fatal
    }
  },

  extractPublicId(url) {
    if (!url) return null;
    const parts = url.split("/");
    const fileWithExt = parts[parts.length - 1];
    const file = fileWithExt.split(".")[0];
    const folder = parts[parts.length - 2];
    return `${folder}/${file}`;
  },
};