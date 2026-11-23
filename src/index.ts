import { fileURLToPath } from "bun";
import { BotClient } from "./core/cli.js";
import dotenv from "dotenv";
import path from "path";
import dns from "node:dns";
import { CAICli } from "./character-ai/character.js";
dns.setDefaultResultOrder("ipv4first");
const ___filename = fileURLToPath(import.meta.url);
const ___dirname = path.dirname(___filename);

dotenv.config();
if (
  !process.env.DISCORD_TOKEN ||
  !process.env.DISCORD_CLIENT_ID ||
  !process.env.DISCORD_CLIENT_SECRET ||
  !process.env.CHARACTER_AI_TOKEN ||
  !process.env.CHARACTER_AI_WEB_NEXT_AUTH
) {
  throw new Error(
    "Missing required environment variables: SECRET_TOKEN, CLIENT_ID, CLIENT_SECRET, CHARACTER_AI_TOKEN",
  );
}
CAICli.setToken(
  process.env.CHARACTER_AI_TOKEN,
  process.env.CHARACTER_AI_WEB_NEXT_AUTH,
);
const client = new BotClient(___dirname, {
  secretToken: process.env.DISCORD_TOKEN!,
  clientId: process.env.DISCORD_CLIENT_ID!,
  clientSecret: process.env.DISCORD_CLIENT_SECRET!,
});

client
  .start()
  .then(() => {
    client.logger.info("Bot started successfully");
  })
  .catch((error) => {
    client.logger.error("Error starting bot:", error);
  });
