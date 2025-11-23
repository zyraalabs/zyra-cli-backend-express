import mongoose from "mongoose";
import { logger } from "../utils/logger";

let isConnected = false;

export async function connectToDatabase() {
  const MONGODB_URI = process.env.MONGODB_URI;

  if (!MONGODB_URI) {
    throw new Error("Please define MONGODB_URI in env variables");
  }

  if (isConnected) {
    return mongoose.connection;
  }

  try {
    const opts = {
      bufferCommands: true,
      maxPoolSize: 10,
    };

    await mongoose.connect(MONGODB_URI, opts);
    isConnected = true;
    logger.info("database", "MongoDB connected successfully");
    return mongoose.connection;
  } catch (error) {
    logger.error("database", "MongoDB connection error", error);
    throw error;
  }
}
