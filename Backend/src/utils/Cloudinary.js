import { v2 as cloudinary } from "cloudinary";
import fs from "fs/promises";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (localFilePath) => {

    try {

        if (!localFilePath) {
            return null;
        }

        const response = await cloudinary.uploader.upload(
            localFilePath,
            {
                resource_type: "auto",
            }
        );

        await fs.unlink(localFilePath);

        return response;

    } catch (error) {

        console.log("CLOUDINARY ERROR:", error);

        try {
            await fs.unlink(localFilePath);
        } catch (unlinkError) {
            console.log("FILE DELETE ERROR:", unlinkError);
        }

        return null;
    }
};

const deleteFromCloudinary = async (imageUrl) => {
    try {
        if (!imageUrl) {
            return null;
        }

        const publicId = imageUrl.split("/").pop().split(".")[0];

        const response = await cloudinary.uploader.destroy(publicId);
        
        console.log("Old image deleted from cloudinary");
        return response;

    } catch (error) {
        console.log("CLOUDINARY DELETE ERROR:", error);
        return null;
    }
};

export { uploadOnCloudinary, deleteFromCloudinary };