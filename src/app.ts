import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { logger } from "./utils/logger";
import cliLoginRoutes from "./routes/cliLogin.routes";
import approveRoutes from "./routes/approve.routes";
import generateRoutes from "./routes/generate.routes";
import detectFrameworkRoutes from "./routes/detectFramework.routes";
import repromptRoutes from "./routes/reprompt.routes";

const app = express();

app.use(
  cors({
    origin: [
      process.env.MY_APP_URL || "http://localhost:3001",
      process.env.AUTH_SERVICE_URL || "http://localhost:3000",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    exposedHeaders: ["Set-Cookie"],
    maxAge: 86400,
  }),
);

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

app.get("/", (req, res) => {
  logger.info("health-check", "Health check endpoint hit");
  res.send("Zyra CLI Backend - Running");
});

app.use("/api/cli/login", cliLoginRoutes);
app.use("/api/cli/login/approve", approveRoutes);
app.use("/api/detect-framework", detectFrameworkRoutes);
app.use("/api/generate", generateRoutes);
app.use("/api/reprompt", repromptRoutes);

export { app };
