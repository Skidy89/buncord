import { MessageFlags } from "discord.js";
import type { BotClient } from "../core/cli.js";

export default (client: BotClient) => {
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
      if (command.nsfw) {
        const ch = interaction.channel;
        if (!ch || !("nsfw" in ch) || !ch.nsfw) {
          await interaction.reply({
            content: "you can only use this command in a NSFW channel.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
      }

      await command.run(interaction, client);
    } catch (error) {
      client.logger.error(
        `Error executing command ${interaction.commandName}:`,
        error,
      );

      if (!interaction.replied && !interaction.deferred) {
        await interaction
          .reply({
            content: "An error occurred while executing this command.",
            flags: MessageFlags.Ephemeral,
          })
          .catch(() => {});
      }
    }
  });
};
