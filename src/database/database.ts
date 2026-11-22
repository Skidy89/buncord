import type { DatabaseOperation } from "./worker.js";
import path from "node:path";
import { Worker } from "node:worker_threads";
import { logger } from "../utils/logger.js";

export const DATABASE_PRAGMA = {
  SYNCHRONOUS: "NORMAL",
  JOURNAL_MODE: "WAL",
  JOURNAL_SIZE_LIMIT: 6144000,
} as const;

type DatabaseRequest =
  | ({ type: "query" } & DatabaseOperation)
  | { type: "transaction"; operations: readonly DatabaseOperation[] };

type WorkerError = { name: string; message: string; stack?: string };
type WorkerMessage =
  { ready: true } | { id: number; result?: unknown; error?: WorkerError };

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timer: NodeJS.Timeout;
};

const MAX_PENDING_REQUESTS = 10_000;
const READY_TIMEOUT_MS = 10_000;
const REQUEST_TIMEOUT_MS = 10_000;

export class DatabaseDataBuilderService {
  private static instance: DatabaseDataBuilderService | undefined;
  private readonly worker: Worker;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly ready: Promise<void>;
  private readonly readyTimer: NodeJS.Timeout;
  private resolveReady!: () => void;
  private rejectReady!: (reason: unknown) => void;
  private fatal: Error | undefined;
  private nextRequestId = 0;
  private closed = false;

  private constructor() {
    this.ready = new Promise<void>((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });
    this.ready.catch(() => {});

    this.readyTimer = setTimeout(
      () =>
        this.fail(
          new Error(`Database worker not ready after ${READY_TIMEOUT_MS}ms`),
        ),
      READY_TIMEOUT_MS,
    );
    this.readyTimer.unref();

    this.worker = new Worker(new URL("./database-worker.js", import.meta.url), {
      workerData: {
        path: path.join(
          path.dirname(process.execPath),
          "database",
          "buncord.db",
        ),
        pragma: DATABASE_PRAGMA,
      },
    });
    this.worker.unref();

    this.worker.on("online", () => logger.info("[db] worker online"));
    this.worker.on("message", (message: WorkerMessage) =>
      this.onMessage(message),
    );
    this.worker.on("error", (error) => this.fail(error as Error));
    this.worker.on("messageerror", (error) =>
      logger.error("[db] worker messageerror:", error),
    );
    this.worker.on("exit", (code) => {
      if (!this.closed) {
        this.fail(
          new Error(`Database worker exited unexpectedly (code ${code})`),
        );
      }
    });
  }

  static getInstance(): DatabaseDataBuilderService {
    if (!this.instance) this.instance = new DatabaseDataBuilderService();
    return this.instance;
  }

  private onMessage(message: WorkerMessage): void {
    if ("ready" in message) {
      clearTimeout(this.readyTimer);
      this.resolveReady();
      logger.info("[db] worker ready");
      return;
    }

    const request = this.pending.get(message.id);
    if (!request) {
      logger.warn(
        `[db] response for unknown request ${message.id} (already timed out?)`,
      );
      return;
    }
    this.pending.delete(message.id);
    clearTimeout(request.timer);

    if (message.error) {
      const error = new Error(message.error.message);
      error.name = message.error.name;
      if (message.error.stack) error.stack = message.error.stack;
      request.reject(error);
    } else {
      request.resolve(message.result);
    }
  }

  private fail(error: Error): void {
    if (this.fatal) return;
    this.fatal = error;
    logger.error("[db] worker failed:", error);
    clearTimeout(this.readyTimer);
    this.rejectReady(error);
    this.rejectPending(error);
  }

  request<T>(request: DatabaseRequest): Promise<T> {
    return this.sendRequest<T>(request);
  }

  private async sendRequest<T>(request: DatabaseRequest): Promise<T> {
    if (this.closed) throw new Error("Database is closed");
    if (this.fatal) throw this.fatal;
    await this.ready;
    if (this.closed) throw new Error("Database is closed");
    if (this.pending.size >= MAX_PENDING_REQUESTS) {
      throw new Error("Too many pending database requests");
    }

    const id = ++this.nextRequestId;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new Error(
            `Database request ${id} timed out after ${REQUEST_TIMEOUT_MS}ms`,
          ),
        );
      }, REQUEST_TIMEOUT_MS);

      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timer,
      });
      try {
        this.worker.postMessage({ id, ...request });
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  private rejectPending(error: unknown): void {
    for (const request of this.pending.values()) {
      clearTimeout(request.timer);
      request.reject(error);
    }
    this.pending.clear();
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    clearTimeout(this.readyTimer);
    const error = new Error("Database is closed");
    this.rejectReady(error);
    this.rejectPending(error);
    void this.worker.terminate();
  }

  static destroy() {
    if (this.instance) {
      this.instance.close();
      this.instance = undefined;
    }
  }
}

export const database = DatabaseDataBuilderService.getInstance();
