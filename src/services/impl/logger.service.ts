import type { LoggerService } from "../logger.service.ts";

type LogLevel = "info" | "error" | "warn" | "debug";

export class LoggerServiceImpl implements LoggerService {
  readonly #loggerName: string;
  readonly #level: LogLevel;

  constructor(loggerName?: string) {
    this.#loggerName = loggerName ?? "main";
    this.#level = (process.env.LOG_LEVEL as LogLevel) ?? "info";
  }

  info(message: string, ...args: unknown[]): void {
    if (!["info", "error", "warn", "debug"].includes(this.#level)) return;
    console.info(
      `${new Date().toISOString()}:INFO:${this.#loggerName}:${message}`,
      ...args
    );
  }

  error(message: string, ...args: unknown[]): void {
    if (!["info", "error", "warn", "debug"].includes(this.#level)) return;
    console.error(
      `${new Date().toISOString()}:ERROR:${this.#loggerName}:${message}`,
      ...args
    );
  }

  warn(message: string, ...args: unknown[]): void {
    if (!["info", "warn", "debug"].includes(this.#level)) return;
    console.warn(
      `${new Date().toISOString()}:WARN:${this.#loggerName}:${message}`,
      ...args
    );
  }

  debug(message: string, ...args: unknown[]): void {
    if (!["debug"].includes(this.#level)) return;
    console.debug(
      `${new Date().toISOString()}:DEBUG:${this.#loggerName}:${message}`,
      ...args
    );
  }
}
