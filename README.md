# ˚.ᵎᵎ Akano Bot ᝰ.ᐟ

˚. ᵎᵎ ──────── ᝰ.ᐟ
Akano Bot is a multi-platform bot project that supports WhatsApp, Telegram, and Discord in a single repository. It is built with a modular plugin system and includes features such as AI chat through Gemini, media downloading from YouTube, TikTok, Instagram, Facebook, X/Twitter, and Pinterest, group management, moderation tools, sticker creation, and various utility commands.

> [!IMPORTANT]
> Akano Bot is currently in Beta. Project structure, APIs, plugins, and features may change at any time. If you encounter any bugs, please let me know.

Supported platforms:

> ˚. <sub> WhatsApp using Baileys. </sub>
> ˚. <sub> Telegram using Telegraf. </sub>
> ˚. <sub> Discord using discord.js. </sub>

## ˚. Table of Contents

1. [About Akano Bot](#1-about-akano-bot)
2. [Libraries Used](#2-libraries-used)
3. [Installation](#3-installation)
4. [Running the Bot](#4-running-the-bot)
5. [Folder Structure](#5-folder-structure)
6. [Plugin System](#6-plugin-system)
7. [WhatsApp Plugins](#7-whatsapp-plugins)
8. [Telegram Plugins](#8-telegram-plugins)
9. [Telegram Inline Mode](#9-telegram-inline-mode)
10. [Discord Plugins](#10-discord-plugins)
11. [Handlers](#11-handlers)
12. [How to Add a Plugin](#12-how-to-add-a-plugin)
13. [Cookies](#13-cookies)
14. [Downloader](#14-downloader)
15. [FAQ](#15-faq)
16. [Troubleshooting](#16-troubleshooting)
17. [Closing](#17-closing)

## ˚. 1. About Akano Bot

Akano Bot is a multi-platform bot designed to run on several chat services from one codebase. The project uses a modular architecture, allowing features to be added, modified, or disabled without directly changing the core system.

Main features:

> ˚. <sub> AI chat using Gemini. </sub>
> ˚. <sub> Media downloader for YouTube, TikTok, Instagram, Facebook, X/Twitter, and Pinterest. </sub>
> ˚. <sub> Group management. </sub>
> ˚. <sub> Moderation tools. </sub>
> ˚. <sub> Sticker maker. </sub>
> ˚. <sub> Utility commands such as ping, calculator, profile, AFK, and more. </sub>
> ˚. <sub> Plugin system with hot-reload support. </sub>
> ˚. <sub> Middleware for cooldown, permission, spam detection, and anti-link. </sub>
> ˚. <sub> CLI support for running selected platforms only. </sub>

> [!NOTE]
> Akano Bot is currently in Beta. Project structure, APIs, plugins, and features may change at any time.

## ˚. 2. Libraries Used

The following libraries are used by Akano Bot based on `package.json`.

| Library | Function | Usage | Reason |
|---|---|---|---|
| `baileys` (`npm:@itsliaaa/baileys@latest`) | WhatsApp Web API | Connects to WhatsApp Web without an official API | Core WhatsApp connection, supports pair code and multi-device |
| `discord.js` (`^14.26.5`) | Discord API | Connects to the Discord gateway | Core Discord connection, slash commands, and voice support |
| `@discordjs/voice` (`^0.19.2`) | Discord Voice | Voice connection for Discord | Supports the Discord music player |
| `telegraf` (`latest`) | Telegram Bot API | Connects to the Telegram Bot API | Core Telegram connection |
| `axios` (`^1.7.9`) | HTTP Client | Makes HTTP requests to external APIs | Used for scraping, API calls, and data fetching |
| `cheerio` (`^1.0.0-rc.10`) | HTML Parser | Parses HTML | Used for web scraping |
| `chalk` (`^4.1.1`) | Terminal Color | Colorizes terminal output | Used for colored console logging |
| `cfonts` (`3.1.1`) | ASCII Font | ASCII art banner | Displays the bot name banner during startup |
| `gradient-string` (`^2.0.1`) | Gradient Text | Gradient color in terminal | Used for gradient info in WhatsApp start message |
| `yargs` (`^17.5.1`) | CLI Argument Parser | Parses command-line arguments | Parses `--whatsapp`, `--telegram`, `--discord`, `--all`, and `--help` |
| `node-fetch` (`^2.6.7`) | HTTP Fetch | Fetches URLs | Used for downloading files and API calls |
| `fs-extra` | File System Extended | Extended file system operations | File system utilities |
| `lowdb` (`^2.1.0`) | JSON Database | Simple JSON database | Local project database via `database.json` |
| `moment-timezone` (`^0.5.47`) | Date/Time | Date formatting with timezone | Time formatting using Asia/Jakarta timezone |
| `chokidar` (`^3.6.0`) | File Watcher | Watches file changes | Hot-reloads plugins and scrapers when files change |
| `file-type` (`^16.5.3`) | File Type Detection | Detects MIME type from buffer | Identifies file types for media handling |
| `fluent-ffmpeg` (`^2.1.2`) | FFmpeg Wrapper | Node.js FFmpeg wrapper | Media conversion for audio, video, and stickers |
| `jimp` (`latest`) | Image Processing | Image manipulation | Image resizing and manipulation |
| `node-webpmux` (`^3.1.3`) | WebP Handler | WebP image manipulation | Creates WebP stickers with EXIF data |
| `qrcode-terminal` (`^0.12.0`) | QR Code Terminal | Generates QR code in terminal | Used for WhatsApp QR pairing |
| `syntax-error` (`^1.4.0`) | Syntax Checker | Checks JavaScript syntax errors | Validates plugins before loading |
| `lodash` (`^4.17.21`) | Utility Library | General utility functions | Used for `_.chain()` in database operations |
| `node-cache` (`^5.1.2`) | In-Memory Cache | In-memory caching | Caches message retry counters |
| `awesome-phonenumber` (`^2.73.0`) | Phone Number | Phone number validation/formatting | Formats phone numbers in logs |
| `link-preview-js` (`latest`) | Link Preview | Generates link previews | Previews URLs sent in messages |
| `prism-media` (`^1.0.5`) | Media Processing | Media transcoding | Audio processing for voice |
| `opusscript` (`^0.0.8`) | Opus Codec | Opus audio codec | Audio encoding for Discord voice |
| `libsodium-wrappers` (`^0.8.4`) | Crypto | Encryption library | Dependency for Discord voice encryption |

## ˚. 3. Installation

### Clone the Repository

~~~bash
git clone https://github.com/kutashiakano/Akano-Bot.git
cd Akano-Bot
~~~

### Install Node.js

This project requires Node.js version 18 or above.

The version requirement is defined in `engines.node` inside `package.json`:

~~~json
{
  "engines": {
    "node": ">= 18.0.0"
  }
}
~~~

### Install Dependencies

~~~bash
npm install
~~~

### Install External Tools

External tools are required if you want to use the downloader features fully.

#### yt-dlp

`yt-dlp` is used to download video and audio from various platforms.

~~~bash
pip3 install --break-system-packages -U yt-dlp
~~~

#### gallery-dl

`gallery-dl` is used for Instagram slides and Pinterest.

~~~bash
pip3 install --break-system-packages -U gallery-dl
~~~

#### FFmpeg

FFmpeg is used for media conversion.

Linux/Ubuntu:

~~~bash
sudo apt install ffmpeg
~~~

Termux:

~~~bash
pkg install ffmpeg
~~~

### Configuration

Open `settings.js`.

Some configuration values that should be adjusted:

- Telegram token
- Discord token
- Owner number
- Command prefix

<details>
<summary><b>View Configuration Options</b></summary>

Example global configuration:

~~~js
global.settings.telegram.token = "YOUR_TELEGRAM_TOKEN";
global.settings.discord.token = "YOUR_DISCORD_TOKEN";
global.owner = ["628xxxxxxxxxx"];
global.prefix = [".", "#", "!", "/"];
~~~

Default prefix:

~~~js
[".", "#", "!", "/"]
~~~

</details>

### Cookie Configuration

Cookies are optional, but required for some platforms such as Instagram and Facebook.

Create a file named `cookies.txt` in the project root.

The file must use the Netscape HTTP Cookie File format.

Example:

~~~txt
# Netscape HTTP Cookie File
.domain.com	TRUE	/	FALSE	1234567890	cookie_name	cookie_value
.instagram.com	TRUE	/	TRUE	1234567890	sessionid	xxxxx
~~~

## ˚. 4. Running the Bot

Akano Bot can be run using npm scripts or directly through CLI flags.

### NPM Scripts

| Script | Command | Function |
|---|---|---|
| `start` | `node index.js --all` | Run all bots |
| `wa` | `node index.js --whatsapp` | Run WhatsApp only |
| `dc` | `node index.js --discord` | Run Discord only |
| `tg` | `node index.js --telegram` | Run Telegram only |
| `help` | `node index.js --help` | Show help |
| `debug` | `node run.js` | Debug mode |

Examples:

~~~bash
npm start
~~~

Run WhatsApp only:

~~~bash
npm run wa
~~~

Run Telegram only:

~~~bash
npm run tg
~~~

Run Discord only:

~~~bash
npm run dc
~~~

### CLI Flags

| Command | Function |
|---|---|
| `node . --all` | Run all bots: WhatsApp, Discord, and Telegram |
| `node . --whatsapp` | Run WhatsApp only |
| `node . --telegram` | Run Telegram only |
| `node . --discord` | Run Discord only |
| `node . --help` | Show all available commands and explanations |

### Startup Flow

1. `index.js` displays a banner using `cfonts`.
2. `index.js` runs `main.js`.
3. `main.js` parses CLI flags.
4. `main.js` requires the starter for each selected platform.

Platform startup details:

- WhatsApp:
  - `system/bot/whatsapp/lib/start.js`
  - `Client` class
  - auth
  - socket
  - handler
  - plugins

- Telegram:
  - `system/bot/telegram/start.js`
  - `TelegramBot.initialize()`
  - Telegraf
  - handler
  - plugins

- Discord:
  - `system/bot/discord/start.js`
  - `DiscordBot.initialize()`
  - Client
  - handler
  - commands

### Auto-Restart

`index.js` includes an auto-restart mechanism.

Details:

- Maximum of 5 attempts
- Within a 5-minute window
- Uses exponential backoff delay

## ˚. 5. Folder Structure

The following is the folder structure of Akano Bot.

<details>
<summary><b>View Folder Structure</b></summary>

~~~txt
Akano-Bot/
  index.js                          # Entry point & process manager
  main.js                           # Platform launcher & CLI parser
  settings.js                       # Global configuration
  package.json                      # Dependencies
  database.json                     # Local JSON database
  cookies.txt                       # Netscape cookie for downloader
  run.js                            # Debug runner
  lib/                              # Core libraries
    converter.js                    # FFmpeg media converter (audio, video, sticker)
    database.js                     # Database initializer (users, chats, settings)
    exif.js                         # EXIF handler for WebP stickers
    leveling.js                     # XP & leveling system
    messageBuilder.js               # AIRich message builder
    premiumStore.js                 # Premium user management
    print.js                        # Console log formatter (WA/TG/DC)
  system/
    bot/
      whatsapp/
        handler.js                  # Main message handler & command parser
        lib/
          index.js                  # Client class, socket extension, plugin loader
          auth.js                   # Auth state management with retry
          events.js                 # Connection events handler
          messages.js               # Message helper functions
          socket.js                 # Socket creation
          cooldown.js               # Cooldown & spam detection system
          permission.js             # Permission system (owner/premium/admin)
          anti.js                   # Anti-link, anti-virtex, link extraction
          backup.js                 # Auto-backup system
          helpers.js                # Utility helpers
          button-response.js        # Button & interactive response handler
          chats.js                  # Chat extension methods
          groups.js                 # Group extension methods
          newsletter.js             # Newsletter extension methods
          business.js               # Business extension methods
          communities.js            # Communities extension methods
          serializer.js             # Message serializer
          start.js                  # WhatsApp bot starter
          system-handler.js         # System handler
          utils.js                  # Utility functions (download status, resize, etc.)
        plugins/
          ai/
            gemini.js               # Gemini AI chat
          downloader/
            tiktok.js               # TikTok downloader
            Instagram.js            # Instagram downloader
            youtube.js              # YouTube downloader
            facebook.js             # Facebook downloader
            x.js                    # X/Twitter downloader
            pinterest.js            # Pinterest downloader
          group/
            antilink.js             # Anti-link protection
            antivirtex.js           # Anti-virtex protection
            antidelete.js           # Anti-delete protection
            kick.js                 # Kick member
            add.js                  # Add member
            promote.js              # Promote to admin
            demote.js               # Demote from admin
            mute.js                 # Mute group
            hidetag.js              # Hidden tag all
            tagall.js               # Tag all members
            enable.js               # Toggle settings
            left.js                 # Goodbye message
          owner/
            ban.js                  # Ban user
            unban.js                # Unban user
            block.js                # Block user
            unblock.js              # Unblock user
            exec.js                 # Execute command
            broadcast.js            # Broadcast message
            premium.js              # Manage premium users
            prefix.js               # Change prefix
            self.js                 # Self mode
            groupmode.js            # Group-only mode
            setlimit.js             # Set user limit
            resetlimit.js           # Reset user limits
            stats.js                # Bot statistics
            simulate.js             # Simulate commands
            plugin.js               # Plugin management
            fileops.js              # File operations
            storydb.js              # Story database
            telegram.js             # Telegram integration
          subbot/
            subbot.js               # Sub-bot creation
            subbot_list.js          # Sub-bot list
          tools/
            sticker.js              # Sticker maker
            afk.js                  # AFK system
            ping.js                 # Ping check
            calculator.js           # Calculator
            profile.js              # User profile
            rvo.js                  # View once reader
          menu.js                   # Menu command
        sessions/                   # WhatsApp session data
      telegram/
        index.js                    # TelegramBot class
        handler.js                  # Message handler, middleware, group management
        start.js                    # Telegram bot starter
        logger.js                   # Logger
        group-manager.js            # Group join/leave handler
        plugins/
          menu.js                   # Interactive menu with inline keyboard
          ping.js                   # Ping check
          gemini.js                 # Gemini AI chat
          downloader.js             # Media downloader
          admin.js                  # Admin commands
          moderation.js             # Moderation commands
          owner.js                  # Owner commands
          utility.js                # Utility commands
          statistics.js             # Statistics commands
      discord/
        index.js                    # DiscordBot class
        handler.js                  # Interaction handler (slash commands, buttons)
        start.js                    # Discord bot starter
        commands/
          menu.js                   # Interactive menu with buttons
          play.js                   # Music player
          skip.js                   # Skip song
          stop.js                   # Stop music
          queue.js                  # Song queue
          nowplaying.js             # Now playing
          volume.js                 # Volume control
          search.js                 # Search songs
          downloader.js             # Media downloader
          gemini.js                 # Gemini AI chat
          moderation.js             # Moderation commands
          serverinfo.js             # Server info
          userinfo.js               # User info
          announce.js               # Announcement
          poll.js                   # Poll creation
          new_session.js            # New AI session
          del_session.js            # Delete AI session
    scrapers/
      index.js                      # Scraper class loader (chokidar watch)
      src/
        ytdpl.js                    # MediaDownloader (yt-dlp & gallery-dl wrapper)
        gemini.js                   # Gemini AI scraper (Google endpoint)
    image/                          # Static images
    logerror.txt                    # Error log file
  tmp/                              # Temporary files (auto-cleanup)
~~~

</details>

## ˚. 6. Plugin System

Akano Bot uses a modular plugin system. Each platform has its own plugin loading mechanism.

### How Plugins Are Loaded

#### WhatsApp

WhatsApp plugins are loaded by the `Client` class located in:

~~~txt
system/bot/whatsapp/lib/index.js
~~~

Loading process:

1. `Client` calls `scanDir(plugsPath)` recursively.
2. Every `.js` file is loaded using `require()`.
3. Plugins are stored in `global.plugin[filename]`.
4. `chokidar` is used for hot-reload.
5. Plugins are sorted by filename using `localeCompare`.
6. The total number of plugins is displayed in the console.

Example console output:

~~~txt
Loaded X plugins
~~~

#### Telegram

Telegram plugins are loaded through:

~~~txt
TelegramBot.loadPlugins()
~~~

Plugin location:

~~~txt
system/bot/telegram/plugins/
~~~

Loading process:

1. Reads the plugin folder.
2. Every `.js` file is loaded using `require()`.
3. Plugins are stored in `global.telegramPlugins[name]`.
4. Plugin name is taken from the filename without the `.js` extension.
5. Plugin name is converted to lowercase.
6. Plugins are registered as slash commands to the Telegram API.

#### Discord

Discord commands are loaded through:

~~~txt
DiscordBot.loadCommands()
~~~

Command location:

~~~txt
system/bot/discord/commands/
~~~

Loading process:

1. Reads the commands folder.
2. Every `.js` file is loaded using `require()`.
3. Commands are stored in `global.discordCommands[cmd.name]`.
4. Commands with an `options` array are registered as slash commands.
5. Registration is done through `client.application.commands.set()`.

### Plugin Metadata

#### WhatsApp Plugin Metadata

| Property | Type | Function |
|---|---|---|
| `help` | `string[]` | Command name for help menu |
| `command` | `string[]` or `RegExp` | Command trigger |
| `tags` | `string[]` | Category for menu grouping |
| `run` | `async function` | Main function to execute |
| `before` | `async function` | Function executed before command processing |
| `owner` | `boolean` | Owner only |
| `rowner` | `boolean` | Real owner only, not fromMe |
| `admin` | `boolean` | Group admin only |
| `group` | `boolean` | Can only be used in groups |
| `private` | `boolean` | Can only be used in private chat |
| `botAdmin` | `boolean` | Bot must be admin in the group |
| `premium` | `boolean` | Premium users only |
| `limit` | `boolean` or `number` | Limit cost for the command |
| `error` | `number` | Error count; if `>= 5`, command is blocked |
| `example` | `string` | Usage example; `%cmd` is replaced with prefix + command |
| `wait` | `boolean` | Show "Processing..." before execution |
| `customPrefix` | `string` | Custom prefix for this command |
| `exp` | `number` | XP gained, default: 17 |
| `disabled` | `boolean` | Disable plugin |
| `category` | `string[]` | Alternative category for tags |

#### Telegram Plugin Metadata

| Property | Type | Function |
|---|---|---|
| `help` | `string` | Command description |
| `command` | `string[]` or `string` | Command trigger without `/` |
| `tags` | `string[]` | Category |
| `run` | `async function(ctx, args)` | Main function |
| `before` | `async function(ctx, { budy })` | Middleware before command |
| `onCallback` | `async function(ctx)` | Callback query handler |
| `group` | `boolean` | Group only |
| `disabled` | `boolean` | Disable plugin |

#### Discord Plugin Metadata

| Property | Type | Function |
|---|---|---|
| `name` | `string` | Slash command name |
| `description` | `string` | Command description |
| `options` | `array` | Slash command options |
| `execute` | `async function(interaction)` | Main function |
| `handleButton` | `async function(interaction)` | Button interaction handler |

### Plugin Lifecycle

1. Loading: Plugins are required during startup.
2. Watch: Chokidar watches file changes.
3. Before Hook: The `before()` function is executed for all plugins before command processing on WhatsApp.
4. Permission Check: Checks owner, admin, premium, group, and botAdmin requirements.
5. Cooldown Check: Checks whether the user is in cooldown.
6. Spam Detection: Detects spam behavior.
7. Limit Check: Checks whether the user has enough limit.
8. Execution: The `run()` function is executed.
9. Error Handling: If an error occurs, it is logged to the owner and the error counter is incremented.
10. Auto-disable: If a plugin errors 5 or more times, it is automatically disabled.

## ˚. 7. WhatsApp Plugins

### Plugin Structure

<details>
<summary><b>Standard Plugin Format</b></summary>

~~~js
module.exports = {
  help: ["commandname"],
  command: ["commandname"],
  tags: ["category"],
  run: async (m, { sock, args, usedPrefix, command, text }) => {
    // Plugin code here
  },
  example: "%cmd https://example.com",
};
~~~

Alternative handler format:

~~~js
let handler = async (m, { sock, args, usedPrefix }) => {
  // Plugin code
};

handler.help = ["commandname"];
handler.tags = ["category"];
handler.command = ["commandname"];

module.exports = handler;
~~~

</details>

### Context Parameter

The `run` function receives a context object:

~~~js
{
  match,           // Regex match result
  usedPrefix,      // Prefix used: . # ! /
  noPrefix,        // Text without prefix
  args,            // Argument array
  command,         // Called command name
  text,            // Full text after command
  sock,            // Baileys socket, also available as this context
  participants,    // Group participants
  groupMetadata,   # Group metadata
  user,            // User data from participants
  bot,             // Bot participant data
  isROwner,        // Real owner check
  isOwner,         // Owner check, includes fromMe
  isRAdmin,        // Real superadmin check
  isAdmin,         // Admin check
  isBotAdmin,      // Bot admin check
  isPrems,         // Premium user check
  isBans,          // Banned user check
  chatUpdate,      // Raw chat update
  pushname,        // User display name
  senderPhone,     // Phone number without @s.whatsapp.net
}
~~~

### Message Object

The message object is commonly referred to as `m`.

| Property | Function |
|---|---|
| `m.chat` | Chat JID, group or private |
| `m.sender` | Sender JID |
| `m.fromMe` | Boolean, whether message is from the bot itself |
| `m.isGroup` | Boolean, whether message comes from a group |
| `m.text` | Message text |
| `m.mtype` | Message type, such as imageMessage or videoMessage |
| `m.quoted` | Replied message |
| `m.mentions` | Array of mentioned JIDs |
| `m.key` | Message key |
| `m.reply(text)` | Reply with text |
| `m.react(emoji)` | React to message |
| `m.download()` | Download media from message |

### Simple Plugin Example

Ping plugin:

~~~js
let handler = async (m) => {
  m.reply("Pong!");
};

handler.help = ["ping"];
handler.tags = ["general"];
handler.command = /^(ping)$/i;

module.exports = handler;
~~~

Sticker plugin:

~~~js
const { sticker } = require("../../../../../lib/converter");

let handler = async (m, { sock, args, usedPrefix }) => {
  const isQuoted = m.quoted && /image|video|webp/.test(m.quoted.mimetype);
  const isDirect = /image|video|webp/.test(m.mtype);

  if (!isQuoted && !isDirect) {
    return m.reply(`Reply or send image/video with caption ${usedPrefix}s`);
  }

  const msg = isQuoted ? m.quoted : m;
  const media = await msg.download();

  if (!media) return m.reply("Failed to download media");

  const packname = global.settings.media?.sticker?.packname;
  const author = global.settings.media?.sticker?.author;

  const result = await sticker(media, { packname, author });

  if (!result) return m.reply("Failed to create sticker");

  await sock.sendMessage(m.chat, { sticker: result }, { quoted: m });
};

handler.help = ["sticker", "s"];
handler.tags = ["tools"];
handler.command = ["sticker", "s"];

module.exports = handler;
~~~

Simplified downloader plugin:

~~~js
const fs = require("fs/promises");
const path = require("path");
const { downloadStatus } = require("../../lib/utils");

const cookiePath = path.join(__dirname, "../../../../cookies.txt");

module.exports = {
  help: ["tiktok", "ttdl"],
  command: ["tiktok", "ttdl"],
  tags: ["downloader"],
  run: async (m, { sock, text }) => {
    const urlRegex =
      /\bhttps?:\/\/(?:www\.)?(?:tiktok\.com|vt\.tiktok\.com)\/[^\s]+/i;

    const match = text?.match(urlRegex);
    const cleanUrl = match ? match[0].replace(/[.,!?;:]+$/, "") : null;

    if (!cleanUrl) throw new Error("Please provide a valid TikTok URL.");

    const status = await downloadStatus(m, sock);

    try {
      await status.processing();

      const downloader = global.scraper.ytdpl;
      const result = await downloader.download(cleanUrl, {
        cookies: cookiePath,
      });

      const file = result.files[0];

      if (!file) throw new Error("Failed to download.");

      await sock.sendFile(
        m.chat,
        file,
        path.basename(file),
        "*TikTok Download*",
        m
      );

      await downloader.cleanup(result.directory);
      await status.success();
    } catch (e) {
      await status.failed(e);
    }
  },
  example: "%cmd https://www.tiktok.com/@user/video/123",
};
~~~

## ˚. 8. Telegram Plugins

### Command Format

Telegram commands use the `/` prefix.

Format:

~~~txt
/commandname [args]
~~~

### Handler Structure

~~~js
module.exports = {
  help: "Description of command",
  command: ["cmd1", "cmd2"],
  tags: ["category"],
  run: async (ctx, args) => {
    // ctx = Telegraf context
    // args = string after command
    await ctx.reply("Response");
  },
};
~~~

### Telegram Context

| Property | Function |
|---|---|
| `ctx.message` | Raw message object |
| `ctx.from` | User info: id, username, first_name |
| `ctx.chat` | Chat info: id, type, title |
| `ctx.reply(text, extra)` | Reply with automatic quote |
| `ctx.replyWithPhoto(photo, extra)` | Reply with photo |
| `ctx.replyWithVideo(video, extra)` | Reply with video |
| `ctx.replyWithAudio(audio, extra)` | Reply with audio |
| `ctx.replyWithQuote(text, targetMsgId)` | Reply with specific quote |
| `ctx.sendChatAction(action)` | Send chat action, such as typing or upload_photo |
| `ctx.session` | Per-user session data |
| `ctx.callbackQuery` | Callback query data |

### Middleware

The Telegram handler uses a middleware chain:

- Auto-quote: all replies automatically quote the original message
- Group management: welcome, goodbye, verification, anti-flood, anti-spam, anti-arab, anti-tagall
- Before hooks: plugin `before()` functions are called for all plugins
- Command parsing: parses `/command args` from text
- Auto-typing: sends typing action while processing

### Callback Query

~~~js
module.exports = {
  // ...
  onCallback: async (ctx) => {
    const data = ctx.callbackQuery.data;

    if (data === "some_action") {
      await ctx.editMessageText("Updated text");
    }

    await ctx.answerCbQuery();
  },
};
~~~

### Reply Keyboard

~~~js
await ctx.reply("Choose an option:", {
  reply_markup: {
    keyboard: [
      [{ text: "Option 1" }, { text: "Option 2" }],
      [{ text: "Option 3" }],
    ],
    one_time_keyboard: true,
    resize_keyboard: true,
  },
});
~~~

### Inline Keyboard

~~~js
await ctx.reply("Choose:", {
  reply_markup: {
    inline_keyboard: [
      [{ text: "Button 1", callback_data: "btn1" }],
      [{ text: "Button 2", url: "https://example.com" }],
    ],
  },
});
~~~

### Telegram Plugin Example

~~~js
module.exports = {
  help: "Check bot response time",
  command: ["ping"],
  tags: ["general"],
  run: async (ctx) => {
    const start = Date.now();
    const msg = await ctx.reply("Pong!");
    const latency = Date.now() - start;

    await ctx.reply(`Latency: ${latency}ms`);
  },
};
~~~

## ˚. 9. Telegram Inline Mode

Telegram inline mode allows users to invoke the bot from any chat by typing:

~~~txt
@botname query
~~~

### How to Create an Inline Mode Plugin

1. Create a plugin file in `system/bot/telegram/plugins/`.
2. Add the `onInlineQuery` property to `module.exports`.

### Inline Mode Plugin Structure

~~~js
module.exports = {
  help: "Description",
  command: ["cmd"],
  tags: ["category"],

  onInlineQuery: async (ctx) => {
    const query = ctx.inlineQuery.query;

    if (!query) return;

    const results = [
      {
        type: "article",
        id: "1",
        title: "Result for: " + query,
        description: "Description here",
        input_message_content: {
          message_text: "You searched for: " + query,
        },
      },
    ];

    await ctx.answerInlineQuery(results);
  },

  onChosenInlineResult: async (ctx) => {
    const result = ctx.chosenInlineResult;
    // Handle chosen result
  },

  run: async (ctx) => {
    // Normal command handler
  },
};
~~~

### Receiving Inline Query

Inline queries are received through `ctx.inlineQuery`, which contains:

- `query`: user query text
- `from`: user information
- `chat_type`: chat type, such as private or group
- `offset`: pagination offset

### Sending Results

~~~js
await ctx.answerInlineQuery(results, {
  cache_time: 300,
  is_personal: true,
  next_offset: "10",
  switch_pm_text: "Help",
  switch_pm_parameter: "help",
});
~~~

### Result Formats

Article result:

~~~js
{
  type: "article",
  id: "unique_id",
  title: "Title",
  description: "Short description",
  input_message_content: {
    message_text: "Full text to send",
    parse_mode: "HTML",
  },
  thumb_url: "https://example.com/thumb.jpg",
  thumb_width: 100,
  thumb_height: 100,
}
~~~

Photo result:

~~~js
{
  type: "photo",
  id: "unique_id",
  photo_url: "https://example.com/photo.jpg",
  thumb_url: "https://example.com/thumb.jpg",
  photo_width: 800,
  photo_height: 600,
  input_message_content: {
    message_text: "Caption",
  },
}
~~~

## ˚. 10. Discord Plugins

### Slash Command

~~~js
const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  name: "commandname",
  description: "Command description",
  options: [
    {
      name: "target",
      description: "Target user",
      type: 6,
      required: false,
    },
  ],
  async execute(interaction) {
    const target = interaction.options.getUser("target");

    await interaction.reply(`Hello ${target || interaction.user}!`);
  },
};
~~~

### Events

Events are handled in:

~~~txt
system/bot/discord/handler.js
~~~

Main events:

- `clientReady`: bot is ready and registers commands
- `interactionCreate`: handles slash commands and buttons

### Interaction

~~~js
// Reply
await interaction.reply("Response");

// Defer reply for long processes
await interaction.deferReply();
await interaction.editReply("Result");

// Ephemeral reply, visible only to the sender
await interaction.reply({ content: "Secret", flags: 64 });

// Follow up
await interaction.followUp("Additional info");
~~~

### Button

~~~js
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const row = new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setCustomId("btn_action")
    .setLabel("Click Me")
    .setStyle(ButtonStyle.Primary),

  new ButtonBuilder()
    .setCustomId("btn_link")
    .setLabel("Visit")
    .setStyle(ButtonStyle.Link)
    .setURL("https://example.com")
);

await interaction.reply({ components: [row] });
~~~

Button handler:

~~~js
async handleButton(interaction) {
  if (interaction.customId === "btn_action") {
    await interaction.reply("Button clicked!");
  }
}
~~~

### Select Menu

~~~js
const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require("discord.js");

const row = new ActionRowBuilder().addComponents(
  new StringSelectMenuBuilder()
    .setCustomId("select_option")
    .setPlaceholder("Choose an option")
    .addOptions(
      {
        label: "Option 1",
        value: "opt1",
        description: "First option",
      },
      {
        label: "Option 2",
        value: "opt2",
        description: "Second option",
      }
    )
);

await interaction.reply({ components: [row] });
~~~

### Embed

~~~js
const { EmbedBuilder } = require("discord.js");

const embed = new EmbedBuilder()
  .setColor("#5865F2")
  .setTitle("Title")
  .setDescription("Description")
  .addFields(
    { name: "Field 1", value: "Value 1", inline: true },
    { name: "Field 2", value: "Value 2", inline: true }
  )
  .setFooter({ text: "Footer" })
  .setTimestamp();

await interaction.reply({ embeds: [embed] });
~~~

### Permission and Guild Only

~~~js
if (!interaction.member.permissions.has("KickMembers")) {
  return interaction.reply({
    content: "No permission!",
    flags: 64,
  });
}
~~~

Guild check in handler:

~~~js
if (
  interaction.guildId &&
  !client.guilds.cache.has(interaction.guildId)
) {
  // Bot has not joined this server
  return;
}
~~~

### Discord Plugin Example

~~~js
const { EmbedBuilder } = require("discord.js");

module.exports = {
  name: "info",
  description: "Show bot information",
  options: [],
  async execute(interaction) {
    const client = global.discord;
    const uptime = Date.now() - (global.discordBot?.startTime || Date.now());

    const h = Math.floor(uptime / 3600000);
    const m = Math.floor((uptime % 3600000) / 60000);

    const embed = new EmbedBuilder()
      .setColor("#57F287")
      .setTitle(`${global.botname} Info`)
      .addFields(
        { name: "Uptime", value: `${h}h ${m}m`, inline: true },
        { name: "Servers", value: `${client.guilds.cache.size}`, inline: true },
        { name: "Users", value: `${client.users.cache.size}`, inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
~~~

## ˚. 11. Handlers

### WhatsApp Handler

Location:

~~~txt
system/bot/whatsapp/handler.js
~~~

Handler flow:

1. Before hooks: loops through all plugins and calls `before()` if available, without command check.
2. Prefix matching: checks matching prefix, such as `.`, `#`, `!`, `/`, or custom prefix.
3. Per-plugin before: calls `before()` per plugin; if it returns `true`, the plugin is skipped.
4. Permission check: checks owner, admin, premium, botAdmin, group, and limit.
5. Cooldown check: checks per-user per-command cooldown, default 5 seconds.
6. Spam detection: detects spam behavior.
7. Execution: runs `plugins.run(m, extra)`.
8. Error handling: logs error to owner and increments error counter.
9. Auto-disable: if error count reaches 5 or more, the command is blocked.

Before hook example:

~~~js
module.exports = {
  before: async (m, { sock, isOwner, isPrems }) => {
    // Return true to skip command processing
    // Return false or undefined to continue
    if (someCondition) return true;
  },

  run: async (m, ctx) => {
    // Only executed if before returns false
  },
};
~~~

Spam detection behavior:

- 3 times: notify
- 5 times: hold
- 10 times: permanent
- 15 times: banned

Typo correction:

If a command is not found, the bot suggests a similar command using Levenshtein distance. The user can reply with a number to run the suggested command.

### Telegram Handler

Location:

~~~txt
system/bot/telegram/handler.js
~~~

Handler behavior:

- Auto-quote middleware: all replies automatically quote the original message
- Group management: welcome, goodbye, verification, anti-spam, anti-flood, anti-arab, anti-tagall
- Before hooks: loops through all plugins and calls `before()`
- Command parsing: parses `/command args` from text
- Plugin execution: runs `plugin.run(ctx, args)`
- Error handling: logs error and auto-disables after 5 errors

### Discord Handler

Location:

~~~txt
system/bot/discord/handler.js
~~~

Handler behavior:

- `clientReady`: registers slash commands and sets presence
- `interactionCreate`: handles slash commands
- Guild check: if the bot has not joined the server, sends an invite link
- Command execution: runs `command.execute(interaction)`
- Button handling: delegates to `handleButton()` on the play command
- Error handling: logs error and auto-disables after 5 errors

## ˚. 12. How to Add a Plugin

### WhatsApp

1. Create a `.js` file in `system/bot/whatsapp/plugins/` or inside a category subfolder.
2. Export the plugin with the correct structure.
3. The plugin will be detected automatically by the chokidar watcher.

Example:

~~~js
// system/bot/whatsapp/plugins/tools/hello.js
let handler = async (m, { sock, text }) => {
  const name = text || "World";
  m.reply(`Hello, ${name}!`);
};

handler.help = ["hello"];
handler.tags = ["tools"];
handler.command = ["hello"];

module.exports = handler;
~~~

### Telegram

1. Create a `.js` file in `system/bot/telegram/plugins/`.
2. Export the plugin with the Telegram structure.

Example:

~~~js
// system/bot/telegram/plugins/hello.js
module.exports = {
  help: "Say hello",
  command: ["hello"],
  tags: ["general"],
  run: async (ctx, args) => {
    const name = args || "World";
    await ctx.reply(`Hello, ${name}!`);
  },
};
~~~

### Discord

1. Create a `.js` file in `system/bot/discord/commands/`.
2. Export the command with the Discord structure.

Example:

~~~js
// system/bot/discord/commands/hello.js
module.exports = {
  name: "hello",
  description: "Say hello",
  options: [
    {
      name: "name",
      description: "Name to greet",
      type: 3,
      required: false,
    },
  ],
  async execute(interaction) {
    const name = interaction.options.getString("name") || "World";
    await interaction.reply(`Hello, ${name}!`);
  },
};
~~~

## ˚. 13. Cookies

### Required Cookies

The `cookies.txt` file uses the Netscape HTTP Cookie File format and is stored in the project root:

~~~txt
Akano-Bot/cookies.txt
~~~

Example format:

~~~txt
# Netscape HTTP Cookie File
.domain.com	TRUE	/	FALSE	1234567890	cookie_name	cookie_value
.instagram.com	TRUE	/	TRUE	1234567890	sessionid	xxxxx
~~~

### Platforms That Require Cookies

| Platform | Required? | Notes |
|---|---|---|
| Instagram | Yes | Required for private accounts and slides/carousel |
| Facebook | Sometimes | Required for videos that need login |
| TikTok | No | Works without cookies |
| YouTube | No | Works without cookies |
| X/Twitter | Sometimes | Required for age-restricted content |
| Pinterest | No | Works without cookies |

> Instagram slide downloads require cookies because they use gallery-dl.

### Cookie File Location

~~~txt
Akano-Bot/
  cookies.txt
~~~

The cookie path is accessed inside plugins like this:

~~~js
const cookiePath = path.join(__dirname, "../../../../cookies.txt");
~~~

### How to Get Cookies

1. Install the browser extension "Get cookies.txt LOCALLY".
2. Log in to the desired platform.
3. Click the extension.
4. Export the cookies.
5. Save the file as `cookies.txt`.
6. Place it in the project root directory.

### Cookie Expiration

- Cookies usually expire after around 30 days.
- Update cookies if downloads fail with errors such as "login required".

## ˚. 14. Downloader

### gallery-dl

Install:

~~~bash
pip3 install --break-system-packages -U gallery-dl
~~~

Configuration notes:

- Requires `cookies.txt` for Instagram slides.
- The `gallery-dl` binary must be available in PATH.

Usage in code:

~~~js
// system/scrapers/src/ytdpl.js
const downloader = global.scraper.ytdpl;

// Get metadata
const metadata = await downloader.getMetadata(url, {
  cookies: cookiePath,
});

// Download
const result = await downloader.download(url, {
  cookies: cookiePath,
});

// Result format:
// {
//   directory: "/tmp/dl_xxx",
//   files: ["/tmp/dl_xxx/file.mp4"]
// }

// Cleanup
await downloader.cleanup(result.directory);
~~~

Reason cookies are required:

`gallery-dl` needs cookies to access Instagram content that requires login, including carousel or slide posts.

### yt-dlp

Install:

~~~bash
pip3 install --break-system-packages -U yt-dlp
~~~

Usage:

- YouTube
- TikTok
- Facebook
- X/Twitter

The downloader wrapper in `ytdpl.js` can auto-install the binary if it is not found.

## ˚. 15. FAQ

### Q: The bot does not respond?

A: Make sure tokens in `settings.js` are correct. Check `system/logerror.txt` for error logs.

### Q: Plugins are not detected?

A: Make sure the plugin file is in the correct folder and has `module.exports`. Check the console for loading errors.

### Q: Cookies are invalid?

A: Update `cookies.txt` with new cookies from your browser. Cookies usually expire after around 30 days.

### Q: Telegram bot logged out?

A: Generate a new token from @BotFather and update it in `settings.js` at `global.settings.telegram.token`.

### Q: Discord login failed?

A: Make sure the token is valid in `settings.js` at `global.settings.discord.token`. Also make sure the bot has been invited to the server.

### Q: WhatsApp logged out?

A: Delete the `system/bot/whatsapp/sessions/` folder, restart the bot, and pair again.

### Q: Dependency error?

A: Run `npm install` again. Make sure Node.js is version 18 or above. Make sure FFmpeg is installed.

### Q: yt-dlp not found?

A: Run:

~~~bash
pip3 install --break-system-packages -U yt-dlp
~~~

Check with:

~~~bash
yt-dlp --version
~~~

### Q: gallery-dl not found?

A: Run:

~~~bash
pip3 install --break-system-packages -U gallery-dl
~~~

Check with:

~~~bash
gallery-dl --version
~~~

### Q: A plugin errored 5 times and stopped working?

A: Plugins are automatically disabled after 5 errors. Restart the bot to re-enable them, or fix the error in the plugin.

## ˚. 16. Troubleshooting

| Error | Cause | Solution |
|---|---|---|
| Stream Errored | WhatsApp connection interrupted | Bot auto-restarts; check internet connection |
| Connection Closed | WhatsApp session expired | Delete sessions and pair again |
| Bad MAC | Corrupt session | Delete sessions and pair again |
| EPERM: operation not permitted | Session file locked | Restart bot; retry logic exists in `auth.js` |
| yt-dlp not found | Binary not installed | `pip3 install -U yt-dlp` |
| gallery-dl not found | Binary not installed | `pip3 install -U gallery-dl` |
| DRM protected | DRM content | Cannot be downloaded; skip |
| File size exceeds limit | File too large | Check `max_uploud` in settings, default 50MB |
| Instagram carousel contains only images | yt-dlp cannot download images | Bot falls back to gallery-dl |
| `_fetchTikTokNative is not a function` | Race condition during hot-reload | Safety check exists in `ytdpl.js` |
| Cannot find module | Path resolution error | Restart bot; chokidar will reload |
| Token length < 20 | Invalid token | Generate a new token from the platform |
| login required | Cookie expired | Update `cookies.txt` |
| 403 Forbidden | Invalid cookie | Re-export from browser |
| rate-overlimit | API rate limit | Does not need to be shown; bot will auto-retry |
| Header overflow | Corrupt Gemini session | Session is cleared automatically in plugin |

## ˚. 17. Closing

> Akano Bot is still in Beta. This documentation was created based on the source code of the current version and may change at any time as the project continues to develop.