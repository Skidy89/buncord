import { fileURLToPath } from "bun";
import { BotClient } from "./core/cli.js";
import dotenv from "dotenv";
import path from "path";
const ___filename = fileURLToPath(import.meta.url);
const ___dirname = path.dirname(___filename);

dotenv.config();
if (
  !process.env.DISCORD_TOKEN ||
  !process.env.DISCORD_CLIENT_ID ||
  !process.env.DISCORD_CLIENT_SECRET
) {
  throw new Error(
    "Missing required environment variables: SECRET_TOKEN, CLIENT_ID, CLIENT_SECRET",
  );
}

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
