import { MessageFlags, PermissionFlagsBits } from "discord.js";
import { chatBot } from "../database/db.js";
import type { command } from "../core/cli.js";

export default <command>{
  name: "change-style",
  description: "Change the style of the chatbot.",
  StringOption: {
    name: "style",
    description: "The style you want to change to.",
    required: true,
    choises: [
      { name: "Normal", value: "normal" },
      { name: "Embedded", value: "embedded" },
    ],
  },
  permissions: PermissionFlagsBits.ManageGuild.toString(),
  run: async (interaction) => {
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({
        content: "this command can only be used in a server.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const style = interaction.options.getString("style", true);
    const d = await chatBot.getChannelId(guild.id);
    if (!d) {
      await interaction.reply({
        content:
          "No chatbot channel is set up for this server.\nUse `/chatchannel` to create one.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const f = await chatBot.findById(guild.id);
    if (!f) {
      await interaction.reply({
        content:
          "No chatbot channel is set up for this server.\nUse `/chatchannel` to create one.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    f.style = style as "normal" | "embedded";
    await chatBot.insertData(f);
    await interaction.reply({
      content: `Chatbot style changed to **${style}**.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
