import { CAICli } from "../character-ai/character.js";
import type { BotClient } from "../core/cli.js";
import { chatBot } from "../database/db.js";

export default (client: BotClient) => {
  client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (!message.mentions.has(client.user?.id ?? "")) return;
    const guild = message.guild;
    if (!guild) return;
    const c = await chatBot.findById(guild.id);
    if (!c) return await message.reply("No character is set up for this server. Please use the `/setup` command to set one up.");
    const channel = message.channel;
    await channel.sendTyping();
    try {
      const response = await CAICli.sendMessage({
        guildId: guild.id,
        message: message.content,
      });
      await channel.send(response);
    } catch (error) {
      client.logger.error(`Error sending message in guild ${guild.id}:`, error);
      await channel.send("An error occurred while sending the message.");
    }
  });
};
