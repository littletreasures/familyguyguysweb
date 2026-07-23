import "dotenv/config";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

const onePixelPng =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlR7n0AAAAASUVORK5CYII=";

try {
  const result = await cloudinary.uploader.upload(onePixelPng, {
    public_id: "family-guy/connection-test",
    overwrite: true,
    resource_type: "image"
  });

  console.log("Cloudinary upload succeeded.");
  console.log(result.secure_url);
} catch (error) {
  console.error("Cloudinary upload failed.");
  console.error(error.message);
  process.exitCode = 1;
}