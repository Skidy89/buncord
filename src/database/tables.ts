export const TABLES = {
  WARNS: `
    CREATE TABLE IF NOT EXISTS warns (
        id TEXT PRIMARY KEY,
        guild_id TEXT, user_id TEXT, mod_id TEXT, reason TEXT,
        created_at INTEGER DEFAULT (unixepoch())
    )`,
};

export const ALTER_TABLES: string[] = [];

export const INDEX_TABLES = {
  WARNS: `
        CREATE INDEX IF NOT EXISTS idx_warns_guild_id ON warns(guild_id);
        CREATE INDEX IF NOT EXISTS idx_warns_user_id ON warns(user_id);
        CREATE INDEX IF NOT EXISTS idx_warns_mod_id ON warns(mod_id);
    `,
};

type warns = {
  id: string;
  guild_id: string;
  user_id: string;
  mod_id: string;
  reason: string;
  created_at: number;
};
export const defaultWarns = (id: string): Partial<warns> => ({
  id,
  guild_id: "",
  user_id: "",
  mod_id: "",
  reason: "",
  created_at: Math.floor(Date.now() / 1000),
});
