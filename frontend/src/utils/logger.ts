export enum LogLevel {
  ERROR = "error",
  WARN = "warn",
  INFO = "info",
  DEBUG = "debug",
}

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: number;
  userAgent?: string;
  url?: string;
}

class Logger {
  private static isDevelopment = process.env.NODE_ENV === "development";
  private static logs: LogEntry[] = [];
  private static maxLogs = 100; // Keep only recent logs in memory

  private static shouldLog(level: LogLevel): boolean {
    if (this.isDevelopment) {
      return true; // Log everything in development
    }

    // In production, only log warnings and errors
    return level === LogLevel.ERROR || level === LogLevel.WARN;
  }

  private static createLogEntry(
    level: LogLevel,
    message: string,
    data?: any
  ): LogEntry {
    return {
      level,
      message,
      data,
      timestamp: Date.now(),
      userAgent:
        typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      url: typeof window !== "undefined" ? window.location.href : undefined,
    };
  }

  private static storeLog(entry: LogEntry): void {
    this.logs.push(entry);

    // Keep only recent logs to prevent memory leaks
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  static error(message: string, data?: any): void {
    const entry = this.createLogEntry(LogLevel.ERROR, message, data);

    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(`[Wordle Error] ${message}`, data);
    }

    this.storeLog(entry);

    // In production, consider sending critical errors to monitoring service
    if (!this.isDevelopment && this.shouldReportError(entry)) {
      this.reportError(entry);
    }
  }

  static warn(message: string, data?: any): void {
    const entry = this.createLogEntry(LogLevel.WARN, message, data);

    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(`[Wordle Warning] ${message}`, data);
    }

    this.storeLog(entry);
  }

  static info(message: string, data?: any): void {
    const entry = this.createLogEntry(LogLevel.INFO, message, data);

    if (this.shouldLog(LogLevel.INFO)) {
      console.info(`[Wordle Info] ${message}`, data);
    }

    this.storeLog(entry);
  }

  static debug(message: string, data?: any): void {
    const entry = this.createLogEntry(LogLevel.DEBUG, message, data);

    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(`[Wordle Debug] ${message}`, data);
    }

    this.storeLog(entry);
  }

  // Get logs for debugging (development only)
  static getLogs(): LogEntry[] {
    return this.isDevelopment ? [...this.logs] : [];
  }

  // Clear logs
  static clearLogs(): void {
    this.logs = [];
  }

  private static shouldReportError(entry: LogEntry): boolean {
    // Only report critical application errors, not user errors
    return (
      entry.message.includes("Network") ||
      entry.message.includes("Service") ||
      entry.message.includes("Auth")
    );
  }

  private static async reportError(_entry: LogEntry): Promise<void> {
    try {
      // In a real application, send to error monitoring service
      // await errorReportingService.report(entry);
      console.log("Error reporting would happen here");
    } catch {
      // Silently fail - don't let error reporting break the app
    }
  }
}

export const logger = Logger;
