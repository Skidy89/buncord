import {
  GatewayIntentBits,
  REST,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  Client,
  type ClientOptions,
  type RESTPostAPIApplicationCommandsJSONBody,
  Routes,
  type PermissionFlagsBits,
} from "discord.js";
import { readDir } from "../utils/index.js";
import { logger } from "../utils/logger.js";

export type command = RESTPostAPIApplicationCommandsJSONBody & {
  description: string;
  userOption?: {
    name: string;
    description: string;
    required: boolean;
  };
  StringOption?: {
    name: string;
    description: string;
    required: boolean;
    choises: {
      name: string;
      value: string;
    }[];
  };
  ChannelOption?: {
    name: string;
    description: string;
    required: boolean;
    channelType: number;
  };
  BooleanOption?: {
    name: string;
    description: string;
    required: boolean;
  };
  permissions?: string;
  run: (interaction: ChatInputCommandInteraction, client: BotClient) => unknown;
};

export class BotClient extends Client {
  public commands: Map<string, command> = new Map();
  private path: string;
  private readonly secretToken: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  public logger = logger;
  constructor(
    path: string,
    {
      secretToken,
      clientId,
      clientSecret,
    }: { secretToken: string; clientId: string; clientSecret: string },
  ) {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
      ],
    } as ClientOptions);
    this.path = path;
    this.secretToken = secretToken;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }
  public async build(command: command): Promise<void> {
    const builder = new SlashCommandBuilder()
      .setName(command.name)
      .setDescription(command.description);
    if (command.userOption) {
      builder.addUserOption((option) =>
        option
          .setName(command.userOption!.name)
          .setDescription(command.userOption!.description)
          .setRequired(command.userOption!.required),
      );
    }
    if (command.nsfw) {
      builder.setNSFW(command.nsfw);
    }
    if (command.permissions) {
      builder.setDefaultMemberPermissions(command.permissions).setContexts(0);
    }
    if (command.StringOption) {
      builder.addStringOption((option) => {
        if (!command.StringOption) return option;
        option
          .setName(command.StringOption!.name)
          .setDescription(command.StringOption!.description)
          .setRequired(command.StringOption!.required);

        if (command.StringOption.choises.length > 0) {
          for (const choice of command.StringOption.choises) {
            option.addChoices({ name: choice.name, value: choice.value });
          }
        }
        return option;
      });
    }
    if (command.ChannelOption) {
      builder.addChannelOption((option) =>
        option
          .setName(command.ChannelOption!.name)
          .setDescription(command.ChannelOption!.description)
          .setRequired(command.ChannelOption!.required)
          .addChannelTypes(command.ChannelOption!.channelType),
      );
    }
    if (command.BooleanOption) {
      builder.addBooleanOption((option) =>
        option
          .setName(command.BooleanOption!.name)
          .setDescription(command.BooleanOption!.description)
          .setRequired(command.BooleanOption!.required),
      );
    }
    const commandJSON = builder.toJSON();
    this.commands.set(command.name, { ...command, ...commandJSON });
    return;
  }
  private async loadEvents(): Promise<void> {
    try {
      const path = this.path + "/events";
      const files = await readDir(path);
      if (files.length === 0) {
        this.logger.warn(`No event files found in ${path}`);
        return;
      }
      for (const file of files) {
        if (!file.endsWith(".js")) continue;
        this.logger.info(`Loading event: ${file}`);
        const eventModule = await import(`${path}/${file}`);
        const event = eventModule.default;
        if (typeof event === "function") {
          await event(this);
        } else {
          this.logger.warn(`Event in ${file} is not a function`);
          continue;
        }
      }
    } catch (error) {
      this.logger.error("Error loading events:", error);
    }
  }
  private async loadCommands(): Promise<void> {
    try {
      const path = this.path + "/commands";
      const files = await readDir(path);
      if (files.length === 0) {
        this.logger.warn(`No command files found in ${path}`);
        return;
      }
      for (const file of files) {
        if (!file.endsWith(".js")) continue;
        const commandModule = await import(`${path}/${file}`);
        const command: command = commandModule.default;
        await this.build(command);
      }
    } catch (error) {
      this.logger.error("Error loading commands:", error);
    }
  }
  private getAllCommands(): command[] {
    return Array.from(this.commands.values());
  }
  public async start(): Promise<BotClient> {
    await this.loadCommands();
    await this.registerCommands();
    await this.loadEvents();
    await this.login(this.secretToken);
    return this;
  }
  private async registerCommands(): Promise<void> {
    const rest = new REST({ version: "10" }).setToken(this.secretToken);
    const commandsArray = this.getAllCommands();
    if (commandsArray.length === 0) {
      this.logger.warn("No commands to register");
      return;
    }
    await rest.put(Routes.applicationCommands(this.clientId), {
      body: commandsArray,
    });
  }
}
