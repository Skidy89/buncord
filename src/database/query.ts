import { database } from "./database.js";
import type { DatabaseOperation } from "./worker.js";

export const query = <T>(operation: DatabaseOperation): Promise<T> =>
  database.request<T>({ type: "query", ...operation });

export const run = (sql: string, params: readonly unknown[] = []) =>
  query<unknown>({ sql, params, mode: "run" });

export const get = <T>(sql: string, params: readonly unknown[] = []) =>
  query<T | undefined>({ sql, params, mode: "get" });

export const all = <T>(sql: string, params: readonly unknown[] = []) =>
  query<T[]>({ sql, params, mode: "all" });

export const transaction = (
  operations: readonly DatabaseOperation[],
): Promise<unknown[]> =>
  database.request<unknown[]>({ type: "transaction", operations });
