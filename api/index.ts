import dotenv from "dotenv";
import { createServer } from "http";
import { app } from "../src/app";
import { connectToDatabase } from "../src/db/db";
import { logger } from "../src/utils/logger";

dotenv.config();

const PORT = process.env.PORT || 4000;
const server = createServer(app);

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
