import type { BotClient } from "../core/cli.js";
import { chatBot } from "../database/db.js";

export default (client: BotClient) => {
  client.once("channelDelete", async (channel) => {
    const wasChatbotChannel = await chatBot.findById(channel.id);
    if (wasChatbotChannel) await chatBot.deleteById(channel.id);
  });
};
