import type { LRUCache } from "lru-cache/raw";
import { get, query, run, transaction } from "./query.js";
import { placeholdersSetData, sanitizeObject } from "./utils.js";
import type { DatabaseOperation } from "./worker.js";
import { defaultWarns } from "./tables.js";

type PendingUpdate = Record<string, unknown>;

function makeUpdate(
  table: string,
  id: string,
  fields: PendingUpdate,
): DatabaseOperation | null {
  const keys = Object.keys(fields).filter((key) =>
    /^[A-Za-z_][A-Za-z0-9_]*$/.test(key),
  );
  if (!keys.length) return null;
  return {
    sql: `UPDATE ${table} SET ${keys.map((key) => `${key} = ?`).join(", ")} WHERE id = ?`,
    params: [...keys.map((key) => fields[key]), id],
    mode: "run",
  };
}

function makeUpsert(table: string, data: object): DatabaseOperation {
  const sanitized = sanitizeObject(data);
  const definition = placeholdersSetData(sanitized as Record<string, unknown>);
  if (!definition) throw new Error("No valid data provided");
  const { columns, placeholders, values, keys } = definition;
  return {
    sql: `INSERT INTO ${table} (${columns}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${keys.map((key) => `${key} = excluded.${key}`).join(", ")}`,
    params: values,
    mode: "run",
  };
}

class BaseRepository<T extends object> {
  constructor(
    protected readonly table: string,
    protected readonly cache: LRUCache<string, T>,
  ) {}

  async getById(id: string): Promise<T> {
    const cached = this.cache.get(id);
    if (cached) return cached;

    const row = await get<T>(`SELECT * FROM ${this.table} WHERE id = ?`, [id]);
    if (row) {
      this.cache.set(id, row);
      return row;
    }

    let entry: T | undefined;
    if (this.table === "warns") entry = defaultWarns(id) as T;
    if (!entry)
      throw new Error(`Could not create default row for ${this.table}`);

    await this.insertData(entry);
    this.cache.set(id, entry);
    return entry;
  }

  getByIdAsync(id: string): Promise<T> {
    return this.getById(id);
  }

  queueUpdate(id: string, fields: Partial<T>): Promise<unknown> {
    const sanitized = sanitizeObject(fields as T) as PendingUpdate;
    const current = this.cache.get(id);
    if (current) Object.assign(current, sanitized);
    const operation = makeUpdate(this.table, id, sanitized);
    return operation ? query(operation) : Promise.resolve();
  }

  async deleteById(id: string): Promise<unknown> {
    this.cache.delete(id);
    return run(`DELETE FROM ${this.table} WHERE id = ?`, [id]);
  }

  async insertData(data: T): Promise<void> {
    await query(makeUpsert(this.table, data));
    this.cache.set((data as { id: string }).id, sanitizeObject(data));
  }

  async batchInsert(dataArray: T[]): Promise<void> {
    if (dataArray.length === 0) return;
    await transaction(dataArray.map((data) => makeUpsert(this.table, data)));
    for (const data of dataArray) {
      this.cache.set((data as { id: string }).id, sanitizeObject(data));
    }
  }
  async count(): Promise<number> {
    const result = (await get(
      `SELECT COUNT(*) as count FROM ${this.table}`,
    )) as { count: number } | undefined;
    return result ? result.count : 0;
  }

  destroy(): void {
    this.cache.clear();
  }
}
