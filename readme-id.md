# Akano-Bot — Bot WhatsApp, Bot Telegram & Bot Discord Multi-Platform

> **Bot WhatsApp + bot Telegram + bot Discord dalam satu codebase.** Dibuat dengan **Baileys** (WhatsApp), **grammY** (Telegram) dan **discord.js** (Discord). Chat AI, pengunduh media, YouTube Music, pemutar musik Discord, manajemen grup, moderasi, pembuat stiker dan sistem plugin modular — framework bot multi-platform siap produksi.

![Version](https://img.shields.io/badge/Version-1.1.0-808080?style=flat)
![Node](https://img.shields.io/badge/Node.js-%3E%3D18-808080?style=flat)
![Baileys](https://img.shields.io/badge/WhatsApp-Baileys-25D366?style=flat)
![Telegram](https://img.shields.io/badge/Telegram-grammY-26A5E4?style=flat)
![Discord](https://img.shields.io/badge/Discord-discord.js-5865F2?style=flat)
![License](https://img.shields.io/badge/License-Custom-808080?style=flat)
![Platform](https://img.shields.io/badge/Platform-Multi--Platform-808080?style=flat)

**Kata kunci:** `bot whatsapp` `bot telegram` `bot discord` `baileys` `bot multi-platform` `framework bot whatsapp` `framework bot telegram` `framework bot discord` `bot chat ai` `bot gemini` `pengunduh media` `pengunduh youtube` `pengunduh tiktok` `pengunduh instagram` `manajemen grup` `bot moderasi` `bot musik` `youtube music` `automod` `bot stiker`

> **Bahasa:** [English](README.md) · [Bahasa Indonesia](readme-id.md) · [Docs: Adding a Plugin](docs/adding-a-plugin.id.md) · [Docs: Menambahkan Plugin](docs/adding-a-plugin.md)

---

## Mulai Cepat — Bot WhatsApp, Bot Telegram, Bot Discord

```bash
git clone https://github.com/kutashiakano/Akano-Bot.git
cd Akano-Bot
npm install
cp .env.example ~/.akano-env && nano ~/.akano-env
npm start
```

Dashboard → `http://host:port`

```bash
npm start        # jalankan semua platform (WhatsApp + Telegram + Discord)
npm run wa       # hanya bot WhatsApp
npm run tg       # hanya bot Telegram
npm run dc       # hanya bot Discord
node . --all     # sama seperti npm start
```

---

## Persyaratan

| Dependensi | Versi | Instalasi | Catatan |
|---|---|---|---|
| **Node.js** | `>=18` (diuji pada 22 / 26) | `pkg install nodejs` / `nvm` | Wajib |
| **Python** | `3.10+` | `pkg install python` | Untuk yt-dlp / gallery-dl |
| **FFmpeg** | terbaru | `pkg install ffmpeg` | Konversi audio / stiker |
| **yt-dlp** | terbaru | `pip3 install -U yt-dlp` | YouTube, TikTok, FB, X, IG |
| **yt-dlp-ejs** | terbaru | `pip3 install -U yt-dlp-ejs` | YouTube SABR / PO-token (wajib) |
| **gallery-dl** | terbaru | `pip3 install -U gallery-dl` | Pinterest, galeri, foto TikTok |
| **curl_cffi** | terbaru | `pip3 install -U curl_cffi` | Impersonasi TikTok |

> Binari Python yang hilang akan otomatis terinstal saat pertama dijalankan via `system/scrapers/src/ytdpl.js` (`pip install --break-system-packages -U yt-dlp yt-dlp-ejs gallery-dl curl_cffi`).

---

## Tentang — Framework Bot Multi-Platform

**Akano-Bot** adalah **framework bot WhatsApp**, **bot Telegram** dan **bot Discord** terpadu yang berbagi satu core, satu API plugin dan satu database.

- **WhatsApp:** didukung **Baileys** (`@whiskeysockets/baileys` via `@itsliaaa/baileys`). QR / pairing code, multi-file auth, in-memory store, anti-hapus, verifikasi, otomasi grup.
- **Telegram:** didukung **grammY**. Handler perintah, manajer grup, welcome canvas, pengunduh inline.
- **Discord:** didukung **discord.js** + **@discordjs/voice**. Slash command, antrian musik, linking akun YouTube Music, autoplay, lirik.
- **Satu API plugin:** `define()` bekerja di ketiga platform — metadata sama, gate sama (`owner`, `group`, `admin`, `premium`, `cooldown`), `reply()` sama.

Gunakan sebagai **bot manajemen grup WhatsApp**, **bot moderasi Telegram**, **bot musik Discord**, **bot chat AI** (Gemini), **bot pengunduh media** (YouTube, TikTok, Instagram, Facebook, X/Twitter, Pinterest, SoundCloud) atau sebagai starter untuk otomasi multi-platform kustom apa pun.

---

## Fitur

| Kategori | Sorotan |
|---|---|
| **Bot Chat AI** | Gemini di WhatsApp / Telegram / Discord, pesan AI kaya, memori percakapan |
| **Bot Pengunduh Media** | YouTube, TikTok (video + carousel foto), Instagram, Facebook, X/Twitter, Pinterest, SoundCloud, link audio langsung |
| **Bot Musik Discord** | Pemutaran YouTube / YouTube Music / Spotify / SoundCloud, antrian, volume, loop, shuffle, autoplay, lirik, state persisten |
| **Bot YouTube Music** | Akun YouTube Music penuh via TV OAuth — lagu disukai, playlist, chart, mood & genre, radio, like/unlike |
| **Bot Moderasi** | kick, ban, mute, warn, promote, demote, hidetag, tagall, antilink, antivirtex, anti-hapus |
| **Bot Manajemen Grup** | welcome/goodbye dengan thumbnail, deteksi promote/demote, verifikasi (captcha ephemeral), penanganan join-request |
| **Bot Stiker** | gambar/video → stiker WebP dengan packname/author, `node-webpmux` + `fluent-ffmpeg` |
| **Utilitas** | ping, kalkulator, poll, AFK, info server, sub-bot (jadibot) |
| **Keamanan** | cooldown per perintah, deteksi spam, user terblokir, batas harian Discord, watchdog memori |
| **Dashboard** | UI Web di `http://host:port` — grup, plugin, log (SSE), database, status bot |
| **Sistem Plugin** | Auto-load, sort & hot-reload via `chokidar`, API `define()` terpadu |
| **Sesi & Proxy** | Multi-file auth, opsional `WA_PROXY` / `HTTPS_PROXY`, dukungan `https-proxy-agent` |

---

## Library yang Digunakan

| Library | Tujuan | Digunakan Untuk |
|---|---|---|
| **baileys** (`@itsliaaa/baileys`) | WhatsApp Web API | Core bot WhatsApp, pairing, messaging |
| **grammy** | Framework Bot Telegram | Handler bot Telegram |
| **discord.js** | API Discord | Slash command, embed, voice |
| **@discordjs/voice** + **@discordjs/opus** | Voice Discord | Pemutaran musik per guild |
| **youtubei.js** | API inner YouTube | TV OAuth, deep API YouTube Music |
| **yt-dlp** + **yt-dlp-ejs** + **gallery-dl** | Ekstraksi media | Pengunduh YouTube/TikTok/IG/FB/X/Pinterest |
| **fluent-ffmpeg** + **node-webpmux** | Konversi media | Konversi stiker / audio |
| **jimp** | Pemrosesan gambar | Resize / thumbnail (`sock.resize`) |
| **qrcode-terminal** | Tampilan QR | QR WhatsApp di terminal |
| **pino** | Logger | Logger senyap Baileys (`level: silent`) |
| **chokidar** | File watcher | Hot-reload plugin |
| **moment-timezone** | Format waktu | Event grup, waktu welcome |
| **awesome-phonenumber** | Parsing telepon | Format vCard kontak |
| **axios** + **node-fetch** | HTTP | Scraper, proxy fetch |
| **https-proxy-agent** + **proxy-from-env** | Proxy | Penanganan `WA_PROXY` |
| **cfonts** + **gradient-string** + **chalk** | UI CLI | Banner, log berwarna |

---

## Instalasi

### Standar — Linux / macOS / Windows (WSL)

```bash
git clone https://github.com/kutashiakano/Akano-Bot.git
cd Akano-Bot
npm install
pip3 install -U yt-dlp yt-dlp-ejs gallery-dl curl_cffi
cp .env.example ~/.akano-env
nano ~/.akano-env   # isi token
npm start
```

### Termux — Hosting Bot WhatsApp Android

```bash
pkg update && pkg upgrade -y
pkg install nodejs python ffmpeg git -y
pip install -U yt-dlp yt-dlp-ejs gallery-dl curl_cffi
git clone https://github.com/kutashiakano/Akano-Bot.git
cd Akano-Bot
bash install.sh
npm start
```

> `install.sh` menginstal dependensi dan menyiapkan `~/.akano-env` untuk Termux.

### Docker — Bot WhatsApp + Bot Telegram + Bot Discord (GHCR)

```bash
cp .env.example .env
docker compose -f deploy/docker-compose.yml pull && docker compose -f deploy/docker-compose.yml up -d
docker compose -f deploy/docker-compose.yml logs -f
```

Satu perintah:

```bash
docker run -d --name akano-bot --restart unless-stopped \
  -v $PWD/system/database:/app/system/database \
  -v $PWD/system/bot/whatsapp/sessions:/app/system/bot/whatsapp/sessions \
  --env-file .env \
  ghcr.io/kutashiakano/akano-bot:latest
```

- Image: `ghcr.io/kutashiakano/akano-bot:latest` (linux/amd64 + arm64, auto-build)
- Build lokal: `docker build -f deploy/Dockerfile -t akano-bot . && docker run ... akano-bot`

deploy/Dockerfile menggunakan `node:24-bookworm-slim` + `python3 venv` dengan `yt-dlp`, `yt-dlp-ejs`, `gallery-dl` preinstal.

---

## Konfigurasi

Secret dibaca dari environment. Buat **`~/.akano-env`** atau export langsung.

```bash
# ~/.akano-env
DISCORD_TOKEN=token_bot_discord_anda
TELEGRAM_TOKEN=token_bot_telegram_anda
ID_OWNER=NOMOR_HP_ANDA,1723113802,123456789
TELEGRAM_OWNER_ID=1723113802
DISCORD_OWNER_ID=123456789
YT_SESSION_KEY=kunci_hex_random_anda
DASHBOARD_KEY=kunci_dashboard_anda
MEM_LIMIT_MB=768
```

| Variabel | Diperlukan Untuk | Default | Catatan |
|---|---|---|---|
| `DISCORD_TOKEN` | Bot Discord | — | https://discord.com/developers → Bot → Token |
| `TELEGRAM_TOKEN` | Bot Telegram | — | Chat ke @BotFather → /newbot |
| `ID_OWNER` | **semua platform (terpadu)** | — | `hp, telegramId, discordId` dipisah koma |
| `TELEGRAM_OWNER_ID` | Telegram | fallback `ID_OWNER` | ID numerik owner Telegram |
| `DISCORD_OWNER_ID` | Discord | fallback `ID_OWNER` | ID numerik owner Discord |
| `YT_SESSION_KEY` | YouTube Music | `akano` | `openssl rand -hex 16` — enkripsi OAuth per-user |
| `DASHBOARD_KEY` | Dashboard | auto-generate | Login untuk `http://host:port` |
| `MEM_LIMIT_MB` | watchdog | `768` | Batas heap sebelum restart |
| `DC_DAILY_LIMIT` | Batas Discord | `200` | Perintah per user per hari |
| `WA_PROXY` / `HTTPS_PROXY` | Proxy WhatsApp | — | `http://host:port` untuk Baileys + fetch |
| `NO_PROXY` | bypass proxy | `localhost,127.0.0.1` | Daftar koma |
| `YT_OAUTH_CLIENT_ID` / `YT_OAUTH_CLIENT_SECRET` | OAuth web YT | — | Opsional Google Cloud OAuth (web flow) |
| `OAUTH_REDIRECT_PORT` | Callback OAuth | `3200` | Server callback lokal untuk login web |

Template: `.env.example`. `ID_OWNER` kosong = tanpa gate owner (terbuka).

### Pairing WhatsApp

1. Jalankan bot sekali: `npm run wa` atau `npm start`
2. Pilih QR atau Pairing Code (`CODE_PAIRING=AKANOBOT`, `PAIRING_NUMBER=NOMOR_HP_ANDA`)
3. Pindai QR dengan HP (Perangkat Tertaut) atau masukkan pairing code
4. Sesi tersimpan di `system/bot/whatsapp/sessions/` — hapus folder untuk pairing ulang

### Cookies (Opsional)

Untuk unduhan Instagram / Facebook / X yang butuh login:

1. Export `cookies.txt` (format Netscape) dengan [Get cookies.txt LOCALLY](https://github.com/kairi003/Get-cookies.txt-LOCALLY)
2. Tempatkan di root proyek: `./cookies.txt`
3. Refresh tiap ~30 hari saat melihat `login required`

---

## Menjalankan

```bash
npm start        # semua platform — node index.js --all
npm run wa       # hanya WhatsApp — node index.js --whatsapp
npm run tg       # hanya Telegram — node index.js --telegram
npm run dc       # hanya Discord  — node index.js --discord
node . --help    # bantuan CLI
node . --all     # flag eksplisit
```

Flag CLI: `--all | --whatsapp | --telegram | --discord | --help`

`index.js` memiliki auto-restart saat crash (5 percobaan dalam 5 menit, exponential backoff). Produksi dengan PM2:

```bash
npm i -g pm2
pm2 start deploy/pm2.config.cjs
pm2 save && pm2 startup
```

---

## Dashboard — Web UI & Akses Publik

Dashboard web auto-start (`system/bot/website/dashboard/`) pada port `3001`. Buka `http://localhost:3001` atau URL publik Anda di browser.

| Bagian | Detail |
|---|---|
| **Database** | SQLite `system/database/database.db` + mirror JSON, backup di `backups/` (simpan 3), auto WAL checkpoint |
| **Auth** | `DASHBOARD_KEY` → `dashboard/auth.json` (auto-generate jika kosong) |
| **Bot** | Status live untuk WhatsApp / Telegram / Discord (SSE) |
| **Grup** | Daftar grup, peserta, pengaturan (antilink, welcome, mute) |
| **Plugin** | Plugin terload per platform, jumlah error, toggle disable |
| **Log** | Log live via SSE + export NDJSON |
| **Tunnel** | Akses remote HTTPS publik gratis tanpa perlu domain via Cloudflare Quick Tunnel |
| **Stat** | User, hits, uptime, memori |

Kredensial default ditampilkan di terminal saat pertama jalan. Ubah `DASHBOARD_KEY` di `~/.akano-env` untuk mengatur password.

### Akses Web Publik Tanpa Domain (100% Gratis)

Anda dapat membuka akses dashboard ke internet tanpa harus membeli domain:

#### 1. Cloudflare Quick Tunnel Otomatis (Direkomendasikan)
Atur di `config/settings.json` atau `settings.js`:
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
Ketika diaktifkan, bot secara otomatis menjalankan Cloudflare Quick Tunnel dan mencetak tautan HTTPS publik gratis di terminal/log:
```
[dashboard] ✓ Public Tunnel URL: https://nama-acak.trycloudflare.com
```

#### 2. Pilihan Tunnel Gratis Manual
Jika ingin menjalankan tunnel secara terpisah:
- **Cloudflared (Cloudflare):**
  ```bash
  cloudflared tunnel --url http://127.0.0.1:3001
  ```
- **Localhost.run (Tanpa install, via SSH):**
  ```bash
  ssh -R 80:localhost:3001 nokey@localhost.run
  ```
- **Localtunnel (Berbasis Node.js):**
  ```bash
  npx localtunnel --port 3001
  ```
- **Akses Langsung via IP VPS:**
  Jika bot di-hosting di VPS, buka langsung `http://<IP_VPS>:3001` di browser (pastikan port 3001 dibuka pada firewall/security group).

---

## Sesi & Token — Backup Minimal

Untuk migrasi atau restore, simpan hanya:

```
system/bot/whatsapp/sessions/   # kreds Baileys + store.json
~/.akano-env                    # DISCORD_TOKEN, TELEGRAM_TOKEN, ID_OWNER, YT_SESSION_KEY, DASHBOARD_KEY
```

Opsional: `cookies.txt` untuk pengunduh. Tidak perlu menyimpan branding, URL git lama atau artefak build — bot bersifat generik. Hapus folder sesi + restart untuk pairing ulang WhatsApp.

---

## Pembahasan Mendalam YouTube Music — Bot YouTube Music Lengkap via TV OAuth

Akano-Bot mengimplementasikan **pengalaman YouTube Music penuh** menggunakan akun YouTube Anda sendiri — tanpa Google API key atau proyek Cloud (default).

### Sign-In (TV OAuth — Alur Device YouTube TV)

Ini adalah flow OAuth yang sama digunakan smart TV (`youtube.com/pair`).

1. User menjalankan `/account login` di Discord
2. Bot membuat pairing code via alur device YouTube TV
3. User mengunjungi `youtube.com/pair` dan memasukkan kode (jendela 5 menit)
4. Token disimpan **per-user**, terenkripsi dengan `YT_SESSION_KEY` di database
5. Auto-refresh saat 401 via `youtubei.js` (client id/secret di-scrape dari `youtube.com/tv`)

Opsional web OAuth: set `YT_OAUTH_CLIENT_ID` + `YT_OAUTH_CLIENT_SECRET` (Google Cloud → OAuth Desktop App + YouTube Data API v3) untuk login berbasis redirect di `http://host:port` (`OAUTH_REDIRECT_PORT`).

### Yang Bisa Dilakukan Setiap User

| Fitur | Perintah / UI | Catatan |
|---|---|---|
| Login / logout | `/account login` / `/account logout` | Jendela pairing 5 menit |
| Panel library pribadi | `/account` | Ephemeral — interaksi owner-gated |
| Lagu disukai | `/account liked` | Langsung dari video disukai YouTube Music |
| Playlist | `/account playlists` | Jelajah → buka (`VL<id>`) → putar |
| Like / unlike | Tombol Like pada track | endpoint `like/like` (`like` / `indifferent`) |
| Tambah ke playlist | Tombol Add | `browse/edit_playlist` + `ACTION_ADD_VIDEO` |
| Chart | `/ym charts` | Guest `FEmusic_charts` — Trending, Top 100, Top Music Videos |
| Mood & genre | `/ym moods` | Chill, Energize, Focus, Party, Sad, Sleep, Workout → pemilih playlist |
| Radio | `/ym radio` | Radio mulus dari track saat ini atau query (`next` + playlist `RDAMVM`) |
| Cari library pribadi | `/lib` | Route via TV API saat sudah sign-in |
| Buat playlist | Diblokir Google untuk klien TV | Mengembalikan penjelasan ramah (`400 Precondition check failed`) |

### Cara Kerjanya (`system/scrapers/src/ytsession.js` + `ytmusic.js`)

- **`tvReq`** — mentah `POST https://www.youtube.com/youtubei/v1/...` dengan `Authorization: Bearer <token>`, klien `TVHTML5`, UA Firefox. Auto-refresh saat `401`.
- **`tvRaw` / `walk` / `tileTitle` / `findDeep`** — wrapper `browse` generik (`VL<id>` untuk detail playlist) dan walker JSON yang mengumpulkan node `tileRenderer` persis seperti aplikasi TV merendernya.
- **`likes`, `plists`, `plist`** — lagu disukai, daftar playlist (ID tanpa prefix `VL`), track satu playlist.
- **`like`, `addPl`** — like/unlike dan tambah video ke playlist.
- **`moods`, `moodPls`** — guest `WEB_REMIX` browse dengan key publik ytmusicapi; `musicNavigationButtonRenderer` (judul di `buttonText`, `browseId` berbagi dengan selektor `params`).
- **`radio`** — endpoint `next` dengan `playlistId: RDAMVM<videoId>`; track benih difilter sebelum antrian.
- **`ytmusic.js`** — wrapper menggunakan sesi TV-OAuth Anda untuk operasi YTM level tinggi.

> Scope `youtube` + `youtube-paid-content` memberi akses penuh. Parser musik resmi `youtubei.js` mengabaikan `tileRenderer` TV, itulah mengapa `ytmusic.liked` lama mengembalikan kosong — implementasi ini menelusuri respons TV mentah secara langsung.

---

## Pembahasan Mendalam Musik Discord — Bot Musik Discord

### Sumber yang Didukung

| Input | Yang Terjadi |
|---|---|
| URL YouTube / YouTube Music | Langsung via yt-dlp |
| Tautan track Spotify | Metadata (judul + artis) → pencarian YouTube Music → yt-dlp best match |
| Album / playlist Spotify | Scrape API Spotify → setiap track diresolusi via YouTube Music |
| URL SoundCloud | Langsung via yt-dlp (fallback `_scMeta` ke `scsearch1:` pada slug) |
| URL audio langsung (`.mp3`, `.m4a` dll) | Diambil via `fetch` retryable dengan proxy, disimpan ke `tmp/` |
| Query teks biasa | Dicari di YouTube, YouTube Music, Spotify, SoundCloud — pilih dari menu |

### Engine Pemutaran (`system/bot/discord/plugins/music/engine.js`)

- Antrian per guild dengan volume, loop (`off / track / queue`), shuffle, autoplay + preset genre, lirik.
- yt-dlp mengunduh track **saat ini** on demand dan **pre-download next** saat yang sekarang diputar (cache file via `tmp/audio_cache` dengan hash MD5, `getCachedFile` / `cacheFile`).
- Voice tangguh: auto-renegosiasi saat disconnect, reuse koneksi `Ready`, atomic `qLocks` sehingga `/p` + `/ym radio` konkuren tidak pernah race; mutex `playNext` (`nxtBusy` / `nxtPending`) mencegah skip.
- State player (lagu saat ini, antrian, volume, loop, shuffle, autoplay, filter audio) dipersist ke disk dan **dipulihkan setelah restart**.
- Filter audio didukung via `AUDIO_FILTERS` (`--postprocessor-args ffmpeg:`).

### Perintah

```
/p <query|url>      Putar (tautan Spotify auto-resolusi)
/queue              Tampilkan / kelola antrian
/skip               Lewati track saat ini
/stop               Stop & keluar voice
/autoplay <genre>   Aktifkan autoplay genre
/lyrics             Lirik track saat ini
/volume <0-100>     Atur volume
/np                 Sedang diputar
/search             Cari & pilih track
/lib playlists|liked|picks|search  Library YTM pribadi
/ym charts|moods|radio             Chart / mood / radio YouTube Music
/account login|liked|playlists     Akun YTM
```

---

## Pengunduh Media — Pengunduh YouTube, Pengunduh TikTok, Pengunduh Instagram

Satu engine per tugas, dikelola otomatis via `system/scrapers/src/ytdpl.js`:

| Engine | Digunakan Untuk | File | Catatan |
|---|---|---|---|
| **yt-dlp** | YouTube, TikTok, Instagram, Facebook, X/Twitter, SoundCloud — video & audio | `system/scrapers/src/ytdpl.js` | `ytsearch<N>:`, `scsearch1:`, `player_client=web_embedded,android,ios,tv` + `js-runtimes node` + `remote-components ejs:github` |
| **gallery-dl** | Pinterest, carousel foto TikTok, galeri Instagram | `ytdpl.js` sama (`galleryDlBin`) | `--directory`, fallback parse JSON |
| **Fallback native TikTok** | TikTok saat yt-dlp gagal | `ttNative()` | `tikwm.com/api/?url=` → `images` carousel atau URL `play` |
| **API YouTube Music** | YTM liked / playlist / chart / radio | `system/scrapers/src/ytmusic.js` | Via sesi TV-OAuth |
| **TV OAuth YouTube** | Sign-in akun | `system/scrapers/src/ytsession.js` | Alur device + refresh token |

Fitur: pencarian (`search()`, `searchTracks()` → `ytsearch` / `scsearch1:`), metadata (`getMetadata()` dengan deteksi gallery/spotify/sc), unduhan (`download()` dengan format `bv*+ba/b`, `--merge-output-format mp4`, `--extractor-args youtube:player_client=...`, audio-only ` -x --audio-format mp3`), retry unduhan langsung (`_fetchBuf` + `_fetchWithRetry`), cleanup (`cleanup()`), cache (`tmp/audio_cache`).

- Binari yang hilang auto-install via `pip` saat boot.
- Instagram / FB / X mungkin butuh `cookies.txt`.
- WhatsApp & Telegram menggunakan `system/bot/whatsapp/plugins/downloader/` + `system/bot/telegram/plugins/downloader/`; Discord menggunakan `/p` + `/search`.

---

## Penanganan Event (Bawaan) — Sugar Events

`Client` WhatsApp (`system/bot/whatsapp/lib/index.js`) membungkus `ev` Baileys dengan sugar `emitSugar` + `register()` (priority sorted). Daftar tanpa menyentuh internal Baileys:

```js
// system/bot/whatsapp/lib/index.js — Client
const { Client } = require("./system/bot/whatsapp/lib");

const bot = new Client({
  plugsdir: "./system/bot/whatsapp/plugins",
  pairing: { state: true, code: "AKANOBOT", number: "NOMOR_HP_ANDA" },
  online: true,
  presence: true,
});

// Event sugar inti — level tinggi, mudah diingat
bot.register("connect", ({ sock }) => {
  console.log("WhatsApp terhubung:", sock.user.id);
});

bot.register("ready", ({ sock }) => {
  console.log("Bot siap — plugin terload:", Object.keys(global.plugin).length);
});

bot.register("message", ({ m, sock }) => {
  // Pesan terpadu — diserialisasi via smsg()
  console.log(`[${m.isGroup ? "grup" : "dm"}] ${m.sender}: ${m.text}`);
  // m.reply("hello"), m.react("❤️"), m.download()
});

bot.register("group.add", ({ jid, participants, action }) => {
  console.log(`Join ${jid}:`, participants);
});

bot.register("group.leave", ({ jid, participants }) => {
  console.log(`Keluar ${jid}:`, participants);
});

bot.register("group.promote", ({ jid, participants }) => {
  console.log(`Promosi di ${jid}:`, participants);
});

bot.register("group.demote", ({ jid, participants }) => {
  console.log(`Demosi di ${jid}:`, participants);
});

bot.register("qr", (qr) => {
  console.log("Pindai QR:", qr);
});
```

**Pemetaan sugar:**

| Sugar | Sumber Baileys | Payload |
|---|---|---|
| `connect`, `ready`, `open` | `connection.update` → `open` | `{ sock, update }` |
| `connecting` | `connection.update` → `connecting` | `update` |
| `close`, `disconnect` | `connection.update` → `close` | `update` |
| `qr`, `connection.qr` | `connection.update` → `qr` | string `qr` |
| `message`, `messages` | `messages.upsert` → `notify` diserialisasi | `{ m, raw, messages, type, sock, store }` |
| `poll` | `messages.upsert` di mana `mtype === pollCreationMessage` | ctx sama |
| `message.update`, `message.edit` | `messages.update` → `pollUpdates` / edit | `update` |
| `message.delete` | `messages.delete` | `del` |
| `receipt` | `message-receipt.update` | `receipt` |
| `reaction` | `messages.reaction` | `reaction` |
| `chat.update` | `chats.update` | `chats` |
| `contact.update` / `contact.upsert` | `contacts.*` | `contacts` |
| `group.update` | `groups.update` | `groups` |
| `group.add` / `group.join` | `group-participants.update` → `add` | `{ jid, participants, action, sock }` |
| `group.remove` / `group.leave` | `group-participants.update` → `remove` | sama |
| `group.promote` / `group.demote` | `group-participants.update` → `promote`/`demote` | sama |
| `group.join-request` | `group.join-request` | `req` |
| `presence` | `presence.update` | `presence` |
| `call`, `caller`, `caller.offer` | `call` / `CB:call` → `offer` | `call` |
| `blocklist.update` | `blocklist.update` | `bl` |

Juga: `connection.update`, `creds.update`, `messages.upsert`, `messages.update`, `messages.delete`, `chats.upsert`, `contacts.upsert`, `group-participants.update` dipiping tanpa perubahan.

---

## Pemipaan Event — 30+ Event Baileys Terekspos

Setiap event `sock.ev` Baileys diteruskan via `bindSugarEvents()` dan `_emitSugar` pada emitter `Client`. Dengarkan dengan `bot.ev.on(...)` atau `bot.register(...)`:

```js
// Mentah Baileys — via Client.ev
bot.ev.on("messages.upsert", ({ messages, type }) => { /* mentah */ });
bot.ev.on("group-participants.update", ({ id, participants, action }) => { /* mentah */ });
bot.ev.on("connection.update", ({ connection, lastDisconnect }) => {});

// Sugar — via register (priority aware, 0 = default, lebih tinggi jalan duluan)
bot.register("message", handler, 10);
bot.register("group.add", handler, 5, /* isCore */ false);
```

**Daftar pipa lengkap (30+):**

`connection.update`, `creds.update`, `qr`, `connecting`, `connect`, `ready`, `open`, `close`, `disconnect`, `error`, `messages.upsert`, `messages.update`, `messages.delete`, `message`, `messages`, `message.update`, `message.edit`, `message.delete`, `message-receipt.update`, `receipt`, `messages.reaction`, `message.reaction`, `reaction`, `poll`, `chats.update`, `chat.update`, `chats.upsert`, `chats.delete`, `contacts.update`, `contacts.upsert`, `contact.update`, `contact.upsert`, `groups.update`, `group.update`, `group-participants.update`, `group.add`, `group.join`, `group.remove`, `group.leave`, `group.promote`, `group.demote`, `group.join-request`, `join-request`, `presence.update`, `presence`, `call`, `caller`, `caller.offer`, `blocklist.update`, `blocklist.set`

Re-binding setelah reconnect otomatis — `global.reloadHandler` memanggil ulang `bindSugarEvents(global.sock.ev)`.

---

## Metadata Pesan — Objek `m`

Setiap pesan WhatsApp masuk diserialisasi via `smsg()` / `serializeM()` (`system/bot/whatsapp/lib/serializer.js`):

```js
bot.register("message", ({ m }) => {
  console.log(m.id);            // id pesan
  console.log(m.chat);          // remoteJid (grup atau dm)
  console.log(m.isGroup);       // boolean
  console.log(m.sender);        // jid ter-decode
  console.log(m.fromMe);        // boolean
  console.log(m.isBaileys);     // true jika dibuat bot (BAE5 / 3EB0)
  console.log(m.mtype);         // tipe pesan: conversation, imageMessage, videoMessage, ...
  console.log(m.msg);           // objek konten mentah
  console.log(m.text);          // text / caption / contentText (string)
  console.log(m.mentionedJid);  // array jid yang di-mention
  console.log(m.name);          // pushName || getName()
  console.log(m.quoted);        // pesan yang di-quote (jika ada) — lihat bawah

  m.reply("hello");            // balas dengan quoted
  m.react("❤️");                // reaksi ke pesan ini
  m.download();                // Buffer media (jika url/directPath)
  m.copy();                    // deep copy
  m.copyNForward(jid);          // forward dengan konteks
  m.cMod(jid, text, sender);    // modifikasi copy
  m.delete();                  // hapus pesan
  m.forward(jid);
});
```

**Quoted (`m.quoted`):**

```js
m.quoted.id          // stanzaId
m.quoted.chat        // remoteJid yang di-quote
m.quoted.sender      // jid ter-decode penulis quote
m.quoted.fromMe      // boolean
m.quoted.isBaileys   // boolean
m.quoted.mtype       // tipe
m.quoted.text        // text / caption
m.quoted.mentionedJid
m.quoted.name
m.quoted.fakeObj     // WebMessageInfo untuk relay
m.quoted.download()  // Buffer
m.quoted.reply(text)
m.quoted.copy()
m.quoted.forward(jid)
m.quoted.copyNForward(jid)
m.quoted.cMod(jid, text, sender)
m.quoted.delete()
m.getQuotedObj()     // async — load original dari store
```

**Penanganan LID:** LID grup (`@lid`) diresolusi ke nomor telepon via `fetchGroupMetadata` sebelum `m` dibuat, jadi `m.sender` dan `m.quoted.sender` adalah JID `@s.whatsapp.net` yang stabil.

---

## Fungsi Pesan — 30+ Metode `send*`

Semua metode di-mix ke socket Baileys via `makeWASocket()` → `extMsgs()` / `extendChats` / `extendGroups` (`system/bot/whatsapp/lib/`). `sock` di plugin = socket yang diperkaya.

```js
// Di plugin mana pun run({ sock, m })
await sock.sendMessage(m.chat, { text: "hello" }, { quoted: m });
await sock.reply(m.chat, "hello", m);
```

**Daftar lengkap:**

| Metode | Signature | Apa yang Dikirim |
|---|---|---|
| `sendMessage` | `(jid, content, opts)` | Native Baileys |
| `reply` | `(jid, text, quoted, opts)` | Teks + mention ter-parse |
| `sendMessageModify` | `(jid, text, msg, {title, body, thumbnail, url, largeThumb, ads})` | Preview link dengan `externalAdReply` |
| `sendMessageModifyV2` | `(jid, text, fakeTitle\|msg, opts)` | Varian `locationMessage` quote palsu |
| `sendMessageVerify` / `sendMessageVerifyV2` | `(jid, text, fakeName, opts)` | Gaya terverifikasi `locationMessage` quoted |
| `sendProgress` | `(jid, text, quoted)` | Edit progres animasi (`protocolMessage type 14`) |
| `sendSticker` | `(jid, media, quoted, {packname, author})` | Stiker WebP dengan exif |
| `sendVideoAsSticker` | `(jid, media, quoted, opts)` | Video → stiker WebP |
| `sendFile` | `(jid, media, filename, caption, quoted, opts)` | Auto-deteksi `image/video/audio/document` |
| `sndAlb` / `sendAlbumMessage` / `sendAlbum` | `(jid, medias, {text, delay, quoted})` | Album (Baileys `albumMessage`) |
| `sendContact` | `(jid, data, quoted, {org, website, email})` | vCard (dukung foto + deskripsi biz) |
| `sendReact` | `(jid, emoji, key)` | Reaksi |
| `sendPoll` / `sendPollV2` | `(jid, name, {options, multiselect}, quoted)` | Pembuatan poll |
| `pollResult` | `(jid, {name, votes}, quoted)` | Hasil poll |
| `sendPtv` | `(jid, media, quoted, opts)` | Video PTV (`ptv: true`) |
| `copyNForward` | `(jid, msg, forceForward, opts)` | Copy + forward (tangani viewOnce) |
| `replyButton` / `sendIAMessage` | `(jid, buttons, msg, {header, content, footer, media, multiple, mentions})` | Tombol native flow dengan header lokasi/media opsional |
| `sendFromAI` | `(jid, text, quoted, opts)` | Pesan AI (`supportPayload`, `forwardedAiBotMessageInfo`) |
| `groupStatus` | `(jid, content, {private})` | Status grup (`status@broadcast` atau flag `groupStatus`, warna background) |
| `sendMetaMsg` / `sendMetaMsgV1/V2/V3` | `(jid, items, quoted, opts)` | Pesan kaya AI via `AIRich` (`addText`, `addCode`, `addTable`, `addSource`, `addImage`, `addSuggest`) |
| `sendCarousel` | `(jid, cards, msg, {content, footer})` | Pesan interaktif carousel |
| `aiRich` | `() => AIRich` | Instance builder |
| `sendGroupV4Invite` | `(jid, participant, code, ttl, name, caption)` | Invite grup |
| `downloadM` | `(m, type, saveToFile)` | Unduh media dari pesan |
| `downloadAndSaveMediaMessage` | `(message, filename, attachExtension)` | Simpan ke file |
| `parseMention` / `mention` | `(text) => jids` | Ekstrak mention |
| `getFile` | `(path) => {data, mime, ext}` | Buffer + tipe dari URL/file/buffer |
| `resize` | `(input, w, h)` | Jimp resize → thumbnail Buffer |
| `sizeLimit` | `(str, maxMB)` | Cek head untuk ukuran URL/file |
| `serializeM` / `smsg` | `(m) => m` | Serialisasi mentah ke `m` kaya |
| `delay` | `(ms)` | Helper sleep |

Ditambah native Baileys: `sendPresenceUpdate`, `readMessages`, `groupMetadata`, `profilePictureUrl`, `getBusinessProfile`, `relayMessage`, `generateMessageId`, `decodeJid`, `getName`.

### Pembahasan Mendalam SDK — Media, `jpegThumbnail`, Tombol & Stiker

Penggunaan benar untuk SDK yang sudah diperbaiki. Semua contoh **aman Baileys** dan menggunakan `Buffer` untuk `jpegThumbnail`. `hasMediaAttachment` (bukan `hasMedia`) wajib untuk header interaktif.

#### 1. Media — Gambar / Video / Dokumen (auto-deteksi)

`sendIAMessage` dan `sendFile` kini auto-deteksi mime via `file-type` dan memanggil `prepareWAMessageMedia` dengan key yang tepat.

```js
// Di plugin run({ sock, m })
const fs = require("fs");

// Gambar dari Buffer / URL / path — otomatis membuat imageMessage
await sock.sendIAMessage(m.chat, [
  { text: "Ya", id: "yes" },
  { text: "Tidak",  id: "no" }
], m, {
  header: "Pilih",
  content: "Pilih satu",
  footer: "© Akano-Bot",
  media: fs.readFileSync("./media/image.jpg") // Buffer | "https://..." | "./path.jpg"
});

// Video — terdeteksi sebagai videoMessage (tidak dipaksa jadi image)
await sock.sendIAMessage(m.chat, buttons, m, {
  header: "Video",
  content: "Tonton",
  media: "./media/clip.mp4" // otomatis -> { video: Buffer }
});

// Dokumen — terdeteksi sebagai documentMessage
await sock.sendIAMessage(m.chat, buttons, m, {
  header: "PDF",
  content: "Buka file",
  media: "./media/file.pdf" // otomatis -> { document: Buffer, mimetype, fileName }
});

// Objek eksplisit juga bisa
await sock.sendIAMessage(m.chat, buttons, m, {
  header: "Kustom",
  content: "Halo",
  media: { image: Buffer.from("...") } // atau { video: buf } atau { document: buf }
});
```

Internal:

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

#### 2. `jpegThumbnail` — Selalu `Buffer`, Jangan String Base64

Diperbaiki: `jpegThumbnail` harus `Buffer` (bytes). **Jangan** gunakan `thumb.toString("base64")`.

```js
// Benar
const thumb = await sock.resize(await fs.promises.readFile("./thumb.jpg"), 300, 300);
await sock.sendIAMessage(m.chat, buttons, m, {
  header: "Lokasi",
  content: "Kunjungi kami",
  media: {
    name: "Akano HQ",
    address: "Jakarta",
    latitude: -6.2,
    longitude: 106.8,
    buffer: thumb, // akan di-resize ke Buffer dan diset sebagai jpegThumbnail: Buffer
    url: "https://akano.my.id"
  }
});
// Di dalam SDK:
// const thumb = await sock.resize(raw, 300, 300); // Buffer
// locationMessage: { ..., jpegThumbnail: thumb } // Buffer, bukan string

// Thumbnail manual untuk pesan lain:
const jpegThumb = await sock.resize(fs.readFileSync("./image.jpg"), 200, 200);
await sock.sendMessage(m.chat, { image: fs.readFileSync("./image.jpg"), caption: "Hai", jpegThumbnail: jpegThumb });
// SALAH: jpegThumbnail: thumb.toString("base64")  -> string, akan gagal di WA
```

Untuk `externalAdReply` / `locationMessage`, selalu kirim `Buffer`:

```js
await sock.sendMessage(m.chat, {
  text: "Preview",
  contextInfo: { externalAdReply: { title: "Akano", body: "Halo", thumbnail: thumbBuffer } }
});
```

#### 3. Tombol dengan Media — `hasMediaAttachment` + Header Interaktif

```js
// Tombol teks (quick_reply)
await sock.sendIAMessage(m.chat, [
  { text: "Menu", command: "menu" },
  { text: "Ping", id: "ping" }
], m, {
  header: "Judul header",
  content: "Teks body",
  footer: "Footer",
  media: "./media/banner.jpg", // header media opsional
  mentions: [m.sender]
});

// Native flow dengan paramsJson
await sock.sendIAMessage(m.chat, [
  { name: "cta_url", buttonParamsJson: JSON.stringify({ display_text: "Kunjungi", url: "https://akano.my.id" }) },
  { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "Halo", id: "hello" }) }
], m, {
  header: "Toko",
  content: "Pilih aksi",
  multiple: { list_title: "Opsi", button_title: "Buka" }, // bottom_sheet
  v2: true // messageVersion 2
});

// Tombol lokasi (header locationMessage)
await sock.replyButton(m.chat, [
  { text: "Petunjuk", id: "dir" }
], m, {
  header: "Toko Kami",
  content: "Ayo kunjungi",
  footer: "© Akano",
  media: {
    location: { latitude: -6.2, longitude: 106.8, name: "Akano HQ", address: "Jakarta", buffer: "./media/map.jpg" }
  }
});
```

Bentuk header yang dikirim via `relayMessage`:

```js
{
  interactiveMessage: {
    header: {
      title: "Header",
      subtitle: "",
      hasMediaAttachment: true, // bukan hasMedia
      imageMessage: { url, directPath, ... } // atau videoMessage / documentMessage / locationMessage
    },
    body: { text: "Body" },
    footer: { text: "Footer" },
    nativeFlowMessage: { buttons, ... }
  }
}
```

#### 4. Stiker — `packname`/`author`, `sticker: Buffer`, Exif Konsisten

Diperbaiki: `load()` sebelum `exif=` dan `sticker: Buffer` (bukan `{url: Buffer}`). `sticker-pack-id` kini konsisten `https://github.com/kutashiakano/Akano-Bot`.

```js
// Stiker gambar
await sock.sendSticker(m.chat, "./media/image.jpg", m, {
  packname: "Akano Pack",
  author: "Akano-Bot",
  categories: ["😀"]
});
// Sama untuk Buffer / URL / data URL / base64
await sock.sendSticker(m.chat, fs.readFileSync("./photo.png"), m, { packname: "Pack Ku", author: "Saya" });
await sock.sendSticker(m.chat, "https://example.com/image.jpg", m, { packname: "Web", author: "Bot" });

// Stiker video (animasi)
await sock.sendVideoAsSticker(m.chat, "./media/clip.mp4", m, {
  packname: "Akano",
  author: "Bot"
});
await sock.sendVideoAsSticker(m.chat, fs.readFileSync("./video.mp4"), m, {
  packname: "Pack", author: "Author", categories: ["🔥"]
});

// Exif manual (level rendah) — load sebelum exif!
const { Image } = require("node-webpmux");
const { makeExif } = require("./system/bot/whatsapp/lib/exif");
const webp = await imageToWebp(buffer);
const img = new Image();
await img.load(webp);                 // urutan benar
img.exif = makeExif("Pack", "Author", ["😀"]); // lalu set exif
await img.save("./sticker.webp");

// Helper converter (benar)
const { sticker } = require("./system/bot/whatsapp/lib/converter");
const webpBuff = await sticker(buffer, { packname: "P", author: "A" }); // mengembalikan Buffer dengan exif
await sock.sendMessage(m.chat, { sticker: webpBuff }); // Buffer, bukan {url: webpBuff}
```

Baileys mengharapkan:

```js
await sock.sendMessage(jid, { sticker: Buffer.from(webp) }); // benar
// SALAH: { sticker: { url: Buffer } }  -> tidak akan tampil
```

Metadata pack disimpan via EXIF `node-webpmux` dengan id konstan `https://github.com/kutashiakano/Akano-Bot`.

### Penggunaan NPM

```bash
npm install github:kutashiakano/Akano-Bot
# atau setelah publish:
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

## Menambahkan Plugin — Terpadu + Per-Platform

### Terpadu — `define()` (Rekomendasi, bekerja di WhatsApp + Telegram + Discord)

Satu file `define()` bekerja di mana saja. Taruh di `system/bot/*/plugins/<kategori>/` mana pun.

```js
const { define } = require("../../../plugin"); // atau ../../../sdk

module.exports = define({
  name: ["hello", "hi"],        // perintah + alias
  category: "tools",            // grup menu
  help: "Menyapa",              // deskripsi
  example: "/hello world",
  cooldown: 3000,               // ms
  owner: false,
  group: false,
  admin: false,
  premium: false,
  private: false,
  botAdmin: false,
  options: [
    { name: "name", desc: "Siapa yang disapa", type: 3, required: false }
  ],
  run: async ({ platform, args, named, text, reply, sock, client, Utils, fmt }) => {
    // platform: "whatsapp" | "telegram" | "discord"
    // args: array posisi, named: mapping dari options, text: gabungan args
    // reply(), sock/client, Utils (= fmt), setting, Config
    await reply(`Halo, ${args[0] || named.name || "Dunia"}!`);
  },
});
```

Key alias: `usage` (= `name`), `use` (= `example`), `hidden`, `async` (= `run`), `desc` (= `help`).  
Helper `Utils` / `fmt`: `status()`, `emoji()`, `sec()`, `panel()`, `list()`, `toTime()`, `matcher()`.

**Import terpadu SDK:**

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

Ekspor SDK: `define`, `Utils` (=`fmt`), `fmt`, `settings()`, `config()`, `owners()`, `Database`/`getDB()`, instance live `wa()`/`tg()`/`dc()`, `libs()` (`{ baileys, grammy, discord }`), builder `mbuilder`/`bbuilder`/`abuilder`/`ebuilder`/`modal`/`textInput`.

### Per-Platform (Klasik)

**WhatsApp** — `system/bot/whatsapp/plugins/<kategori>/hello.js`

```js
let handler = async (m, { text, sock, isOwner, isAdmin, isBotAdmin }) => {
  await m.reply(`Halo, ${text || "Dunia"}!`);
};
handler.help = ["hello"];
handler.tags = ["tools"];
handler.command = ["hello"];
handler.owner = false;
handler.group = false;
handler.admin = false;
module.exports = handler;
```

**Telegram** — `system/bot/telegram/plugins/<kategori>/hello.js` (grammY)

```js
module.exports = {
  help: "Menyapa",
  command: ["hello"],
  tags: ["tools"],
  run: async (ctx) => {
    await ctx.reply(`Halo, ${ctx.text || "Dunia"}!`);
  },
};
```

**Discord** — `system/bot/discord/plugins/tools/hello.js` (discord.js)

```js
module.exports = {
  name: "hello",
  description: "Menyapa",
  options: [{ name: "name", description: "Siapa yang disapa", type: 3, required: false }],
  async execute(interaction) {
    const name = interaction.options.getString("name") || "Dunia";
    await interaction.reply(`Halo, ${name}!`);
  },
};
```

> Plugin auto-discover via `scanDir` + sort, diawasi dengan `chokidar` (`add`/`change`/`unlink` dengan cek sintaks).

---

## Struktur Proyek

```
index.js                         # Entry: crash auto-restart (5 dalam 5menit)
main.js                          # CLI parser (yargs), launcher platform
settings.js                      # Global, settings, security, group, database
deploy/pm2.config.cjs            # Konfigurasi produksi PM2 (cap 1GB)
.env.example                     # Template env (~/.akano-env)
deploy/Dockerfile / deploy/docker-compose.yml  # Build container
install.sh                   # Installer Termux

system/
  core/
    context.js                   # AppContext (DI: db / settings / owners)
    watchdog.js                  # Memory watchdog (MEM_LIMIT_MB)
    heavy.js                     # heavyExec() — runner worker-thread
  bot/
    plugin.js -> sdk/index.js    # define() API terpadu
    format.js                    # Formatter (emoji / status / panel)
    print.js                     # Logger pesan
    whatsapp/
      lib/
        index.js                 # Client, makeWASocket, store, plugin scan
        events.js                # bindEvents, presence AFK, status@broadcast, reconnect
        messages.js              # extMsgs — 30+ metode send*
        serializer.js            # smsg / serializeM — objek m kaya
        adapter.js               # Multi-file auth dengan retry EPERM
        proxy.js                 # getProxyAgent (https-proxy-agent)
        socket.js                # Pembuatan socket Baileys
        ai-rich.js               # Builder AIRich
        chats.js / groups.js     # Helper grup/chat
        converter.js / exif.js   # Konversi stiker
        verification.js          # Verifikasi captcha ephemeral
        system-handler.js        # antiDel, init sistem
      handler.js                 # Routing perintah, gate, cooldown, spam, typo
      plugins/<kategori>/*.js    # Plugin WhatsApp
    telegram/
      handler.js / index.js      # handler grammY
      plugins/<kategori>/*.js    # Plugin Telegram
      group-manager.js           # Manajemen grup
    discord/
      handler.js / index.js      # handler discord.js
      plugins/
        tools/*.js               # settings, status, poll, gemini, ...
        music/*.js               # play, queue, engine, state, autoplay, ...
        images/*.js              # blur, invert, meme, rotate, ...
      start.js                   # Boot voice + klien
    website/dashboard/
      server/{api,auth,bus,store} # Backend dashboard
      client/{app.js, index.html} # Frontend dashboard
  scrapers/src/
    ytdpl.js                     # wrapper yt-dlp / gallery-dl (search, getMetadata, download)
    ytmusic.js / ytsession.js    # TV OAuth YouTube Music
  database/
    database.db                  # SQLite (utama)
    database.json                # Mirror JSON (auto-save tiap 300s)
    backups/                     # Backup JSON rotasi
```

---

## Kesalahan Umum & Penanganan

| Masalah | Penyebab | Perbaikan |
|---|---|---|
| `WhatsApp logged out` | Sesi invalid (`DisconnectReason.loggedOut`) | `rm -rf system/bot/whatsapp/sessions` → restart + pairing ulang |
| `login required` saat unduhan | Cookies kedaluwarsa | Refresh `cookies.txt` (Netscape, tiap ~30 hari) |
| `yt-dlp not found` / `gallery-dl not found` | Deps Python hilang | `pip3 install -U yt-dlp yt-dlp-ejs gallery-dl curl_cffi` atau tunggu auto-install |
| `YouTube 403` saat musik | yt-dlp usang atau tanpa EJS | `pip3 install -U yt-dlp yt-dlp-ejs` + restart |
| `Plugin disabled` | Auto-disable setelah 5 error | Cek log di `http://host:port` → perbaiki plugin → restart |
| `Discord login failed` | `DISCORD_TOKEN` invalid | Regenerasi di https://discord.com/developers → update `~/.akano-env` |
| `Telegram unauthorized` | `TELEGRAM_TOKEN` invalid | Buat ulang via @BotFather → update env |
| `File terlalu besar` | Upload melebihi batas | Naikkan `max_uploud` di `settings.js` (default 50 MB) |
| `OOM restart` | Heap melebihi batas | Naikkan `MEM_LIMIT_MB=1024` atau kurangi unduhan konkuren |
| `Voice Signalling` stuck | Race double-join | Diperbaiki via atomic `qLocks` + mutex `playNext`; jika stuck: `/stop` → `/p` lagi |
| `/ym sign in first` | YTM belum terhubung | Jalankan `/account login` → `youtube.com/pair` |
| `EADDRINUSE host:port` | Port dashboard terpakai | `fuser -k host:port/tcp` atau set `DASHBOARD_PORT=host:port` |
| `pino/index.js` error | Baileys butuh `pino@8` | `npm install pino@8` (bukan v9) |
| `grammy not installed` | Dep Telegram hilang | `npm install grammy` |
| `Database locked` | Kontensi WAL SQLite | Auto-retry (50ms), WAL checkpoint — tunggu atau restart |
| `Bad MAC` / `Failed to decrypt` | Race noise key WA | Difilter via `isBaileysInternalError` + watchdog `_forceReconnect` |
| `File size not found` | HEAD tanpa content-length | Bot balas `File size not found` — retry dengan link langsung |

---

## Lisensi

Kustom — bebas digunakan dan dimodifikasi. **Wajib kredit** — sebutkan penulis asli. **Dilarang salinan verbatim** tanpa perubahan bermakna. Lihat [`LICENSE`](LICENSE).

---

**Akano-Bot** — bot WhatsApp, bot Telegram, bot Discord, framework bot multi-platform Baileys. Chat AI, pengunduh media, pengunduh YouTube, pengunduh TikTok, pengunduh Instagram, manajemen grup, moderasi, musik Discord, YouTube Music. Dibuat untuk pencarian GitHub: `bot whatsapp` `bot telegram` `bot discord` `bot baileys` `bot multi-platform` `framework bot whatsapp` `bot chat ai` `bot pengunduh media` `bot youtube music` `bot musik discord` `bot manajemen grup` `bot moderasi` `bot stiker`.
