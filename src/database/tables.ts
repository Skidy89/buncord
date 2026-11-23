export const TABLES = {
  WARNS: `
    CREATE TABLE IF NOT EXISTS warns (
        id TEXT PRIMARY KEY,
        guild_id TEXT, user_id TEXT, mod_id TEXT, reason TEXT,
        created_at INTEGER DEFAULT (unixepoch())
    )`,
  CHATBOT_CHANNELS: `
    CREATE TABLE IF NOT EXISTS chatbot_channels (
        id TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL,
        created_by TEXT,
        created_at INTEGER DEFAULT (unixepoch()),
        character_name TEXT,
        character_id TEXT,
        character_avatar_url TEXT
  )`,
};

export const ALTER_TABLES: string[] = [];

export const INDEX_TABLES = {
  WARNS: `
        CREATE INDEX IF NOT EXISTS idx_warns_guild_id ON warns(guild_id);
        CREATE INDEX IF NOT EXISTS idx_warns_user_id ON warns(user_id);
        CREATE INDEX IF NOT EXISTS idx_warns_mod_id ON warns(mod_id);
    `,
  CHATBOT_CHANNELS: `
    CREATE UNIQUE INDEX IF NOT EXISTS idx_chatbot_channels_channel_id ON chatbot_channels(channel_id);
  `,
};

export type warns = {
  id: string;
  guild_id: string;
  user_id: string;
  mod_id: string;
  reason: string;
  created_at: number;
};
export type chatbotChannels = {
  id: string;
  channel_id: string;
  created_by: string;
  created_at: number;
  character_name?: string;
  character_id?: string;
  character_avatar_url?: string;
};
export const defaultChatbotChannels = (
  guild_id: string,
): Partial<chatbotChannels> => ({
  id: guild_id,
  channel_id: "",
  created_by: "",
  character_avatar_url: "",
  character_id: "",
  character_name: "",
  created_at: Math.floor(Date.now() / 1000),
});
export const defaultWarns = (id: string): Partial<warns> => ({
  id,
  guild_id: "",
  user_id: "",
  mod_id: "",
  reason: "",
  created_at: Math.floor(Date.now() / 1000),
});
