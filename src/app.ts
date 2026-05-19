import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { logger } from "./utils/logger";
import { aj } from "./lib/arcjet";
import { requestId } from "./middlewares/requestId.middleware";
import cliLoginRoutes from "./routes/cliLogin.routes";
import approveRoutes from "./routes/approve.routes";
import generateRoutes from "./routes/generate.routes";
import detectFrameworkRoutes from "./routes/detectFramework.routes";
import repromptRoutes from "./routes/reprompt.routes";

const app = express();

app.set("trust proxy", true);

app.use(
  cors({
    origin: [
      process.env.MY_APP_URL || "http://localhost:3002",
      process.env.AUTH_SERVICE_URL || "http://localhost:3001",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    exposedHeaders: ["Set-Cookie"],
    maxAge: 86400,
  }),
);

app.use(requestId);
app.use(express.json({ limit: "4mb" }));
app.use(express.urlencoded({ extended: true, limit: "4mb" }));
app.use(express.static("public"));
app.use(cookieParser());

app.use(async (req, res, next) => {
  const decision = await aj.protect(req);
  if (decision.isDenied()) {
    const reason = decision.reason.isRateLimit()
      ? "Rate limit exceeded - slow down and try again"
      : decision.reason.isBot()
        ? "Automated request blocked — use the official CLI"
        : "Request blocked by security policy";
    logger.warn("arcjet", `Blocked ${req.method} ${req.path} — ${reason}`);
    res.status(429).json({ error: reason });
    return;
  }
  next();
});

app.get("/", (_req, res) => {
  logger.info("health-check", "Health check endpoint hit");
  res.send("Zyra CLI Backend - Running");
});

app.use("/api/cli/login", cliLoginRoutes);
app.use("/api/cli/login/approve", approveRoutes);
app.use("/api/detect-framework", detectFrameworkRoutes);
app.use("/api/generate", generateRoutes);
app.use("/api/reprompt", repromptRoutes);

export { app };
