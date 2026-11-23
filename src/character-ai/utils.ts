import { EmbedBuilder } from "discord.js";
import type { chatbotChannels } from "../database/tables.js";

const isUrl = (value?: string): value is string =>
  !!value && /^https?:\/\//.test(value);

export function sendMessageStyles(message: string, g: chatbotChannels) {
  if (g.style === "embedded") {
    const embed = new EmbedBuilder()
      .setAuthor({
        name: g.character_name || "Character",
        ...(isUrl(g.character_avatar_url) && {
          iconURL: g.character_avatar_url,
        }),
      })
      .setDescription(message.slice(0, 4096))
      .setColor(0x5865f2);

    return { embeds: [embed] };
  }

  return { content: message.slice(0, 2000) };
}
