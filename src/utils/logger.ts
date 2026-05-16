import { AsyncLocalStorage } from "async_hooks";

type LogLevel = "info" | "error" | "warn";

export const requestContext = new AsyncLocalStorage<{ requestId: string }>();

class Logger {
  private format(fnName: string, message: string, level: LogLevel): string {
    const timestamp = new Date().toISOString();
    const levelStr = level.toUpperCase().padEnd(5);
    const reqId = requestContext.getStore()?.requestId ?? "-";
    return `${timestamp} [${levelStr}] [${reqId}] [${fnName}] ${message}`;
  }

  info(fnName: string, message: string): void {
    console.log(this.format(fnName, message, "info"));
  }

  error(fnName: string, message: string, error?: unknown): void {
    const detail = error instanceof Error ? error.message : String(error ?? "");
    console.error(this.format(fnName, detail ? `${message} - ${detail}` : message, "error"));
  }

  warn(fnName: string, message: string): void {
    console.warn(this.format(fnName, message, "warn"));
  }
}

export const logger = new Logger();
