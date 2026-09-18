# Akano-Bot — Multi-Platform WhatsApp Bot, Telegram Bot & Discord Bot

> **WhatsApp bot + Telegram bot + Discord bot in one codebase.** Built with **Baileys** (WhatsApp), **grammY** (Telegram) and **discord.js** (Discord). AI chat, media downloader, YouTube Music, Discord music player, group management, moderation, sticker maker and modular plugin system — production-ready multi-platform bot framework.

![Version](https://img.shields.io/badge/Version-1.1.0-808080?style=flat)
![Node](https://img.shields.io/badge/Node.js-%3E%3D18-808080?style=flat)
![Baileys](https://img.shields.io/badge/WhatsApp-Baileys-25D366?style=flat)
![Telegram](https://img.shields.io/badge/Telegram-grammY-26A5E4?style=flat)
![Discord](https://img.shields.io/badge/Discord-discord.js-5865F2?style=flat)
![License](https://img.shields.io/badge/License-Custom-808080?style=flat)
![Platform](https://img.shields.io/badge/Platform-Multi--Platform-808080?style=flat)

**Keywords:** `whatsapp bot` `telegram bot` `discord bot` `baileys` `multi-platform bot` `whatsapp bot framework` `telegram bot framework` `discord bot framework` `ai chat bot` `gemini bot` `media downloader` `youtube downloader` `tiktok downloader` `instagram downloader` `group management` `moderation bot` `music bot` `youtube music` `automod` `sticker bot`

> **Language:** [English](README.md) · [Bahasa Indonesia](readme-id.md) · [Docs: Adding a Plugin](docs/adding-a-plugin.id.md) · [Docs: Menambahkan Plugin](docs/adding-a-plugin.md)

---

## Quick Start — WhatsApp Bot, Telegram Bot, Discord Bot

```bash
git clone https://github.com/kutashiakano/Akano-Bot.git
cd Akano-Bot
npm install
cp .env.example ~/.akano-env && nano ~/.akano-env
npm start
```

Dashboard → `http://host:port`

```bash
npm start        # run all platforms (WhatsApp + Telegram + Discord)
npm run wa       # WhatsApp bot only
npm run tg       # Telegram bot only
npm run dc       # Discord bot only
node . --all     # same as npm start
```

---

## Requirements

| Dependency | Version | Install | Notes |
|---|---|---|---|
| **Node.js** | `>=18` (tested on 22 / 26) | `pkg install nodejs` / `nvm` | Required |
| **Python** | `3.10+` | `pkg install python` | For yt-dlp / gallery-dl |
| **FFmpeg** | latest | `pkg install ffmpeg` | Audio / sticker conversion |
| **yt-dlp** | latest | `pip3 install -U yt-dlp` | YouTube, TikTok, FB, X, IG |
| **yt-dlp-ejs** | latest | `pip3 install -U yt-dlp-ejs` | YouTube SABR / PO-token (required) |
| **gallery-dl** | latest | `pip3 install -U gallery-dl` | Pinterest, galleries, TikTok photos |
| **curl_cffi** | latest | `pip3 install -U curl_cffi` | TikTok impersonation |

> Missing Python binaries are auto-installed on first run via `system/scrapers/src/ytdpl.js` (`pip install --break-system-packages -U yt-dlp yt-dlp-ejs gallery-dl curl_cffi`).

---

## About — Multi-Platform Bot Framework

**Akano-Bot** is a unified **WhatsApp bot framework**, **Telegram bot** and **Discord bot** sharing one core, one plugin API and one database.

- **WhatsApp:** powered by **Baileys** (`@whiskeysockets/baileys` via `@itsliaaa/baileys`). QR / pairing code, multi-file auth, in-memory store, anti-delete, verification, group automation.
- **Telegram:** powered by **grammY**. Command handler, group manager, welcome canvas, inline downloader.
- **Discord:** powered by **discord.js** + **@discordjs/voice**. Slash commands, music queue, YouTube Music account linking, autoplay, lyrics.
- **One plugin API:** `define()` works on all three platforms — same metadata, same gates (`owner`, `group`, `admin`, `premium`, `cooldown`), same `reply()`.

Use it as a **WhatsApp group management bot**, **Telegram moderation bot**, **Discord music bot**, **AI chat bot** (Gemini), **media downloader bot** (YouTube, TikTok, Instagram, Facebook, X/Twitter, Pinterest, SoundCloud) or as a starter for any custom multi-platform automation.

---

## Features

| Category | Highlights |
|---|---|
| **AI Chat Bot** | Gemini on WhatsApp / Telegram / Discord, rich AI messages, conversation memory |
| **Media Downloader Bot** | YouTube, TikTok (video + photo carousel), Instagram, Facebook, X/Twitter, Pinterest, SoundCloud, direct audio links |
| **Discord Music Bot** | YouTube / YouTube Music / Spotify / SoundCloud playback, queue, volume, loop, shuffle, autoplay, lyrics, persistent state |
| **YouTube Music Bot** | Full YouTube Music account via TV OAuth — liked songs, playlists, charts, moods & genres, radio, like/unlike |
| **Moderation Bot** | kick, ban, mute, warn, promote, demote, hidetag, tagall, antilink, antivirtex, anti-delete |
| **Group Management Bot** | welcome/goodbye with thumbnail, promote/demote detection, verification (captcha ephemeral), join-request handling |
| **Sticker Bot** | image/video → WebP sticker with packname/author, `node-webpmux` + `fluent-ffmpeg` |
| **Utility** | ping, calculator, poll, AFK, server info, sub-bot (jadibot) |
| **Security** | per-command cooldown, spam detection, banned users, daily Discord rate limit, memory watchdog |
| **Dashboard** | Web UI at `http://host:port` — groups, plugins, logs (SSE), database, bots status |
| **Plugin System** | Auto-load, sort & hot-reload via `chokidar`, unified `define()` API |
| **Session & Proxy** | Multi-file auth, optional `WA_PROXY` / `HTTPS_PROXY`, `https-proxy-agent` support |

---

## Libraries Used

| Library | Purpose | Used For |
|---|---|---|
| **baileys** (`@itsliaaa/baileys`) | WhatsApp Web API | WhatsApp bot core, pairing, messaging |
| **grammy** | Telegram Bot Framework | Telegram bot handler |
| **discord.js** | Discord API | Slash commands, embeds, voice |
| **@discordjs/voice** + **@discordjs/opus** | Discord voice | Music playback per guild |
| **youtubei.js** | YouTube inner API | TV OAuth, YouTube Music deep API |
| **yt-dlp** + **yt-dlp-ejs** + **gallery-dl** | Media extraction | YouTube/TikTok/IG/FB/X/Pinterest downloaders |
| **fluent-ffmpeg** + **node-webpmux** | Media conversion | Sticker / audio conversion |
| **jimp** | Image processing | Resize / thumbnail (`sock.resize`) |
| **qrcode-terminal** | QR display | WhatsApp QR in terminal |
| **pino** | Logger | Baileys silent logger (`level: silent`) |
| **chokidar** | File watcher | Hot-reload plugins |
| **moment-timezone** | Time formatting | Group events, welcome time |
| **awesome-phonenumber** | Phone parsing | Contact vCard formatting |
| **axios** + **node-fetch** | HTTP | Scrapers, proxy fetch |
| **https-proxy-agent** + **proxy-from-env** | Proxy | `WA_PROXY` handling |
| **cfonts** + **gradient-string** + **chalk** | CLI UI | Banner, colored logs |

---

## Installation

### Standard — Linux / macOS / Windows (WSL)

```bash
git clone https://github.com/kutashiakano/Akano-Bot.git
cd Akano-Bot
npm install
pip3 install -U yt-dlp yt-dlp-ejs gallery-dl curl_cffi
cp .env.example ~/.akano-env
nano ~/.akano-env   # fill tokens
npm start
```

### Termux — Android WhatsApp Bot Hosting

```bash
pkg update && pkg upgrade -y
pkg install nodejs python ffmpeg git -y
pip install -U yt-dlp yt-dlp-ejs gallery-dl curl_cffi
git clone https://github.com/kutashiakano/Akano-Bot.git
cd Akano-Bot
bash install.sh
npm start
```

> `install.sh` installs deps and prepares `~/.akano-env` for Termux.

### Docker — WhatsApp Bot + Telegram Bot + Discord Bot (GHCR)

```bash
cp .env.example .env
docker compose -f deploy/docker-compose.yml pull && docker compose -f deploy/docker-compose.yml up -d
docker compose -f deploy/docker-compose.yml logs -f
```

Single command:

```bash
docker run -d --name akano-bot --restart unless-stopped \
  -v $PWD/system/database:/app/system/database \
  -v $PWD/system/bot/whatsapp/sessions:/app/system/bot/whatsapp/sessions \
  --env-file .env \
  ghcr.io/kutashiakano/akano-bot:latest
```

- Image: `ghcr.io/kutashiakano/akano-bot:latest` (linux/amd64 + arm64, auto-built)
- Build locally: `docker build -f deploy/Dockerfile -t akano-bot . && docker run ... akano-bot`

deploy/Dockerfile uses `node:24-bookworm-slim` + `python3 venv` with `yt-dlp`, `yt-dlp-ejs`, `gallery-dl` preinstalled.

---

## Configuration

Secrets are read from environment. Create **`~/.akano-env`** or export directly.

```bash
# ~/.akano-env
DISCORD_TOKEN=your_discord_bot_token
TELEGRAM_TOKEN=your_telegram_bot_token
ID_OWNER=YOUR_PHONE_NUMBER,1723113802,123456789
TELEGRAM_OWNER_ID=1723113802
DISCORD_OWNER_ID=123456789
YT_SESSION_KEY=your_random_hex_key
DASHBOARD_KEY=your_dashboard_key
MEM_LIMIT_MB=768
```

| Variable | Required For | Default | Notes |
|---|---|---|---|
| `DISCORD_TOKEN` | Discord bot | — | https://discord.com/developers → Bot → Token |
| `TELEGRAM_TOKEN` | Telegram bot | — | Talk to @BotFather → /newbot |
| `ID_OWNER` | **all platforms (unified)** | — | `phone, telegramId, discordId` comma-separated |
| `TELEGRAM_OWNER_ID` | Telegram | fallback `ID_OWNER` | Telegram owner numeric ID |
| `DISCORD_OWNER_ID` | Discord | fallback `ID_OWNER` | Discord owner numeric ID |
| `YT_SESSION_KEY` | YouTube Music | `akano` | `openssl rand -hex 16` — encrypts per-user OAuth |
| `DASHBOARD_KEY` | Dashboard | auto-generated | Login for `http://host:port` |
| `MEM_LIMIT_MB` | watchdog | `768` | Heap limit before restart |
| `DC_DAILY_LIMIT` | Discord limits | `200` | Commands per user per day |
| `WA_PROXY` / `HTTPS_PROXY` | WhatsApp proxy | — | `http://host:port` for Baileys + fetch |
| `NO_PROXY` | proxy bypass | `localhost,127.0.0.1` | Comma list |
| `YT_OAUTH_CLIENT_ID` / `YT_OAUTH_CLIENT_SECRET` | YT web OAuth | — | Optional Google Cloud OAuth (web flow) |
| `OAUTH_REDIRECT_PORT` | OAuth callback | `3200` | Local callback server for web login |

Template: `.env.example`. Empty `ID_OWNER` = no owner gate (open).

### WhatsApp Pairing

1. Run bot once: `npm run wa` or `npm start`
2. Choose QR or Pairing Code (`CODE_PAIRING=AKANOBOT`, `PAIRING_NUMBER=YOUR_PHONE_NUMBER`)
3. Scan QR with phone (Linked Devices) or enter pairing code
4. Session saved to `system/bot/whatsapp/sessions/` — delete folder to re-pair

### Cookies (Optional)

For Instagram / Facebook / X downloads that require login:

1. Export `cookies.txt` (Netscape format) with [Get cookies.txt LOCALLY](https://github.com/kairi003/Get-cookies.txt-LOCALLY)
2. Place at project root: `./cookies.txt`
3. Refresh every ~30 days when you see `login required`

---

## Running

```bash
npm start        # all platforms — node index.js --all
npm run wa       # WhatsApp only — node index.js --whatsapp
npm run tg       # Telegram only — node index.js --telegram
npm run dc       # Discord only  — node index.js --discord
node . --help    # CLI help
node . --all     # explicit flag
```

CLI flags: `--all | --whatsapp | --telegram | --discord | --help`

`index.js` has crash auto-restart (5 attempts in 5 min, exponential backoff). Production with PM2:

```bash
npm i -g pm2
pm2 start deploy/pm2.config.cjs
pm2 save && pm2 startup
```

---

## Dashboard — Web UI & Public Access

Web dashboard auto-starts (`system/bot/website/dashboard/`) on port `3001`. Open `http://localhost:3001` or your public URL.

| Section | Details |
|---|---|
| **Database** | SQLite `system/database/database.db` + JSON mirror, backups in `backups/` (keeps 3), auto WAL checkpoint |
| **Auth** | `DASHBOARD_KEY` → `dashboard/auth.json` (auto-generated if empty) |
| **Bots** | Live status for WhatsApp / Telegram / Discord (SSE) |
| **Groups** | Group list, participants, settings (antilink, welcome, mute) |
| **Plugins** | Loaded plugins per platform, error count, disable toggle |
| **Logs** | Live logs via SSE + NDJSON export |
| **Tunnel** | Free remote HTTPS access without custom domain via Cloudflare Quick Tunnel |
| **Stats** | Users, hits, uptime, memory |

Default credentials shown in terminal on first run. Change `DASHBOARD_KEY` in `~/.akano-env` to set password.

### Public Access Without Domain (100% Free)

You can expose your dashboard to the internet without purchasing a domain:

#### 1. Built-in Cloudflare Quick Tunnel (Recommended)
Configure `config/settings.json` or `settings.js`:
```json
"website": {
  "enabled": true,
  "mode": "online",
  "host": "0.0.0.0",
  "port": 3001,
  "public": true,
  "tunnel": {
    "enabled": true,
    "provider": "cloudflared"
  }
}
```
When enabled, the bot automatically runs Cloudflare Quick Tunnel and prints your free HTTPS link in terminal:
```
[dashboard] ✓ Public Tunnel URL: https://example-random-subdomain.trycloudflare.com
```

#### 2. Manual Free Tunnel Options
If you prefer running a tunnel separately:
- **Cloudflared (Cloudflare):**
  ```bash
  cloudflared tunnel --url http://127.0.0.1:3001
  ```
- **Localhost.run (Zero install, SSH based):**
  ```bash
  ssh -R 80:localhost:3001 nokey@localhost.run
  ```
- **Localtunnel (Node.js):**
  ```bash
  npx localtunnel --port 3001
  ```
- **Direct VPS IP:**
  If running on a VPS, access directly at `http://<YOUR_VPS_IP>:3001` (ensure port 3001 is allowed in firewall).

---

## Session & Token — Minimal Backup

To migrate or restore, keep only:

```
system/bot/whatsapp/sessions/   # Baileys creds + store.json
~/.akano-env                    # DISCORD_TOKEN, TELEGRAM_TOKEN, ID_OWNER, YT_SESSION_KEY, DASHBOARD_KEY
```

Optional: `cookies.txt` for downloaders. No need to keep branding, old git URL or build artifacts — the bot is generic. Delete sessions folder + restart to re-pair WhatsApp.

---

## YouTube Music Deep Dive — Full YouTube Music Bot via TV OAuth

Akano-Bot implements a **full YouTube Music experience** using your own YouTube account — no Google API key or Cloud project required (default).

### Sign-In (TV OAuth — YouTube TV Device Flow)

This is the same OAuth flow used by smart TVs (`youtube.com/pair`).

1. User runs `/account login` in Discord
2. Bot generates a pairing code via YouTube TV device flow
3. User visits `youtube.com/pair` and enters code (5 min window)
4. Token stored **per-user**, encrypted with `YT_SESSION_KEY` in database
5. Auto-refresh on 401 via `youtubei.js` (client id/secret scraped from `youtube.com/tv`)

Optional web OAuth: set `YT_OAUTH_CLIENT_ID` + `YT_OAUTH_CLIENT_SECRET` (Google Cloud → OAuth Desktop App + YouTube Data API v3) for redirect-based login on `http://host:port` (`OAUTH_REDIRECT_PORT`).

### What Each User Can Do

| Feature | Command / UI | Notes |
|---|---|---|
| Sign in / out | `/account login` / `/account logout` | 5 min pairing window |
| Personal library panel | `/account` | Ephemeral — owner-gated interactions |
| Liked songs | `/account liked` | Direct from YouTube Music liked videos |
| Playlists | `/account playlists` | Browse → open (`VL<id>`) → play |
| Like / unlike | Like button on track | `like/like` endpoint (`like` / `indifferent`) |
| Add to playlist | Add button | `browse/edit_playlist` + `ACTION_ADD_VIDEO` |
| Charts | `/ym charts` | Guest `FEmusic_charts` — Trending, Top 100, Top Music Videos |
| Moods & genres | `/ym moods` | Chill, Energize, Focus, Party, Sad, Sleep, Workout → playlist picker |
| Radio | `/ym radio` | Seamless radio from current track or search query (`next` + `RDAMVM` playlist) |
| Search personal library | `/lib` | Routes via TV API when signed in |
| Create playlist | Blocked by Google for TV clients | Returns friendly explanation (`400 Precondition check failed`) |

### How It Works (`system/scrapers/src/ytsession.js` + `ytmusic.js`)

- **`tvReq`** — raw `POST https://www.youtube.com/youtubei/v1/...` with `Authorization: Bearer <token>`, client `TVHTML5`, Firefox UA. Auto-refresh on `401`.
- **`tvRaw` / `walk` / `tileTitle` / `findDeep`** — generic `browse` wrapper (`VL<id>` for playlist detail) and JSON walker that collects `tileRenderer` nodes as the real TV app renders them.
- **`likes`, `plists`, `plist`** — liked songs, playlist list (IDs without `VL` prefix), single playlist tracks.
- **`like`, `addPl`** — like/unlike and add video to playlist.
- **`moods`, `moodPls`** — guest `WEB_REMIX` browse with public ytmusicapi key; `musicNavigationButtonRenderer` (title in `buttonText`, shared `browseId` with `params` selector).
- **`radio`** — `next` endpoint with `playlistId: RDAMVM<videoId>`; seed track filtered before queue.
- **`ytmusic.js`** — wrapper using your TV-OAuth session for higher-level YTM operations.

> Scope `youtube` + `youtube-paid-content` gives full access. Official `youtubei.js` music parser ignores TV `tileRenderer`, which is why the old `ytmusic.liked` returned empty — this implementation walks raw TV responses directly.

---

## Discord Music Deep Dive — Discord Music Bot

### Sources Supported

| Input | What Happens |
|---|---|
| YouTube / YouTube Music URL | Direct via yt-dlp |
| Spotify track link | Metadata (title + artist) → YouTube Music search → yt-dlp best match |
| Spotify album / playlist | Spotify API scrape → each track resolved via YouTube Music |
| SoundCloud URL | Direct via yt-dlp (`_scMeta` fallback to `scsearch1:` on slug) |
| Direct audio URL (`.mp3`, `.m4a` etc) | Fetched via retryable `fetch` with proxy, saved to `tmp/` |
| Plain text query | Searched on YouTube, YouTube Music, Spotify, SoundCloud — pick from menu |

### Playback Engine (`system/bot/discord/plugins/music/engine.js`)

- Per-guild queue with volume, loop (`off / track / queue`), shuffle, autoplay + genre preset, lyrics.
- yt-dlp downloads **current** track on demand and **pre-downloads next** track while current plays (file cache via `tmp/audio_cache` with MD5 hash, `getCachedFile` / `cacheFile`).
- Resilient voice: auto-renegotiates on disconnect, reuses `Ready` connection, atomic `qLocks` so concurrent `/p` + `/ym radio` never race; `playNext` mutex (`nxtBusy` / `nxtPending`) prevents skips.
- Player state (current song, queue, volume, loop, shuffle, autoplay, audio filter) persisted to disk and **restored after restart**.
- Audio filters supported via `AUDIO_FILTERS` (`--postprocessor-args ffmpeg:`).

### Commands

```
/p <query|url>      Play (Spotify links auto-resolved)
/queue              Show / manage queue
/skip               Skip current track
/stop               Stop & leave voice
/autoplay <genre>   Enable genre autoplay
/lyrics             Lyrics for current track
/volume <0-100>     Set volume
/np                 Now playing
/search             Search & pick track
/lib playlists|liked|picks|search  Personal YTM library
/ym charts|moods|radio             YouTube Music charts / moods / radio
/account login|liked|playlists     YTM account
```

---

## Media Downloaders — YouTube Downloader, TikTok Downloader, Instagram Downloader

One engine per job, auto-managed via `system/scrapers/src/ytdpl.js`:

| Engine | Used For | File | Notes |
|---|---|---|---|
| **yt-dlp** | YouTube, TikTok, Instagram, Facebook, X/Twitter, SoundCloud — video & audio | `system/scrapers/src/ytdpl.js` | `ytsearch<N>:`, `scsearch1:`, `player_client=web_embedded,android,ios,tv` + `js-runtimes node` + `remote-components ejs:github` |
| **gallery-dl** | Pinterest, TikTok photo carousel, Instagram galleries | same `ytdpl.js` (`galleryDlBin`) | `--directory`, JSON parse fallback |
| **TikTok native fallback** | TikTok when yt-dlp fails | `ttNative()` | `tikwm.com/api/?url=` → carousel `images` or `play` URL |
| **YouTube Music API** | YTM liked / playlists / charts / radio | `system/scrapers/src/ytmusic.js` | Via TV-OAuth session |
| **YouTube TV OAuth** | Account sign-in | `system/scrapers/src/ytsession.js` | Device flow + token refresh |

Features: search (`search()`, `searchTracks()` → `ytsearch` / `scsearch1:`), metadata (`getMetadata()` with gallery/spotify/sc detection), download (`download()` with format `bv*+ba/b`, `--merge-output-format mp4`, `--extractor-args youtube:player_client=...`, audio-only ` -x --audio-format mp3`), direct download retry (`_fetchBuf` + `_fetchWithRetry`), cleanup (`cleanup()`), cache (`tmp/audio_cache`).

- Missing binaries auto-install via `pip` at boot.
- Instagram / FB / X may need `cookies.txt`.
- WhatsApp & Telegram use `system/bot/whatsapp/plugins/downloader/` + `system/bot/telegram/plugins/downloader/`; Discord uses `/p` + `/search`.

---

## Handling Events (Built-in) — Sugar Events

The WhatsApp `Client` (`system/bot/whatsapp/lib/index.js`) wraps Baileys `ev` with sugar `emitSugar` + `register()` (priority sorted). Register without touching Baileys internals:

```js
// system/bot/whatsapp/lib/index.js — Client
const { Client } = require("./system/bot/whatsapp/lib");

const bot = new Client({
  plugsdir: "./system/bot/whatsapp/plugins",
  pairing: { state: true, code: "AKANOBOT", number: "YOUR_PHONE_NUMBER" },
  online: true,
  presence: true,
});

// Core sugar events — high-level, easy to remember
bot.register("connect", ({ sock }) => {
  console.log("WhatsApp connected:", sock.user.id);
});

bot.register("ready", ({ sock }) => {
  console.log("Bot ready — plugins loaded:", Object.keys(global.plugin).length);
});

bot.register("message", ({ m, sock }) => {
  // Unified message — serialized via smsg()
  console.log(`[${m.isGroup ? "group" : "dm"}] ${m.sender}: ${m.text}`);
  // m.reply("hello"), m.react("❤️"), m.download()
});

bot.register("group.add", ({ jid, participants, action }) => {
  console.log(`Join ${jid}:`, participants);
});

bot.register("group.leave", ({ jid, participants }) => {
  console.log(`Leave ${jid}:`, participants);
});

bot.register("group.promote", ({ jid, participants }) => {
  console.log(`Promoted in ${jid}:`, participants);
});

bot.register("group.demote", ({ jid, participants }) => {
  console.log(`Demoted in ${jid}:`, participants);
});

bot.register("qr", (qr) => {
  console.log("Scan QR:", qr);
});
```

**Sugar map:**

| Sugar | Baileys Source | Payload |
|---|---|---|
| `connect`, `ready`, `open` | `connection.update` → `open` | `{ sock, update }` |
| `connecting` | `connection.update` → `connecting` | `update` |
| `close`, `disconnect` | `connection.update` → `close` | `update` |
| `qr`, `connection.qr` | `connection.update` → `qr` | `qr` string |
| `message`, `messages` | `messages.upsert` → `notify` serialized | `{ m, raw, messages, type, sock, store }` |
| `poll` | `messages.upsert` where `mtype === pollCreationMessage` | same ctx |
| `message.update`, `message.edit` | `messages.update` → `pollUpdates` / edits | `update` |
| `message.delete` | `messages.delete` | `del` |
| `receipt` | `message-receipt.update` | `receipt` |
| `reaction` | `messages.reaction` | `reaction` |
| `chat.update` | `chats.update` | `chats` |
| `contact.update` / `contact.upsert` | `contacts.*` | `contacts` |
| `group.update` | `groups.update` | `groups` |
| `group.add` / `group.join` | `group-participants.update` → `add` | `{ jid, participants, action, sock }` |
| `group.remove` / `group.leave` | `group-participants.update` → `remove` | same |
| `group.promote` / `group.demote` | `group-participants.update` → `promote`/`demote` | same |
| `group.join-request` | `group.join-request` | `req` |
| `presence` | `presence.update` | `presence` |
| `call`, `caller`, `caller.offer` | `call` / `CB:call` → `offer` | `call` |
| `blocklist.update` | `blocklist.update` | `bl` |

Also: `connection.update`, `creds.update`, `messages.upsert`, `messages.update`, `messages.delete`, `chats.upsert`, `contacts.upsert`, `group-participants.update` are piped unchanged.

---

## Event Piping — 30+ Baileys Events Exposed

Every Baileys `sock.ev` event is forwarded via `bindSugarEvents()` and `_emitSugar` on the `Client` emitter. Listen with `bot.ev.on(...)` or `bot.register(...)`:

```js
// Raw Baileys — via Client.ev
bot.ev.on("messages.upsert", ({ messages, type }) => { /* raw */ });
bot.ev.on("group-participants.update", ({ id, participants, action }) => { /* raw */ });
bot.ev.on("connection.update", ({ connection, lastDisconnect }) => {});

// Sugar — via register (priority aware, 0 = default, higher runs first)
bot.register("message", handler, 10);
bot.register("group.add", handler, 5, /* isCore */ false);
```

**Full piped list (30+):**

`connection.update`, `creds.update`, `qr`, `connecting`, `connect`, `ready`, `open`, `close`, `disconnect`, `error`, `messages.upsert`, `messages.update`, `messages.delete`, `message`, `messages`, `message.update`, `message.edit`, `message.delete`, `message-receipt.update`, `receipt`, `messages.reaction`, `message.reaction`, `reaction`, `poll`, `chats.update`, `chat.update`, `chats.upsert`, `chats.delete`, `contacts.update`, `contacts.upsert`, `contact.update`, `contact.upsert`, `groups.update`, `group.update`, `group-participants.update`, `group.add`, `group.join`, `group.remove`, `group.leave`, `group.promote`, `group.demote`, `group.join-request`, `join-request`, `presence.update`, `presence`, `call`, `caller`, `caller.offer`, `blocklist.update`, `blocklist.set`

Re-binding after reconnect is automatic — `global.reloadHandler` re-calls `bindSugarEvents(global.sock.ev)`.

---

## Message Metadata — The `m` Object

Every incoming WhatsApp message is serialized via `smsg()` / `serializeM()` (`system/bot/whatsapp/lib/serializer.js`):

```js
bot.register("message", ({ m }) => {
  console.log(m.id);            // message id
  console.log(m.chat);          // remoteJid (group or dm)
  console.log(m.isGroup);       // boolean
  console.log(m.sender);        // decoded jid
  console.log(m.fromMe);        // boolean
  console.log(m.isBaileys);     // true if bot-generated (BAE5 / 3EB0)
  console.log(m.mtype);         // message type: conversation, imageMessage, videoMessage, ...
  console.log(m.msg);           // raw content object
  console.log(m.text);          // text / caption / contentText (string)
  console.log(m.mentionedJid);  // array of mentioned jids
  console.log(m.name);          // pushName || getName()
  console.log(m.quoted);        // quoted message (if any) — see below

  m.reply("hello");            // reply with quoted
  m.react("❤️");                // react to this message
  m.download();                // Buffer of media (if url/directPath)
  m.copy();                    // deep copy
  m.copyNForward(jid);          // forward with context
  m.cMod(jid, text, sender);    // modify copy
  m.delete();                  // delete message
  m.forward(jid);
});
```

**Quoted (`m.quoted`):**

```js
m.quoted.id          // stanzaId
m.quoted.chat        // remoteJid of quoted
m.quoted.sender      // decoded jid of quoted author
m.quoted.fromMe      // boolean
m.quoted.isBaileys   // boolean
m.quoted.mtype       // type
m.quoted.text        // text / caption
m.quoted.mentionedJid
m.quoted.name
m.quoted.fakeObj     // WebMessageInfo for relay
m.quoted.download()  // Buffer
m.quoted.reply(text)
m.quoted.copy()
m.quoted.forward(jid)
m.quoted.copyNForward(jid)
m.quoted.cMod(jid, text, sender)
m.quoted.delete()
m.getQuotedObj()     // async — loads original from store
```

**LID handling:** group LIDs (`@lid`) are resolved to phone numbers via `fetchGroupMetadata` before `m` is built, so `m.sender` and `m.quoted.sender` are stable `@s.whatsapp.net` JIDs.

---

## Messaging Functions — 30+ `send*` Methods

All methods are mixed into the Baileys socket via `makeWASocket()` → `extMsgs()` / `extendChats` / `extendGroups` (`system/bot/whatsapp/lib/`). `sock` in plugins = enhanced socket.

```js
// In any plugin run({ sock, m })
await sock.sendMessage(m.chat, { text: "hello" }, { quoted: m });
await sock.reply(m.chat, "hello", m);
```

**Complete list:**

| Method | Signature | What It Sends |
|---|---|---|
| `sendMessage` | `(jid, content, opts)` | Native Baileys |
| `reply` | `(jid, text, quoted, opts)` | Text + mentions parsed |
| `sendMessageModify` | `(jid, text, msg, {title, body, thumbnail, url, largeThumb, ads})` | Link preview with `externalAdReply` |
| `sendMessageModifyV2` | `(jid, text, fakeTitle\|msg, opts)` | Fake quoted `locationMessage` variant |
| `sendMessageVerify` / `sendMessageVerifyV2` | `(jid, text, fakeName, opts)` | Verified style `locationMessage` quoted |
| `sendProgress` | `(jid, text, quoted)` | Animated progress edit (`protocolMessage type 14`) |
| `sendSticker` | `(jid, media, quoted, {packname, author})` | WebP sticker with exif |
| `sendVideoAsSticker` | `(jid, media, quoted, opts)` | Video → WebP sticker |
| `sendFile` | `(jid, media, filename, caption, quoted, opts)` | Auto-detects `image/video/audio/document` |
| `sndAlb` / `sendAlbumMessage` / `sendAlbum` | `(jid, medias, {text, delay, quoted})` | Album (Baileys `albumMessage`) |
| `sendContact` | `(jid, data, quoted, {org, website, email})` | vCard (supports photo + biz desc) |
| `sendReact` | `(jid, emoji, key)` | Reaction |
| `sendPoll` / `sendPollV2` | `(jid, name, {options, multiselect}, quoted)` | Poll creation |
| `pollResult` | `(jid, {name, votes}, quoted)` | Poll result |
| `sendPtv` | `(jid, media, quoted, opts)` | PTV video (`ptv: true`) |
| `copyNForward` | `(jid, msg, forceForward, opts)` | Copy + forward (handles viewOnce) |
| `replyButton` / `sendIAMessage` | `(jid, buttons, msg, {header, content, footer, media, multiple, mentions})` | Native flow buttons with optional location/media header |
| `sendFromAI` | `(jid, text, quoted, opts)` | AI message (`supportPayload`, `forwardedAiBotMessageInfo`) |
| `groupStatus` | `(jid, content, {private})` | Group status (`status@broadcast` or `groupStatus` flag, background color) |
| `sendMetaMsg` / `sendMetaMsgV1/V2/V3` | `(jid, items, quoted, opts)` | AI rich messages via `AIRich` (`addText`, `addCode`, `addTable`, `addSource`, `addImage`, `addSuggest`) |
| `sendCarousel` | `(jid, cards, msg, {content, footer})` | Carousel interactive message |
| `aiRich` | `() => AIRich` | Builder instance |
| `sendGroupV4Invite` | `(jid, participant, code, ttl, name, caption)` | Group invite |
| `downloadM` | `(m, type, saveToFile)` | Download media from message |
| `downloadAndSaveMediaMessage` | `(message, filename, attachExtension)` | Save to file |
| `parseMention` / `mention` | `(text) => jids` | Extract mentions |
| `getFile` | `(path) => {data, mime, ext}` | Buffer + type from URL/file/buffer |
| `resize` | `(input, w, h)` | Jimp resize → thumbnail Buffer |
| `sizeLimit` | `(str, maxMB)` | Head check for URL/file size |
| `serializeM` / `smsg` | `(m) => m` | Serialize raw to rich `m` |
| `delay` | `(ms)` | Sleep helper |

Plus Baileys natives: `sendPresenceUpdate`, `readMessages`, `groupMetadata`, `profilePictureUrl`, `getBusinessProfile`, `relayMessage`, `generateMessageId`, `decodeJid`, `getName`.

### SDK Deep Dive — Media, `jpegThumbnail`, Buttons & Stickers

Correct usage for the fixed SDK. All examples are **Baileys-safe** and use `Buffer` for `jpegThumbnail`. `hasMediaAttachment` (not `hasMedia`) is required for interactive headers.

#### 1. Media — Image / Video / Document (auto-detected)

`sendIAMessage` and `sendFile` now auto-detect mime via `file-type` and call `prepareWAMessageMedia` with the correct key.

```js
// In plugin run({ sock, m })
const fs = require("fs");

// Image from Buffer / URL / path — auto creates imageMessage
await sock.sendIAMessage(m.chat, [
  { text: "Yes", id: "yes" },
  { text: "No",  id: "no" }
], m, {
  header: "Choose",
  content: "Pick one",
  footer: "© Akano-Bot",
  media: fs.readFileSync("./media/image.jpg") // Buffer | "https://..." | "./path.jpg"
});

// Video — detected as videoMessage (not forced to image)
await sock.sendIAMessage(m.chat, buttons, m, {
  header: "Video",
  content: "Watch",
  media: "./media/clip.mp4" // auto -> { video: Buffer }
});

// Document — detected as documentMessage
await sock.sendIAMessage(m.chat, buttons, m, {
  header: "PDF",
  content: "Open file",
  media: "./media/file.pdf" // auto -> { document: Buffer, mimetype, fileName }
});

// Explicit object also works
await sock.sendIAMessage(m.chat, buttons, m, {
  header: "Custom",
  content: "Hello",
  media: { image: Buffer.from("...") } // or { video: buf } or { document: buf }
});
```

Internally:

```js
const { prepareWAMessageMedia } = require("baileys");
const FileType = require("file-type");
const type = await FileType.fromBuffer(buf);
if (type.mime.startsWith("video/")) mediaPayload = { video: buf };
else if (type.mime.startsWith("image/")) mediaPayload = { image: buf };
else mediaPayload = { document: buf, mimetype: type.mime, fileName: "file."+type.ext };
const prepared = await prepareWAMessageMedia(mediaPayload, { upload: sock.waUploadToServer });
header = { title, subtitle, hasMediaAttachment: true, ...prepared };
```

#### 2. `jpegThumbnail` — Always `Buffer`, Never Base64 String

Fixed: `jpegThumbnail` must be a `Buffer` (bytes). Do **not** use `thumb.toString("base64")`.

```js
// Correct
const thumb = await sock.resize(await fs.promises.readFile("./thumb.jpg"), 300, 300);
await sock.sendIAMessage(m.chat, buttons, m, {
  header: "Location",
  content: "Visit us",
  media: {
    name: "Akano HQ",
    address: "Jakarta",
    latitude: -6.2,
    longitude: 106.8,
    buffer: thumb, // will be resized to Buffer and set as jpegThumbnail: Buffer
    url: "https://akano.my.id"
  }
});
// Inside SDK:
// const thumb = await sock.resize(raw, 300, 300); // Buffer
// locationMessage: { ..., jpegThumbnail: thumb } // Buffer, not string

// Manual thumbnail for other messages:
const jpegThumb = await sock.resize(fs.readFileSync("./image.jpg"), 200, 200);
await sock.sendMessage(m.chat, { image: fs.readFileSync("./image.jpg"), caption: "Hi", jpegThumbnail: jpegThumb });
// WRONG: jpegThumbnail: thumb.toString("base64")  -> string, will fail on WA
```

For `externalAdReply` / `locationMessage`, always pass `Buffer`:

```js
await sock.sendMessage(m.chat, {
  text: "Preview",
  contextInfo: { externalAdReply: { title: "Akano", body: "Hello", thumbnail: thumbBuffer } }
});
```

#### 3. Buttons with Media — `hasMediaAttachment` + Interactive Header

```js
// Text buttons (quick_reply)
await sock.sendIAMessage(m.chat, [
  { text: "Menu", command: "menu" },
  { text: "Ping", id: "ping" }
], m, {
  header: "Header title",
  content: "Body text",
  footer: "Footer",
  media: "./media/banner.jpg", // optional media header
  mentions: [m.sender]
});

// Native flow with paramsJson
await sock.sendIAMessage(m.chat, [
  { name: "cta_url", buttonParamsJson: JSON.stringify({ display_text: "Visit", url: "https://akano.my.id" }) },
  { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "Hello", id: "hello" }) }
], m, {
  header: "Shop",
  content: "Choose action",
  multiple: { list_title: "Options", button_title: "Open" }, // bottom_sheet
  v2: true // messageVersion 2
});

// Location button (locationMessage header)
await sock.replyButton(m.chat, [
  { text: "Directions", id: "dir" }
], m, {
  header: "Our Store",
  content: "Come visit",
  footer: "© Akano",
  media: {
    location: { latitude: -6.2, longitude: 106.8, name: "Akano HQ", address: "Jakarta", buffer: "./media/map.jpg" }
  }
});
```

Header shape sent via `relayMessage`:

```js
{
  interactiveMessage: {
    header: {
      title: "Header",
      subtitle: "",
      hasMediaAttachment: true, // not hasMedia
      imageMessage: { url, directPath, ... } // or videoMessage / documentMessage / locationMessage
    },
    body: { text: "Body" },
    footer: { text: "Footer" },
    nativeFlowMessage: { buttons, ... }
  }
}
```

#### 4. Stickers — `packname`/`author`, `sticker: Buffer`, Consistent Exif

Fixed: `load()` before `exif=` and `sticker: Buffer` (not `{url: Buffer}`). `sticker-pack-id` is now consistent `https://github.com/kutashiakano/Akano-Bot`.

```js
// Image sticker
await sock.sendSticker(m.chat, "./media/image.jpg", m, {
  packname: "Akano Pack",
  author: "Akano-Bot",
  categories: ["😀"]
});
// Same for Buffer / URL / data URL / base64
await sock.sendSticker(m.chat, fs.readFileSync("./photo.png"), m, { packname: "My Pack", author: "Me" });
await sock.sendSticker(m.chat, "https://example.com/image.jpg", m, { packname: "Web", author: "Bot" });

// Video sticker (animated)
await sock.sendVideoAsSticker(m.chat, "./media/clip.mp4", m, {
  packname: "Akano",
  author: "Bot"
});
await sock.sendVideoAsSticker(m.chat, fs.readFileSync("./video.mp4"), m, {
  packname: "Pack", author: "Author", categories: ["🔥"]
});

// Manual exif (low-level) — load before exif!
const { Image } = require("node-webpmux");
const { makeExif } = require("./system/bot/whatsapp/lib/exif");
const webp = await imageToWebp(buffer);
const img = new Image();
await img.load(webp);                 // correct order
img.exif = makeExif("Pack", "Author", ["😀"]); // then set exif
await img.save("./sticker.webp");

// Converter helper (correct)
const { sticker } = require("./system/bot/whatsapp/lib/converter");
const webpBuff = await sticker(buffer, { packname: "P", author: "A" }); // returns Buffer with exif
await sock.sendMessage(m.chat, { sticker: webpBuff }); // Buffer, not {url: webpBuff}
```

Baileys expects:

```js
await sock.sendMessage(jid, { sticker: Buffer.from(webp) }); // correct
// WRONG: { sticker: { url: Buffer } }  -> will not render
```

Pack metadata is stored via `node-webpmux` EXIF with constant id `https://github.com/kutashiakano/Akano-Bot`.

### NPM Usage

```bash
npm install github:kutashiakano/Akano-Bot
# or after publish:
npm install akano-bot
```

```js
const { Client } = require("akano-bot/system/bot/whatsapp/lib");
const bot = new Client({ plugsdir: "./plugins", pairing: { state: true, code: "AKANOBOT", number: "62xxx" } });
bot.register("message", async ({ m, sock }) => {
  if (m.text === "ping") await sock.reply(m.chat, "pong", m);
  if (m.text === "sticker") await sock.sendSticker(m.chat, "./image.jpg", m, { packname: "Akano", author: "Bot" });
});
```

---

## Adding a Plugin — Unified + Per-Platform

### Unified — `define()` (Recommended, works on WhatsApp + Telegram + Discord)

One `define()` file works everywhere. Drop it in any `system/bot/*/plugins/<category>/`.

```js
const { define } = require("../../../plugin"); // or ../../../sdk

module.exports = define({
  name: ["hello", "hi"],        // command + aliases
  category: "tools",            // menu group
  help: "Says hello",           // description
  example: "/hello world",
  cooldown: 3000,               // ms
  owner: false,
  group: false,
  admin: false,
  premium: false,
  private: false,
  botAdmin: false,
  options: [
    { name: "name", desc: "Who to greet", type: 3, required: false }
  ],
  run: async ({ platform, args, named, text, reply, sock, client, Utils, fmt }) => {
    // platform: "whatsapp" | "telegram" | "discord"
    // args: positional array, named: mapped from options, text: joined args
    // reply(), sock/client, Utils (= fmt), setting, Config
    await reply(`Hello, ${args[0] || named.name || "World"}!`);
  },
});
```

Alias keys: `usage` (= `name`), `use` (= `example`), `hidden`, `async` (= `run`), `desc` (= `help`).  
`Utils` / `fmt` helpers: `status()`, `emoji()`, `sec()`, `panel()`, `list()`, `toTime()`, `matcher()`.

**SDK unified import:**

```js
const { define, Utils, mbuilder, abuilder, Database, wa, tg, dc, libs } = require("../../../sdk");

module.exports = define({
  usage: ["ping"],
  category: "tools",
  async: async ({ reply, sock }) => {
    await reply("Pong!");
  },
});
```

SDK exports: `define`, `Utils` (=`fmt`), `fmt`, `settings()`, `config()`, `owners()`, `Database`/`getDB()`, `wa()`/`tg()`/`dc()` live instances, `libs()` (`{ baileys, grammy, discord }`), builders `mbuilder`/`bbuilder`/`abuilder`/`ebuilder`/`modal`/`textInput`.

### Per-Platform (Classic)

**WhatsApp** — `system/bot/whatsapp/plugins/<category>/hello.js`

```js
let handler = async (m, { text, sock, isOwner, isAdmin, isBotAdmin }) => {
  await m.reply(`Hello, ${text || "World"}!`);
};
handler.help = ["hello"];
handler.tags = ["tools"];
handler.command = ["hello"];
handler.owner = false;
handler.group = false;
handler.admin = false;
module.exports = handler;
```

**Telegram** — `system/bot/telegram/plugins/<category>/hello.js` (grammY)

```js
module.exports = {
  help: "Say hello",
  command: ["hello"],
  tags: ["tools"],
  run: async (ctx) => {
    await ctx.reply(`Hello, ${ctx.text || "World"}!`);
  },
};
```

**Discord** — `system/bot/discord/plugins/tools/hello.js` (discord.js)

```js
module.exports = {
  name: "hello",
  description: "Say hello",
  options: [{ name: "name", description: "Who to greet", type: 3, required: false }],
  async execute(interaction) {
    const name = interaction.options.getString("name") || "World";
    await interaction.reply(`Hello, ${name}!`);
  },
};
```

> Plugins are auto-discovered via `scanDir` + sorted, watched with `chokidar` (`add`/`change`/`unlink` with syntax check).

---

## Project Structure

```
index.js                         # Entry: crash auto-restart (5 in 5min)
main.js                          # CLI parser (yargs), platform launcher
settings.js                      # Globals, settings, security, group, database
deploy/pm2.config.cjs            # PM2 production config (1GB cap)
.env.example                     # Env template (~/.akano-env)
deploy/Dockerfile / deploy/docker-compose.yml  # Container build
install.sh                   # Termux installer

system/
  core/
    context.js                   # AppContext (DI: db / settings / owners)
    watchdog.js                  # Memory watchdog (MEM_LIMIT_MB)
    heavy.js                     # heavyExec() — worker-thread runner
  bot/
    plugin.js -> sdk/index.js    # define() unified API
    format.js                    # Formatter (emoji / status / panel)
    print.js                     # Message logger
    whatsapp/
      lib/
        index.js                 # Client, makeWASocket, store, plugin scan
        events.js                # bindEvents, presence AFK, status@broadcast, reconnect
        messages.js              # extMsgs — 30+ send* methods
        serializer.js            # smsg / serializeM — rich m object
        adapter.js               # Multi-file auth with EPERM retry
        proxy.js                 # getProxyAgent (https-proxy-agent)
        socket.js                # Baileys socket creation
        ai-rich.js               # AIRich builder
        chats.js / groups.js     # Group/chat helpers
        converter.js / exif.js   # Sticker conversion
        verification.js          # Captcha ephemeral verification
        system-handler.js        # antiDel, system init
      handler.js                 # Command routing, gates, cooldown, spam, typo
      plugins/<category>/*.js    # WhatsApp plugins
    telegram/
      handler.js / index.js      # grammY handler
      plugins/<category>/*.js    # Telegram plugins
      group-manager.js           # Group management
    discord/
      handler.js / index.js      # discord.js handler
      plugins/
        tools/*.js               # settings, status, poll, gemini, ...
        music/*.js               # play, queue, engine, state, autoplay, ...
        images/*.js              # blur, invert, meme, rotate, ...
      start.js                   # Voice + client boot
    website/dashboard/
      server/{api,auth,bus,store} # Dashboard backend
      client/{app.js, index.html} # Dashboard frontend
  scrapers/src/
    ytdpl.js                     # yt-dlp / gallery-dl wrapper (search, getMetadata, download)
    ytmusic.js / ytsession.js    # YouTube Music TV OAuth
  database/
    database.db                  # SQLite (primary)
    database.json                # JSON mirror (auto-save every 300s)
    backups/                     # Rotating JSON backups
```

---

## Common Errors & Handling

| Problem | Cause | Fix |
|---|---|---|
| `WhatsApp logged out` | Session invalidated (`DisconnectReason.loggedOut`) | `rm -rf system/bot/whatsapp/sessions` → restart + re-pair |
| `login required` on download | Cookies expired | Refresh `cookies.txt` (Netscape, every ~30 days) |
| `yt-dlp not found` / `gallery-dl not found` | Missing Python deps | `pip3 install -U yt-dlp yt-dlp-ejs gallery-dl curl_cffi` or wait for auto-install |
| `YouTube 403` on music | Outdated yt-dlp or missing EJS | `pip3 install -U yt-dlp yt-dlp-ejs` + restart |
| `Plugin disabled` | Auto-disable after 5 errors | Check logs at `http://host:port` → fix plugin → restart |
| `Discord login failed` | Invalid `DISCORD_TOKEN` | Regenerate at https://discord.com/developers → update `~/.akano-env` |
| `Telegram unauthorized` | Invalid `TELEGRAM_TOKEN` | Re-create via @BotFather → update env |
| `File too large` | Upload exceeds limit | Increase `max_uploud` in `settings.js` (default 50 MB) |
| `OOM restart` | Heap exceeds limit | Raise `MEM_LIMIT_MB=1024` or reduce concurrent downloads |
| `Voice Signalling` stuck | Double-join race | Fixed via atomic `qLocks` + `playNext` mutex; if stuck: `/stop` → `/p` again |
| `/ym sign in first` | YTM not linked | Run `/account login` → `youtube.com/pair` |
| `EADDRINUSE host:port` | Dashboard port taken | `fuser -k host:port/tcp` or set `DASHBOARD_PORT=host:port` |
| `pino/index.js` error | Baileys requires `pino@8` | `npm install pino@8` (not v9) |
| `grammy not installed` | Missing Telegram dep | `npm install grammy` |
| `Database locked` | SQLite WAL contention | Auto-retry (50ms), WAL checkpoint — wait or restart |
| `Bad MAC` / `Failed to decrypt` | WhatsApp noise key race | Filtered via `isBaileysInternalError` + `_forceReconnect` watchdog |
| `File size not found` | HEAD without content-length | Bot replies `File size not found` — retry with direct link |

---

## License

Custom — free to use and modify. **Credit required** — mention original authors. **No verbatim copies** without meaningful changes. See [`LICENSE`](LICENSE).

---

**Akano-Bot** — WhatsApp bot, Telegram bot, Discord bot, Baileys multi-platform bot framework. AI chat, media downloader, YouTube downloader, TikTok downloader, Instagram downloader, group management, moderation, Discord music, YouTube Music. Built for GitHub search: `whatsapp bot` `telegram bot` `discord bot` `baileys bot` `multi-platform bot` `whatsapp bot framework` `ai chat bot` `media downloader bot` `youtube music bot` `discord music bot` `group management bot` `moderation bot` `sticker bot`.
