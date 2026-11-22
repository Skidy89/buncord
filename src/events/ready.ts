import type { BotClient } from "../core/cli.js";

export default (client: BotClient) => {
  client.once("clientReady", () => {
    client.user?.setStatus("online");
    client.logger.info(`Logged in as ${client.user?.tag}`);
  });
};
