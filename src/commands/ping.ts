import type { command } from "../core/cli.js";

export default <command>{
  name: "ping",
  description: "Check the bot's latency.",
  nsfw: false,
  run: async (interaction) => {
    await interaction.reply({
      content: "...",
      withResponse: true,
    });
    const latency = Date.now() - interaction.createdTimestamp;
    await interaction.editReply(`Pong! ${latency}ms`);
  },
};
