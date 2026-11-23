import { LRUCache } from "lru-cache/raw";
import { get, query, run, transaction } from "./query.js";
import { placeholdersSetData, sanitizeObject } from "./utils.js";
import type { DatabaseOperation } from "./worker.js";
import {
  defaultChatbotChannels,
  defaultWarns,
  type chatbotChannels,
} from "./tables.js";

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
    if (this.table === "chatbot_channels")
      entry = defaultChatbotChannels(id) as T;
    if (!entry)
      throw new Error(`Could not create default row for ${this.table}`);

    await this.insertData(entry);
    this.cache.set(id, entry);
    return entry;
  }
  async findById(id: string): Promise<T | undefined> {
    const cached = this.cache.get(id);
    if (cached) return cached;

    const row = await get<T>(`SELECT * FROM ${this.table} WHERE id = ?`, [id]);
    if (!row) return undefined;

    this.cache.set(id, row);
    return row;
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

export class ChatbotChannelRepository extends BaseRepository<chatbotChannels> {
  private channelIds = new Set<string>();

  constructor(cache: LRUCache<string, chatbotChannels>) {
    super("chatbot_channels", cache);
  }

  async load(): Promise<void> {
    const rows = (await query({
      sql: "SELECT id, channel_id FROM chatbot_channels",
      params: [],
      mode: "all",
    })) as Pick<chatbotChannels, "id" | "channel_id">[];

    this.channelIds = new Set(rows.map((r) => r.channel_id));
  }

  isChatbotChannel(channelId: string): boolean {
    return this.channelIds.has(channelId);
  }

  async getChannelId(guildId: string): Promise<string | undefined> {
    return (await this.findById(guildId))?.channel_id;
  }

  async register(
    guildId: string,
    channelId: string,
    userId: string,
  ): Promise<void> {
    const previous = await this.findById(guildId);

    await this.insertData({
      id: guildId,
      channel_id: channelId,
      created_by: userId,
      created_at: Math.floor(Date.now() / 1000),
    });

    if (previous) this.channelIds.delete(previous.channel_id);
    this.channelIds.add(channelId);
  }

  async unregister(guildId: string, channelId: string): Promise<void> {
    await this.deleteById(guildId);
    this.channelIds.delete(channelId);
  }
}

export const chatBot = new ChatbotChannelRepository(
  new LRUCache<string, chatbotChannels>({ max: 1000 }),
);
