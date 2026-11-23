import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { CAICli, type characterResult } from "../character-ai/character.js";
import type { command } from "../core/cli.js";
import { chatBot } from "../database/db.js";
import { LRUCache } from "lru-cache";

const truncate = (text: string, max: number) =>
  text.length > max ? text.slice(0, max - 1) + "…" : text;

const isUrl = (value?: string) => !!value && /^https?:\/\//.test(value);

const cache = new LRUCache<string, characterResult[]>({
  max: 500,
  ttl: 1000 * 60 * 4,
}); // 4 minutes
export default <command>{
  name: "setup",
  description: "Set up your chatbot.",
  nsfw: false,
  StringOption: {
    name: "character",
    description: "The name of the character you want to chat with.",
    required: true,
    choises: [],
  },
  permissions: PermissionFlagsBits.ManageGuild.toString(),
  run: async (interaction) => {
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({
        content: "this command can only be used in a server.",
        flags: 64,
      });
      return;
    }
    const existingId = await chatBot.getChannelId(guild.id);
    const existing = existingId
      ? guild.channels.cache.get(existingId)
      : undefined;
    if (!existing) {
      await interaction.reply({
        content:
          "No chatbot channel is set up for this server.\nUse `/chatchannel` to create one.",
        flags: 64,
      });
      return;
    }
    if (cache.get(guild.id)) {
      await interaction.reply({
        content:
          "someone have already searched for characters recently. Please wait a few minutes before searching again.",
        flags: 64,
      });
      return;
    }
    const searched = await CAICli.getCharacters(
      interaction.options.getString("character", true),
    );
    if (searched.length === 0) {
      await interaction.reply({
        content: "No characters found with that name.",
        flags: 64,
      });
      return;
    }
    cache.set(guild.id, searched);
    const characters = searched.slice(0, 10);
    const total = characters.length;
    let page = 0;
    await interaction.deferReply({ flags: 64 });

    const buildEmbed = (index: number) => {
      const character = characters[index]!;
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setAuthor({ name: "Character search" })
        .setTitle(truncate(character.name, 256))
        .setDescription(
          truncate(character.description || "*No description provided.*", 1000),
        )
        .addFields(
          {
            name: "Created by",
            value: character.createdBy || "Unknown",
            inline: true,
          },
          {
            name: "Character ID",
            value: character.id || "Unknown",
            inline: true,
          },
        )
        .setFooter({ text: "do not abuse this command please okay." });

      if (isUrl(character.avatarUrl)) embed.setThumbnail(character.avatarUrl);
      return embed;
    };

    const buildRow = (index: number, disabled = false) =>
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("prev")
          .setEmoji("◀️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled || total === 1),
        new ButtonBuilder()
          .setCustomId("counter")
          .setLabel(`${index + 1} / ${total}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId("next")
          .setEmoji("▶️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled || total === 1),
        new ButtonBuilder()
          .setCustomId("select")
          .setLabel("Select")
          .setStyle(ButtonStyle.Success)
          .setDisabled(disabled),
        new ButtonBuilder()
          .setCustomId("cancel")
          .setLabel("Cancel")
          .setStyle(ButtonStyle.Danger)
          .setDisabled(disabled),
      );

    const message = await interaction.editReply({
      embeds: [buildEmbed(page)],
      components: [buildRow(page)],
    });

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 1000 * 60 * 2,
      idle: 1000 * 60,
      filter: (i) => i.user.id === interaction.user.id,
    });

    collector.on("collect", async (i) => {
      try {
        switch (i.customId) {
          case "prev":
            page = (page - 1 + total) % total;
            await i.update({
              embeds: [buildEmbed(page)],
              components: [buildRow(page)],
            });
            break;

          case "next":
            page = (page + 1) % total;
            await i.update({
              embeds: [buildEmbed(page)],
              components: [buildRow(page)],
            });
            break;

          case "select": {
            const chosen = characters[page]!;
            collector.stop("selected");
            await i.deferUpdate();

            await i.editReply({
              embeds: [
                new EmbedBuilder()
                  .setColor(0x57f287)
                  .setTitle(`✅ ${chosen.name} selected`)
                  .setDescription(`Your chatbot will now talk in ${existing}.`),
              ],
              components: [],
            });
            const c = await chatBot.getById(guild.id);
            if (c) {
              c.character_avatar_url = chosen.avatarUrl;
              c.character_id = chosen.id;
              c.character_name = chosen.name;
              await chatBot.insertData(c);
            }
            break;
          }

          case "cancel":
            collector.stop("cancelled");
            await i.update({
              embeds: [
                new EmbedBuilder()
                  .setColor(0xed4245)
                  .setDescription("Setup cancelled."),
              ],
              components: [],
            });
            break;
        }
      } catch (err) {
        console.error(err);
      }
    });

    collector.on("end", async (_collected, reason) => {
      if (reason === "selected" || reason === "cancelled") return;

      await interaction
        .editReply({
          embeds: [buildEmbed(page)],
          components: [buildRow(page, true)],
        })
        .catch(() => {});
    });
  },
};
