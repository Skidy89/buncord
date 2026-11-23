import { CharacterAI, type DMConversation } from "node_characterai";

type characterMessage = {
  DM: DMConversation;
  characterId: string;
};
class CharacterAIClient {
  private token: string | undefined;
  private cli: CharacterAI;
  private characterCache: Map<string, characterMessage> = new Map();
  constructor() {
    this.cli = new CharacterAI();
  }
  setToken(token: string) {
    this.token = token;
  }
  private async authenticate() {
    if (!this.token) throw new Error("Character AI token is not set.");
    if (!this.cli.authenticated) {
      await this.cli.authenticate(this.token);
    }
    return this.cli;
  }
  public async getCharacters(characterName: string) {
    await this.authenticate();
    // this will give 401.
    // todo: implement this directly into node_characterai and upload a npm package instead.
    const params = new URLSearchParams({
      batch: "1",
      input: JSON.stringify({
        "0": {
          json: {
            searchQuery: characterName,
            tagId: null,
            sortedBy: "relevance",
            filters: null,
            direction: "forward",
          },
          meta: {
            values: {
              tagId: ["undefined"],
              filters: ["undefined"],
            },
            v: 1,
          },
        },
      }),
    });
    const url = `https://character.ai/api/trpc/search.search?${params.toString()}`;
    const response = await fetch(url, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        }
    })
    const data = await response.json();
    return data;
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
    const d = await cli.fetchLatestDMConversationWith(characterId);
    if (!d) throw new Error(`Character ${characterName} not found.`);
    this.characterCache.set(characterName, { DM: d, characterId });
    // todo: save to database
    return true;
  }
}


export const CAICli = new CharacterAIClient();