# Akano Bot

> **Languages:** [English](README.md) · [Bahasa Indonesia](README.id-ID.md)

Multi-platform chatbot for **WhatsApp**, **Telegram**, and **Discord** — one codebase, modular plugin system.

![Version](https://img.shields.io/badge/Version-1.1.0-808080?style=flat)
![License](https://img.shields.io/badge/License-Custom-808080?style=flat)
![Node](https://img.shields.io/badge/Node.js-%3E%3D18-808080?style=flat)

> [!IMPORTANT]
> Currently in **Beta**. Structure and features may change at any time.

## Design Goals

- **Rapi** — consistent structure across the three platforms; one way of doing things.
- **Minimalist** — small surface area, one import for everything, no platform-specific glue in plugins.
- **Easy to maintain** — shared core, a single `define()` API, hot-reload with chokidar.
- **Easy to add plugins** — one file, one `define()`, works on WhatsApp, Telegram, and Discord.

## Features

| Feature | Description |
|---|---|
| AI Chat | Gemini-powered conversations (WA / TG / DC) |
| Media Downloader | YouTube, TikTok, Instagram, Facebook, X/Twitter, Pinterest |
| Discord Music Player | Play YouTube/Spotify with queue, autoplay, lyrics |
| **YouTube Music Experience** | Full YTM library: liked songs, playlists, charts, moods & genres, radio — signed in with your own account, no Google API key |
| Moderation | Kick, ban, mute, warn, promote/demote, hidetag, tagall |
| Group Management | Welcome, anti-link, anti-virtex, anti-delete, muting |
| Sticker Maker | Image/video → sticker |
| Utility | Ping, calculator, poll, AFK, view-once reader, server info |
| Images | Image generation/editing (Discord) |
| Plugin System | Auto-loaded, hot-reload with chokidar |
| Safety | Per-command cooldown, daily rate limit, memory watchdog |

## Requirements

- Node.js **18+** (tested on 26)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) — `pip3 install -U yt-dlp`
- [yt-dlp-ejs](https://github.com/yt-dlp/yt-dlp-ejs) — `pip3 install -U yt-dlp-ejs` (required for YouTube downloads)
- [gallery-dl](https://github.com/mikf/gallery-dl) — `pip3 install -U gallery-dl`
- FFmpeg — `pkg install ffmpeg` (Termux) / `sudo apt install ffmpeg` (Linux)

## Installation

```bash
git clone https://github.com/kutashiakano/Akano-Bot.git
cd Akano-Bot
npm install
```

## Configuration

Secrets are read from environment variables. Create **`~/.akano-env`** (it is sourced automatically by the launcher) or just export them:

```bash
# ~/.akano-env
DISCORD_TOKEN=your_discord_bot_token     # required for Discord
TELEGRAM_TOKEN=your_telegram_token       # required for Telegram (from @BotFather)
OWNER=6281234567890                      # owner WhatsApp number (comma-separated for multiple)
DC_OWNER=your_discord_user_id            # owner for owner-gated Discord commands, optional
TG_OWNER=your_telegram_user_id           # owner for owner-gated Telegram commands, optional
MEM_LIMIT_MB=768                         # memory watchdog limit (MB), optional
DC_DAILY_LIMIT=200                       # Discord daily command limit per user, optional
YT_SESSION_KEY=4e6f...                   # encrypts per-user YouTube OAuth credentials (openssl rand -hex 16), optional
```

A template is provided in [.env.example](.env.example).

### WhatsApp pairing

Run the bot once for WhatsApp and scan the QR code with your phone. Session is saved under `system/bot/whatsapp/sessions/` — to re-pair, delete that folder and restart.

### Cookies (optional)

Instagram, Facebook and X downloads may require a `cookies.txt` in the project root using the [Netscape HTTP Cookie File format](https://github.com/kairi003/Get-cookies.txt-LOCALLY). Cookies expire after ~30 days — re-export when downloads fail with "login required".

## Running

```bash
npm start          # all platforms
npm run wa         # WhatsApp only
npm run dc         # Discord only
npm run tg         # Telegram only
npm run help       # show CLI help
```

CLI flags: `node index.js --all | --whatsapp | --telegram | --discord | --help`

`index.js` auto-restarts on crash (max 5 attempts in 5 minutes, exponential backoff).

### Docker (recommended, no setup)

A prebuilt image is published automatically to **GHCR** on every push — no local build needed:

1. Copy `.env.example` → `.env` and fill in your tokens.
2. Run:

```bash
docker compose pull
docker compose up -d
```

or a single command:

```bash
docker run -d --name akano-bot --restart unless-stopped \
  -v $PWD/system/database:/app/system/database \
  -v $PWD/system/bot/whatsapp/sessions:/app/system/bot/whatsapp/sessions \
  --env-file .env \
  ghcr.io/kutashiakano/akano-bot:latest
```

Image: `ghcr.io/kutashiakano/akano-bot:latest` (linux/amd64 + arm64, auto-built by GitHub Actions).
Building yourself: `docker build -t akano-bot . && docker run ... akano-bot`.

### Production with PM2

```bash
npm i -g pm2
pm2 start pm2.config.cjs   # restarts on crash, 1GB memory cap
pm2 save && pm2 startup
```

## Structure

```
index.js                          # Entry point: crash auto-restart
main.js                           # Launcher & CLI parser
settings.js                       # Boot: globals, platforms, scrapers
pm2.config.cjs                    # PM2 production config
.env.example                      # Environment variable template
system/
  core/                           # Shared core (merged utils + core)
    context.js                    #   AppContext (DI access to db/settings/owner/...)
    watchdog.js                   #   Memory watchdog (MEM_LIMIT_MB)
    heavy.js                      #   heavyExec(): worker-thread runner
  bot/
    plugin.js                      #   define(): unified 3-platform plugin API
    format.js                      #   Akano-style formatters (emoji/status/sec/panel)
    whatsapp/  lib/ + plugins/    # Baileys-based
    telegram/  handler.js + plugins/  # Telegraf-based
    discord/   handler.js + plugins/  # discord.js-based
      plugins/tools    settings, status, poll, ...
      plugins/music    play, queue, autoplay, lyrics, ...
      plugins/images   image generation/editing
  scrapers/                       # yt-dlp, gemini, spotify, ytmusic, ...
  database/                       # SQLite (database.db) + JSON backup + error log
  image/                          # Static assets (e.g. avatar)
```

## YouTube Music — Deep Dive (Discord)

The bot implements a **full YouTube Music experience** that works with **your own YouTube account** — without any Google API key or Google Cloud Console project.

### How the sign-in works (TV OAuth)

1. The user runs `/account login` in Discord. A pairing code is generated using the **YouTube TV device flow** (the same OAuth flow a smart TV uses).
2. The user visits `youtube.com/pair` and enters the code.
3. The resulting OAuth tokens are stored **per-user**, encrypted with `YT_SESSION_KEY`, inside the database.
4. The bot refreshes the token automatically when it expires (`refreshAccessToken` from youtubei.js — the client id/secret are scraped from youtube.com/tv, so **no Google Console setup is needed**).

> [!NOTE]
> The TV scope grants full access (`youtube` + `youtube-paid-content`). Like, playlists and radio all work with this token. This was discovered by calling the raw `youtubei/v1` endpoints with a Bearer token — the official youtubei.js music parser ignores TV renderers (`tileRenderer`), which is why the plain `ytmusic.liked` API used to return empty.

### What the user can do

| Feature | Command | Notes |
|---|---|---|
| Sign in / out | `/account login`, `/account logout` | 5-minute pairing window |
| Private library panel | `/account` | Ephemeral — only visible to the owner; every interaction is owner-gated |
| Liked songs | `/account liked` | Streamed straight from your YouTube Music liked videos |
| Your playlists | `/account playlists` | Browse → open → play or add songs |
| Like/unlike from Discord | Like button on `/account` panel and `/ym` tracks | `like/like` endpoint, params `like` / `indifferent` |
| Add to playlist | Add button in the library panel | `browse/edit_playlist` + `ACTION_ADD_VIDEO` |
| Charts | `/ym charts` | Guest browse of `FEmusic_charts` (Trending 20, Daily Top Music Videos, Top 100, …) |
| Moods & genres | `/ym moods` | Chill, Energize, Focus, Party, Sad, Sleep, Workout + genre tiles → playlist picker |
| Radio | `/ym radio` | Seamless radio built from the current track or any search query (`next` endpoint + `RDAMVM` playlist) |
| Search your library | `/lib` | Routes playlist/liked/charts through the TV API when signed in |

### How it works under the hood (`system/scrapers/src/ytsession.js`)

- **`tvReq`** — raw `https://www.youtube.com/youtubei/v1/...` POST with `Authorization: Bearer <token>`, `TVHTML5` client context and a Firefox UA. Auto-refreshes on HTTP 401.
- **`tvRaw`** — generic `browse` wrapper (library, playlists, `VL<id>` playlist detail).
- **`walk` / `tileTitle` / `findDeep`** — JSON walkers that collect `tileRenderer` nodes the way the real TV app renders them.
- **`likes`, `plists`, `plist`** — liked songs, playlist list (IDs are returned without the `VL` prefix), and a single playlist's tracks.
- **`like`, `addPl`** — like/unlike a song, add a video to one of your playlists.
- **`moods`, `moodPls`** — guest `WEB_REMIX` browse with the public ytmusicapi key; mood tiles use `musicNavigationButtonRenderer` (title lives in `buttonText`, and every mood shares one `browseId` — the **params** is the actual selector).
- **`radio`** — `next` endpoint with `playlistId: RDAMVM<videoId>`; the seed track is filtered out before enqueueing.
- **`newPl`** — playlist **creation** is deliberately blocked by Google for TV devices (`400 Precondition check failed`), so it returns a friendly explanation instead.

> [!WARNING]
> Both the web (URL login) and device (code entry) flows from the old Google Console setup were removed. If your fork still references `YT_OAUTH_CLIENT_ID` / `YT_OAUTH_CLIENT_SECRET` / `YT_OAUTH_FLOW`, those no longer exist — delete them.

## Discord Music Player — Deep Dive

### Sources

| Input | What happens |
|---|---|
| YouTube / YTM URL | Played directly via yt-dlp |
| **Spotify track link** | Resolved **smart**: the track metadata (title + artist) is looked up on YouTube Music and the YTM result is played — no Spotify audio needed |
| Spotify album/playlist | Fetched via the Spotify API, then each track is resolved on YouTube Music |
| SoundCloud / direct audio link | Played directly |
| Plain text query | Searched on YouTube, YouTube Music, Spotify and SoundCloud; you pick from a result menu |

### Playback engine (`system/bot/discord/plugins/music/engine.js`)

- Queue per guild with volume, loop (off/track/queue), shuffle, autoplay with genre presets, and lyrics.
- yt-dlp downloads the **current** track on demand and **pre-downloads the next one** while the current is playing (cache avoids re-downloading).
- Voice connection is resilient: on disconnect it re-negotiates automatically; the connection is **reused** when already `Ready` and queue creation is atomic (`qLocks`), so two commands fired at the same time (`/p` + `/ym radio`) can never fight over the same voice channel; `playNext` is mutex-protected (`nxtBusy`/`nxtPending`) so tracks are never skipped.
- Player state (current song, queue, volume, loop, shuffle, autoplay, filters) is saved to disk and **restored after a restart**.

### Commands

```
/p <query|url>    Play music (smart Spotify links supported)
/queue            Show / manage the queue
/skip             Skip current track
/stop             Stop & leave voice
/autoplay <genre> Toggle autoplay with genre presets
/lyrics           Current song lyrics
/volume <0-100>   Set volume
/np               Now playing
/search           Search and pick a track
/lib playlists | liked | picks | search
```

## Media Downloaders

All media downloads run through `system/scrapers/` — one engine per job, auto-managed:

| Engine | Used for | Implementation |
|---|---|---|
| **yt-dlp** | YouTube, TikTok, Instagram, Facebook, X/Twitter, Pinterest — video & audio | `system/scrapers/src/ytdpl.js` — binary checked at boot and auto-installed via pip on first run (`yt-dlp`, `yt-dlp-ejs`, `gallery-dl`); includes a native TikTok fallback |
| **gallery-dl** | Image galleries & booru sites | same `ytdpl.js` (`galleryDlBin`, default `gallery-dl`) |
| **YouTube Music API** | Signed-in YTM: liked songs, playlists, charts, moods & genres, radio | `system/scrapers/src/ytmusic.js` — uses your TV-OAuth session |
| **YouTube TV OAuth** | Account sign-in without Google API keys | `system/scrapers/src/ytsession.js` — see the YouTube Music Deep Dive below |

Notes:

- Missing binaries are auto-installed with `pip install --break-system-packages -U yt-dlp yt-dlp-ejs gallery-dl`; you can also install them manually.
- Instagram, Facebook and X may require a browsable `cookies.txt` in the project root — refresh it every ~30 days.
- Platform surface: WhatsApp & Telegram use the downloader plugins (`system/bot/whatsapp/plugins/downloader/`, `system/bot/telegram/plugins/downloader/`); Discord uses `/p` + `/search` for playback and the `/ym` family (deep dives below).

## Adding a Plugin

One unified API for all three platforms. `define({...})` normalizes metadata (name, aliases, gates, cooldown, options) and adapts it to each platform — the same plugin file shape works everywhere.

**Unified (recommended)** — put it in any platform's plugin folder:

```js
const { define } = require("../../../plugin");   // system/bot/plugin.js

module.exports = define({
  name: ["hello", "hi"],          // command + aliases
  category: "example",            // menu grouping (WA) / module (DC)
  help: "Says hello",
  owner: false,                   // owner-only gate
  premium: false,                 // premium-only gate
  group: false,                   // group-only gate
  admin: false,                   // group admin gate (TG/DC)
  cooldown: 3000,                 // ms (TG/DC)
  options: [{ name: "name", desc: "Who to greet", required: false }],  // Discord slash args
  example: "/hello world",
  run: async ({ platform, args, text, user, reply, fmt }) => {
    // platform: "whatsapp" | "telegram" | "discord"
    await reply(`${fmt.emoji("done")} Hello, ${args[0] || args.name || "World"}!`);
  },
});
```

`fmt` exports the Akano-style formatters: `status()`, `emoji()`, `sec()`, `panel()`, `list()`, `toTime()`, `matcher()` — also available as `Utils` inside the context, so every plugin gets `Utils` for free.

Alias keys are accepted too: `usage` (aliases), `use` (usage/example line), `hidden`, `category`, and `async` as the handler (`define({ usage, async: (ctx) => {} })`).

The unified context is the same on every platform: `args` (positional array), `named` (mapped from `options`, so `options` also work on WhatsApp/Telegram), `text`, `user`, `reply`, `client`/`sock` (platform client — Baileys socket, Telegram bot API or discord.js client), `Utils` (= `fmt`), `setting`, `Config`, plus `fmt`. Required `options` are validated on all platforms (Discord enforces them natively).

On Discord the builders ship on `client`/`sock` for compact imports: `mbuilder` (`StringSelectMenuBuilder`), `bbuilder` (`ButtonBuilder`), `abuilder` (`ActionRowBuilder`), `ebuilder` (`EmbedBuilder`), `modal`, `textInput` — i.e. `const { mbuilder, abuilder } = sock` instead of `require("discord.js")`.

### SDK (`system/bot/sdk`)

A unified SDK combining the three platforms — plugins only need one import:

```js
const { define, Utils, mbuilder, abuilder, Database, wa, tg, dc, libs } = require("../../../sdk");

module.exports = define({
  usage: ["nowplaying"],                  // alias keys work (async/use/hidden too)
  category: "music",
  async: async ({ args, named, reply, sock }) => {
    // ctx from define(): args, named (from options), text, user, reply,
    // client/sock (Baileys socket, Telegram API or discord.js client), Utils (= fmt), setting, Config
  },
});
```

SDK exports: `define`, `Utils` (= `fmt`), `fmt`, `settings()`, `config()`, `owners()`, `Database`/`getDB()`, platform accessors `wa()`/`ok()`/`tg()`/`dc()` (live instances: Baileys socket, Telegraf bot, discord.js client), `libs()` (lazy `{ baileys, telegraf, discord }`), and Discord builders `mbuilder`/`bbuilder`/`abuilder`/`ebuilder`/`modal`/`textInput`.

Per-platform folders still accept the classic shapes below.

**WhatsApp** — `system/bot/whatsapp/plugins/<category>/hello.js`

```js
let handler = async (m, { text }) => {
  m.reply(`Hello, ${text || "World"}!`);
};

handler.help = ["hello"];
handler.tags = ["tools"];
handler.command = ["hello"];

module.exports = handler;
```

**Telegram** — `system/bot/telegram/plugins/hello.js`

```js
module.exports = {
  help: "Say hello",
  command: ["hello"],
  tags: ["general"],
  run: async (ctx, args) => {
    await ctx.reply(`Hello, ${args || "World"}!`);
  },
};
```

**Discord** — `system/bot/discord/plugins/tools/hello.js`

```js
module.exports = {
  name: "hello",
  description: "Say hello",
  options: [],
  async execute(interaction) {
    await interaction.reply(`Hello, ${interaction.user}!`);
  },
};
```

See existing plugins for full metadata (permissions, cooldown, limits, examples).

## Naming conventions

The codebase intentionally favours **short identifiers** (e.g. `mkQueue`, `tvReq`, `np`, `svState`, `plist`) — the full descriptive names live in this README and in commit history. When contributing, prefer short names unless the context genuinely needs a long one.

## Common Issues

| Problem | Fix |
|---|---|
| WhatsApp logged out | Delete `system/bot/whatsapp/sessions/` and pair again |
| "login required" on downloads | Refresh `cookies.txt` |
| yt-dlp/gallery-dl not found | `pip3 install -U yt-dlp` / `pip3 install -U gallery-dl` |
| YouTube 403 when playing music | Update yt-dlp **and** install `pip3 install -U yt-dlp-ejs` (required since YouTube's SABR/PO-token rollouts) |
| Plugin disabled after errors | Plugins auto-disable after repeated errors — restart to re-enable |
| Discord login failed | Token invalid, or bot not invited to the server |
| File too large to upload | Check `max_uploud` in settings (default 50MB) |
| Bot keeps restarting (OOM) | Increase `MEM_LIMIT_MB` or lower per-process load |
| Voice stuck in "Signalling" | Usually a double-join race — fixed upstream: use `mkQueue`/`playPanel` (both are atomic now), or just stop and `/p` again |
| `/ym` says "sign in first" | Run `/account login` once; charts and moods work without login, radio needs an account |

## License

Custom license (see [LICENSE](LICENSE)).

- Free to use, modify, and sell
- **Credit required** — attribute the original author (kutashiakano/Akano-Bot)
- **No verbatim copies** — sold or distributed versions must have meaningful changes
