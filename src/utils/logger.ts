type LogLevel = "info" | "error" | "warn";

class Logger {
  private formatMessage(
    fnName: string,
    message: string,
    level: LogLevel
  ): string {
    const timestamp = new Date().toISOString();
    const levelStr = level.toUpperCase().padEnd(5);
    return `${timestamp} [${levelStr}] [${fnName}] ${message}`;
  }

  info(fnName: string, message: string): void {
    console.log(this.formatMessage(fnName, message, "info"));
  }

  error(fnName: string, message: string, error?: any): void {
    const errorMsg = error ? `${message} - ${error.message || error}` : message;
    console.error(this.formatMessage(fnName, errorMsg, "error"));
  }

  warn(fnName: string, message: string): void {
    console.warn(this.formatMessage(fnName, message, "warn"));
  }
}

export const logger = new Logger();
