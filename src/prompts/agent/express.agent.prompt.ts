export const EXPRESS_AGENT_STACK = `## Stack

Express 4 · TypeScript · MongoDB (Mongoose) · Biome · pnpm.

Verify with \`pnpm build\` (runs \`tsc\`). For a faster type-only check, \`pnpm exec tsc --noEmit\`.

## Files that must exist

- **src/index.ts** — entry point; connects the database, then listens.
- **src/app.ts** — Express app and middleware; exports the app without listening.
- **src/utils/apiResponse.ts**, **src/utils/asyncHandler.ts**, **src/utils/logger.ts**
- **src/db/db.ts** — cached connection.
- **tsconfig.json**, **biome.json**, **.gitignore**
- **.env.example** and **.env.local** — identical placeholder content.

Keeping \`app.ts\` free of \`listen\` is what makes the app testable and lets \`index.ts\` own startup order.

## Project structure

\`\`\`
src/index.ts          startup
src/app.ts            express app, middleware, route mounting
src/routes/           [feature].routes.ts
src/controllers/      [feature].controller.ts
src/models/           [name].model.ts
src/middlewares/      auth.middleware.ts
src/db/db.ts
src/utils/            apiResponse.ts, asyncHandler.ts, logger.ts
src/types/
\`\`\`

## Config

**package.json** — use these exact versions:
\`\`\`json
{
  "name": "<short kebab-case name derived from the request>",
  "version": "1.0.0",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "lint": "biome check .",
    "format": "biome format --write ."
  },
  "dependencies": {
    "express": "^4.21.2",
    "mongoose": "^8.8.4",
    "cors": "^2.8.5",
    "dotenv": "^16.4.7",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.17.10",
    "@types/cors": "^2.8.17",
    "@types/bcryptjs": "^2.4.6",
    "@types/jsonwebtoken": "^9.0.7",
    "@biomejs/biome": "^2.2.0",
    "tsx": "^4.19.2",
    "typescript": "^5.7.3"
  }
}
\`\`\`

Stay on Express 4 with \`@types/express\` 4. Express 5 changes router and error-handling behaviour and the v4 types do not match it. Add \`"zod": "^3.23.8"\` when validating request bodies, which you should. Never invent version numbers; use \`"latest"\` for anything unlisted.

**tsconfig.json**
\`\`\`json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
\`\`\`

\`esModuleInterop\` is required for \`import express from "express"\` to work with CommonJS.

**biome.json**
\`\`\`json
{
  "$schema": "https://biomejs.dev/schemas/2.2.0/schema.json",
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
  "files": { "ignoreUnknown": true, "includes": ["src/**/*"] },
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2 },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": { "noUnusedImports": "error", "noUnusedVariables": "error" }
    }
  }
}
\`\`\`

**.gitignore**
\`\`\`
node_modules/
dist/
.env
.env.local
*.log
.DS_Store
\`\`\`

## Core utilities

**src/utils/apiResponse.ts**
\`\`\`typescript
import { Response } from "express";

export function SuccessResponse<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({ success: true, data });
}

export function ErrorResponse(res: Response, message: string, status = 400) {
  return res.status(status).json({ success: false, error: message });
}
\`\`\`

**src/utils/asyncHandler.ts** — without this, a rejected promise in an async handler crashes the process instead of reaching the error middleware:
\`\`\`typescript
import { Request, Response, NextFunction, RequestHandler } from "express";

export const asyncHandler = (fn: RequestHandler): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
\`\`\`

**src/utils/logger.ts**
\`\`\`typescript
export const logger = {
  info: (context: string, message: string, meta?: unknown) => {
    console.log(\`[INFO] [\${context}] \${message}\`, meta || "");
  },
  error: (context: string, message: string, error?: unknown) => {
    console.error(\`[ERROR] [\${context}] \${message}\`, error || "");
  },
  warn: (context: string, message: string, meta?: unknown) => {
    console.warn(\`[WARN] [\${context}] \${message}\`, meta || "");
  },
};
\`\`\`

**src/db/db.ts** — the \`isConnected\` guard prevents reconnecting on every call:
\`\`\`typescript
import mongoose from "mongoose";
import { logger } from "../utils/logger";

let isConnected = false;

export async function connectToDatabase() {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) throw new Error("Please define MONGODB_URI in env variables");
  if (isConnected) return mongoose.connection;

  try {
    await mongoose.connect(MONGODB_URI, { bufferCommands: true, maxPoolSize: 10 });
    isConnected = true;
    logger.info("database", "MongoDB connected successfully");
    return mongoose.connection;
  } catch (error) {
    logger.error("database", "MongoDB connection error", error);
    throw error;
  }
}
\`\`\`

## Layer patterns

Every model, controller, and route follows these shapes.

**Model** — \`src/models/[name].model.ts\`:
\`\`\`typescript
import mongoose, { Document, Schema } from "mongoose";

export interface IModelName extends Document {
  field1: string;
  createdAt: Date;
  updatedAt: Date;
}

const modelNameSchema = new Schema<IModelName>(
  {
    field1: { type: String, required: true, unique: true, index: true },
  },
  { timestamps: true }
);

export const ModelName =
  mongoose.models.ModelName || mongoose.model<IModelName>("ModelName", modelNameSchema);
\`\`\`

The \`mongoose.models.X ||\` fallback is required — re-registering a model throws in watch mode.

**Controller** — \`src/controllers/[feature].controller.ts\`. Validate, then work, then respond. Controllers never define routes:
\`\`\`typescript
import { Request, Response } from "express";
import { z } from "zod";
import { SuccessResponse, ErrorResponse } from "../utils/apiResponse";
import { logger } from "../utils/logger";

const schema = z.object({
  title: z.string().min(1, "Title is required"),
});

export async function createItem(req: Request, res: Response) {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return ErrorResponse(res, parsed.error.errors[0].message, 400);

  try {
    return SuccessResponse(res, { result }, 201);
  } catch (error) {
    logger.error("items", "Create failed", error);
    return ErrorResponse(res, "Operation failed", 500);
  }
}
\`\`\`

**Route** — \`src/routes/[feature].routes.ts\`. Every async handler is wrapped:
\`\`\`typescript
import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { createItem } from "../controllers/items.controller";

const router = Router();

router.post("/", asyncHandler(createItem));

export default router;
\`\`\`

**src/app.ts** — mounts routes and exports; it must not call \`listen\`:
\`\`\`typescript
import express from "express";
import cors from "cors";
import itemsRouter from "./routes/items.routes";

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req, res) => {
  res.json({ success: true, message: "Server is healthy" });
});

app.use("/api/items", itemsRouter);

export default app;
\`\`\`

**src/index.ts** — database first, then listen, so the server never accepts traffic it cannot serve:
\`\`\`typescript
import dotenv from "dotenv";
import app from "./app";
import { connectToDatabase } from "./db/db";
import { logger } from "./utils/logger";

dotenv.config();

const PORT = process.env.PORT || 8000;

connectToDatabase()
  .then(() => {
    app.listen(PORT, () => logger.info("server", \`Server running on port \${PORT}\`));
  })
  .catch((error) => {
    logger.error("server", "Failed to start server", error);
    process.exit(1);
  });
\`\`\`

## Auth

**src/middlewares/auth.middleware.ts**
\`\`\`typescript
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ErrorResponse } from "../utils/apiResponse";

export interface AuthRequest extends Request {
  user?: { id: string; [key: string]: unknown };
}

export async function verifyJWT(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  if (!token) return ErrorResponse(res, "Unauthorized", 401);

  try {
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) throw new Error("JWT_SECRET not configured");
    req.user = jwt.verify(token, JWT_SECRET) as { id: string; [key: string]: unknown };
    next();
  } catch {
    return ErrorResponse(res, "Invalid token", 401);
  }
}
\`\`\`

Never write \`process.env.JWT_SECRET || "fallback"\`. A hardcoded fallback secret is a critical vulnerability that runs silently in production — let the throw be explicit. Hash passwords with bcryptjs and never return a password field in a response.

## Security and data rules

- Validate every request body with Zod before touching the database. Route parameters and query strings too.
- Never trust client input for authorisation. Read the user id from the verified token, never from the body.
- Set \`select: false\` on password fields, or strip them before responding.
- Index fields you query on, and define unique constraints in the schema rather than checking first.
- Cascade deletes in one request — delete a user and their dependent documents go too. Never leave orphans.
- Return the right status codes: 201 on create, 400 on validation failure, 401 unauthenticated, 403 unauthorised, 404 missing, 500 only for unexpected errors.

## Environment variables

Write \`.env.example\` and \`.env.local\` with identical \`your_xxx_here\` placeholders, listing every \`process.env.X\` referenced anywhere in the project. The CLI detects that pattern to prompt the user.

\`\`\`
PORT=8000
MONGODB_URI=your_mongodb_connection_string_here
JWT_SECRET=your_jwt_secret_here
NODE_ENV=development
\`\`\`

\`dotenv.config()\` must run before anything reads \`process.env\` — keep it at the top of \`index.ts\`.

## Code quality

**No \`any\`, ever.** Implicit \`any\` is a build error under \`strict\`. In catch blocks use \`err instanceof Error ? err.message : "Server error"\`. Type every controller as \`(req: Request, res: Response)\`, or \`AuthRequest\` where the user is needed.

Every route is reachable from \`app.ts\`. A controller nothing routes to, or a route nothing mounts, is dead code — delete it.

## Before you finish

Run \`pnpm build\`. It must pass.

Then verify with tools rather than memory:
- \`list_dir\` and confirm every required file above exists.
- Confirm every route file is mounted in \`app.ts\`, and every controller is reachable from a route.
- Confirm every \`process.env\` variable appears in both env files.
- Run \`pnpm lint\` and fix every unused import and variable it reports.`;
