import {
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  type TextChannel,
} from "discord.js";
import type { command } from "../core/cli.js";
import { chatBot } from "../database/db.js";
import { logger } from "../utils/logger.js";

const CHANNEL_NAME = "sk-chatbots";
const creating = new Set<string>();

const BOT_NEEDS = [
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.EmbedLinks,
] as const;

export default <command>{
  name: "chatchannel",
  description: "Creates a channel to chat with Character.AI bots.",
  nsfw: false,
  permissions: PermissionFlagsBits.ManageChannels.toString(),
  ChannelOption: {
    name: "category",
    description: "Category where the channel will be created",
    required: false,
    channelType: ChannelType.GuildCategory,
  },
  BooleanOption: {
    name: "nsfw",
    description: "Mark the channel as age-restricted",
    required: false,
  },
  run: async (interaction) => {
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({
        content: "this command can only be used in a server.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (
      !interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)
    ) {
      await interaction.reply({
        content:
          "You need the **Manage Channels** permission to use this command.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (!guild.members.me?.permissions.has(BOT_NEEDS)) {
      await interaction.reply({
        content:
          "I'm missing permissions: **Manage Channels, View Channel, Send Messages, " +
          "Read Message History and Embed Links**.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (creating.has(guild.id)) {
      await interaction.reply({
        content:
          "Please wait, a channel is already being created for this server.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const existingId = await chatBot.getChannelId(guild.id);
    const existing = existingId
      ? guild.channels.cache.get(existingId)
      : undefined;
    if (existing) {
      await interaction.reply({
        content: "A chat channel already exists: " + existing,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const category = interaction.options.getChannel("category", false, [
      ChannelType.GuildCategory,
    ]);
    const nsfw = interaction.options.getBoolean("nsfw") ?? false;

    creating.add(guild.id);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    let channel: TextChannel | undefined;
    try {
      channel = await guild.channels.create({
        name: CHANNEL_NAME,
        type: ChannelType.GuildText,
        topic:
          "This channel is for chatting with Character.AI bots. Please be respectful and follow the server rules.",
        parent: category?.id ?? null,
        nsfw,
        rateLimitPerUser: 5,
        reason: `${interaction.user.tag}`,
      });

      await chatBot.register(guild.id, channel.id, interaction.user.id);
      await interaction.editReply(
        `great!! we created a channel for you: ${channel}, now you can start to set up your chatbot!\n\n**Next step:** Use the \`/setup\` to search for a chatbot and set it up in this channel.`,
      );
    } catch (err) {
      logger.error("Error creating chat channel:", err);
      await channel?.delete("Error creating chat channel").catch(() => {});
      await interaction.editReply(
        "An error occurred while creating the chat channel.",
      );
    } finally {
      creating.delete(guild.id);
    }
  },
};
