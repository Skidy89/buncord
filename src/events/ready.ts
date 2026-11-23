import { Routes } from "discord.js";
import type { BotClient } from "../core/cli.js";
import { chatBot } from "../database/db.js";

export default (client: BotClient) => {
  client.once("clientReady", async () => {
    client.user?.setStatus("online");
    client.logger.info(`Logged in as ${client.user?.tag}`);
    await chatBot.load();
    setInterval(
      () => client.rest.get(Routes.gateway()).catch(() => {}),
      30_000,
    );
  });
};
