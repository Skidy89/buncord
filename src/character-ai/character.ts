import { CharacterAI, type DMConversation } from "node_characterai";
import { chatBot } from "../database/db.js";

type characterMessage = {
  DM: DMConversation;
  characterId: string;
};
export type characterResult = {
  id: string;
  name: string;
  description: string;
  avatarUrl: string;
  createdBy: string;
  // maybe i can use this
  greeting?: string;
};
class CharacterAIClient {
  private token: string | undefined;
  private webNextToken: string | undefined;
  private cli: CharacterAI;
  private characterCache: Map<string, characterMessage> = new Map();
  constructor() {
    this.cli = new CharacterAI();
  }
  setToken(token: string, webNextToken: string) {
    this.token = token;
    this.webNextToken = webNextToken;
  }
  private async authenticate() {
    if (!this.token) throw new Error("Character AI token is not set.");
    if (!this.cli.authenticated) {
      await this.cli.authenticate(this.token, this.webNextToken);
    }
    return this.cli;
  }
  private formatAvatarUrl(id: string) {
    return "https://characterai.io/i/200/static/avatars/" + id;
  }
  private fmtCharacters(characters: any[]) {
    const fmt: characterResult[] = [];
    for (const character of characters) {
      fmt.push({
        id: character.external_id,
        name: character.name,
        description: character.title,
        avatarUrl: this.formatAvatarUrl(character.avatar_file_name),
        createdBy: character.user__username,
        greeting: character.greeting,
      });
    }
    return fmt;
  }
  public async getCharacters(characterName: string) {
    await this.authenticate();
    const d = await this.cli.searchCharacters(characterName);
    if (d.length === 0)
      throw new Error(`No characters found for ${characterName}`);
    // why on earth is a array of arrays sob
    const final = d[0].result.data.json.characters;
    const formatter = this.fmtCharacters(final);
    return formatter;
  }
  public async insertCharacter({
    characterName,
    characterId,
    guildId,
  }: {
    characterName: string;
    characterId: string;
    guildId: string;
  }) {
    const cli = await this.authenticate();
    const dd = await cli.fetchCharacter(characterId);
    if (!dd) throw new Error(`Character ${characterName} not found.`);
    const d = await dd.DM();
    this.characterCache.set(guildId, { DM: d, characterId });
    return this.characterCache.get(guildId);
  }
  public async getCharacter(guildId: string) {
    const character = this.characterCache.get(guildId);
    if (!character) {
      const c = await chatBot.findById(guildId);
      if (!c) throw new Error(`No character found for guild ${guildId}`);
      if (!c.character_id || !c.character_name)
        throw new Error(`No character found for guild ${guildId}`);
      return this.insertCharacter({
        characterName: c.character_name,
        characterId: c.character_id,
        guildId,
      });
    }
    return character;
  }
  public async sendMessage({
    guildId,
    message,
  }: {
    guildId: string;
    message: string;
  }) {
    let character = this.characterCache.get(guildId);
    if (!character) {
      character = await this.getCharacter(guildId);
      if (!character)
        throw new Error(`No character found for guild ${guildId}`);
    }
    const d = await character.DM.sendMessage(message);

    return d.content || d.text;
  }
}

export const CAICli = new CharacterAIClient();
