# buncord

a simple discord bot on bun, prepared for aot! (ahead-of-time)

this discord client is meant to be without JIT, still is not prepared for it

## Requirements

- bun installed
- node installed
- typescript (tsc)

## Set up the Discord application

reused for another guy readme. but it works in this one too!

1. Create an application in the Developer Portal and add a bot user.
2. Copy the bot token, application (client) ID, and client secret.
3. Under **Bot → Privileged Gateway Intents**, enable **Message Content Intent**. The client requests this intent at login. The code also requests the Guilds, Guild Messages, and Guild Voice States intents.
4. Invite the bot to your server with the `bot` and `applications.commands` OAuth2 scopes.

[!warning]
> This cli uses the [node_characterai]("https://github.com/Skidy89/node_characterai-2.0")
> To actually use it you need your **Token** and **web-auth**
> Please follow the readme to know how to get both of them

## TODO

- Prepare scripts for aot
- Avoid using dinamic imports
- Fully type this stuff
