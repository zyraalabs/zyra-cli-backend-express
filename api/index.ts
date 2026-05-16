import dotenv from "dotenv";
import { createServer } from "http";
import stoppable from "stoppable";
import mongoose from "mongoose";
import { app } from "../src/app";
import { connectToDatabase } from "../src/db/db";
import { logger } from "../src/utils/logger";

dotenv.config();

const PORT = process.env.PORT || 4000;
const server = stoppable(createServer(app), 10_000);

connectToDatabase()
  .then(() => {
    server.listen(PORT, () => {
      logger.info("server", `Server is running on port ${PORT}`);
    });
  })
  .catch((error) => {
    logger.error("server", "MongoDB connection failed", error);
    process.exit(1);
  });

async function shutdown(signal: string) {
  logger.info("server", `${signal} received — shutting down gracefully`);

  server.stop(async () => {
    try {
      await mongoose.disconnect();
      logger.info("server", "MongoDB disconnected");
      process.exit(0);
    } catch (error) {
      logger.error("server", "Error during shutdown", error);
      process.exit(1);
    }
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
