import "dotenv/config";
import { v2 as cloudinary } from "cloudinary";

const requiredEnv = [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET"
];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing ${key} in .env`);
  }
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

try {
  const result = await cloudinary.api.ping();

  console.log("Cloudinary authentication succeeded.");
  console.log({
    status: result.status,
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME
  });
} catch (error) {
  console.error("Cloudinary authentication failed.");
  console.error(error.message);
  process.exitCode = 1;
}