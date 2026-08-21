# Akano Bot — Bahasa Indonesia

> **Bahasa:** [English](README.md) · [Bahasa Indonesia](README.id-ID.md)

Chatbot multi-platform untuk **WhatsApp**, **Telegram**, dan **Discord** — satu codebase, sistem plugin modular.

![Version](https://img.shields.io/badge/Version-1.1.0-808080?style=flat)
![License](https://img.shields.io/badge/License-Custom-808080?style=flat)
![Node](https://img.shields.io/badge/Node.js-%3E%3D18-808080?style=flat)

> [!IMPORTANT]
> Saat ini masih **Beta**. Struktur dan fitur bisa berubah sewaktu-waktu.

## Tujuan Desain

- **Rapi** — struktur konsisten di tiga platform; satu cara untuk melakukan sesuatu.
- **Minimalis** — permukaan kecil, satu import untuk semua kebutuhan, tanpa lem platform-spesifik di plugin.
- **Mudah di-maintain** — core bersama, satu API `define()`, hot-reload dengan chokidar.
- **Mudah bikin plugin baru** — satu file, satu `define()`, langsung jalan di WhatsApp, Telegram, dan Discord.

## Fitur

| Fitur | Deskripsi |
|---|---|
| AI Chat | Percakapan bertenaga Gemini (WA / TG / DC) |
| Media Downloader | YouTube, TikTok, Instagram, Facebook, X/Twitter, Pinterest |
| Discord Music Player | Putar YouTube/Spotify dengan antrean, autoplay, lirik |
| **Pengalaman YouTube Music** | Pustaka YTM penuh: lagu disukai, playlist, chart, mood & genre, radio — login dengan akun sendiri, tanpa API key Google |
| Moderation | Kick, ban, mute, warn, promote/demote, hidetag, tagall |
| Group Management | Welcome, anti-link, anti-virtex, anti-delete, muting |
| Sticker Maker | Gambar/video → stiker |
| Utility | Ping, kalkulator, poll, AFK, pembaca view-once, info server |
| Images | Pembuatan/editing gambar (Discord) |
| Plugin System | Auto-loaded, hot-reload dengan chokidar |
| Keamanan | Cooldown per command, daily rate limit, memory watchdog |

## Persyaratan

- Node.js **18+** (diuji pada 26)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) — `pip3 install -U yt-dlp`
- [yt-dlp-ejs](https://github.com/yt-dlp/yt-dlp-ejs) — `pip3 install -U yt-dlp-ejs` (dibutuhkan untuk unduhan YouTube)
- [gallery-dl](https://github.com/mikf/gallery-dl) — `pip3 install -U gallery-dl`
- FFmpeg — `pkg install ffmpeg` (Termux) / `sudo apt install ffmpeg` (Linux)

## Instalasi

```bash
git clone https://github.com/kutashiakano/Akano-Bot.git
cd Akano-Bot
npm install
```

## Konfigurasi

Rahasia (secret) dibaca dari environment variable. Buat **`~/.akano-env`** (otomatis di-source oleh launcher) atau ekspor langsung:

```bash
# ~/.akano-env
DISCORD_TOKEN=token_bot_discord_anda      # wajib untuk Discord
TELEGRAM_TOKEN=token_telegram_anda        # wajib untuk Telegram (dari @BotFather)
OWNER=6281234567890                       # nomor WhatsApp owner (pisahkan dengan koma jika lebih dari satu)
DC_OWNER=id_discord_user_anda             # owner untuk command owner-gated Discord, opsional
TG_OWNER=id_telegram_user_anda            # owner untuk command owner-gated Telegram, opsional
MEM_LIMIT_MB=768                          # batas memory watchdog (MB), opsional
DC_DAILY_LIMIT=200                        # batas command harian Discord per user, opsional
YT_SESSION_KEY=4e6f...                    # enkripsi kredensial OAuth YouTube per-user (openssl rand -hex 16), opsional
```

Template tersedia di [.env.example](.env.example).

### Pairing WhatsApp

Jalankan bot sekali untuk WhatsApp dan pindai kode QR dengan ponsel. Session tersimpan di `system/bot/whatsapp/sessions/` — untuk pairing ulang, hapus folder itu lalu restart.

### Cookies (opsional)

Unduhan Instagram, Facebook, dan X mungkin memerlukan `cookies.txt` di root proyek berformat [Netscape HTTP Cookie File](https://github.com/kairi003/Get-cookies.txt-LOCALLY). Cookie kedaluwarsa sekitar ~30 hari — ekspor ulang saat unduhan gagal dengan "login required".

## Menjalankan

```bash
npm start          # semua platform
npm run wa         # WhatsApp saja
npm run dc         # Discord saja
npm run tg         # Telegram saja
npm run help       # bantuan CLI
```

Flag CLI: `node index.js --all | --whatsapp | --telegram | --discord | --help`

`index.js` auto-restart saat crash (maks 5 percobaan dalam 5 menit, exponential backoff).

### Docker (disarankan, tanpa setup)

Image prebuilt terbit otomatis ke **GHCR** setiap push — tanpa build lokal:

```bash
docker compose pull
docker compose up -d
```

Atau satu perintah:

```bash
docker run -d --name akano-bot --restart unless-stopped \
  -v $PWD/system/database:/app/system/database \
  -v $PWD/system/bot/whatsapp/sessions:/app/system/bot/whatsapp/sessions \
  --env-file .env \
  ghcr.io/kutashiakano/akano-bot:latest
```

Image: `ghcr.io/kutashiakano/akano-bot:latest` (linux/amd64 + arm64, auto-built oleh GitHub Actions).
Build sendiri: `docker build -t akano-bot . && docker run ... akano-bot`.

### Produksi dengan PM2

```bash
npm i -g pm2
pm2 start pm2.config.cjs   # restart saat crash, memory cap 1GB
pm2 save && pm2 startup
```

## Struktur

```
index.js                          # Entry point: crash auto-restart
main.js                           # Launcher & CLI parser
settings.js                       # Boot: globals, platforms, scrapers
pm2.config.cjs                    # Konfigurasi produksi PM2
.env.example                      # Template environment variable
system/
  core/                           # Core bersama (utils + core)
    context.js                    #   AppContext (akses DI ke db/settings/owner/...)
    watchdog.js                   #   Memory watchdog (MEM_LIMIT_MB)
    heavy.js                      #   heavyExec(): runner worker-thread
  bot/
    plugin.js                      #   define(): API plugin unified 3 platform
    format.js                      #   Formatter gaya Akano (emoji/status/sec/panel)
    whatsapp/  lib/ + plugins/    # Berbasis Baileys
    telegram/  handler.js + plugins/  # Berbasis Telegraf
    discord/   handler.js + plugins/  # Berbasis discord.js
      plugins/tools    settings, status, poll, ...
      plugins/music    play, queue, autoplay, lyrics, ...
      plugins/images   pembuatan/editing gambar
  scrapers/                       # yt-dlp, gemini, spotify, ytmusic, ...
  database/                       # SQLite (database.db) + backup JSON + error log
  image/                          # Aset statis (mis. avatar)
```

## YouTube Music — Pembahasan Mendalam (Discord)

Bot mengimplementasikan **pengalaman YouTube Music penuh** yang bekerja dengan **akun YouTube Anda sendiri** — tanpa Google API key atau proyek Google Cloud Console.

### Cara kerja sign-in (TV OAuth)

1. User menjalankan `/account login` di Discord. Kode pairing dibuat menggunakan **device flow YouTube TV** (flow OAuth yang sama dipakai smart TV).
2. User membuka `youtube.com/pair` dan memasukkan kode.
3. Token OAuth tersimpan **per-user**, terenkripsi dengan `YT_SESSION_KEY`, di dalam database.
4. Bot me-refresh token otomatis saat kedaluwarsa (`refreshAccessToken` dari youtubei.js — client id/secret di-scrape dari youtube.com/tv, **tanpa setup Google Console**).

> [!NOTE]
> Scope TV memberi akses penuh (`youtube` + `youtube-paid-content`). Like, playlist, dan radio semuanya berfungsi dengan token ini. Ini ditemukan dengan memanggil endpoint mentah `youtubei/v1` dengan Bearer token — parser musik youtubei.js resmi mengabaikan renderer TV (`tileRenderer`), sebab itulah API `ytmusic.liked` lama mengembalikan kosong.

### Yang bisa dilakukan user

| Fitur | Command | Catatan |
|---|---|---|
| Login / logout | `/account login`, `/account logout` | Jendela pairing 5 menit |
| Panel pustaka pribadi | `/account` | Ephemeral — hanya terlihat owner; setiap interaksi owner-gated |
| Lagu disukai | `/account liked` | Diputar langsung dari video yang disukai di YouTube Music |
| Playlist Anda | `/account playlists` | Jelajah → buka → putar atau tambah lagu |
| Like/unlike dari Discord | Tombol Like di panel `/account` dan track `/ym` | Endpoint `like/like`, params `like` / `indifferent` |
| Tambah ke playlist | Tombol Add di panel pustaka | `browse/edit_playlist` + `ACTION_ADD_VIDEO` |
| Charts | `/ym charts` | Browse guest `FEmusic_charts` (Trending 20, Daily Top Music Videos, Top 100, …) |
| Mood & genre | `/ym moods` | Chill, Energize, Focus, Party, Sad, Sleep, Workout + tile genre → pemilih playlist |
| Radio | `/ym radio` | Radio mulus dari track saat ini atau query pencarian (`next` endpoint + playlist `RDAMVM`) |
| Cari pustaka Anda | `/lib` | Routes playlist/liked/charts lewat TV API saat sudah sign-in |

### Cara kerjanya (`system/scrapers/src/ytsession.js`)

- **`tvReq`** — POST mentah `https://www.youtube.com/youtubei/v1/...` dengan `Authorization: Bearer <token>`, konteks client `TVHTML5` dan UA Firefox. Auto-refresh saat HTTP 401.
- **`tvRaw`** — wrapper `browse` generik (pustaka, playlist, detail playlist `VL<id>`).
- **`walk` / `tileTitle` / `findDeep`** — walker JSON yang mengumpulkan node `tileRenderer` persis seperti render aplikasi TV asli.
- **`likes`, `plists`, `plist`** — lagu disukai, daftar playlist (ID dikembalikan tanpa prefix `VL`), dan track satu playlist.
- **`like`, `addPl`** — like/unlike lagu, tambah video ke salah satu playlist Anda.
- **`moods`, `moodPls`** — guest `WEB_REMIX` browse dengan key publik ytmusicapi; tile mood memakai `musicNavigationButtonRenderer` (judul ada di `buttonText`, dan setiap mood berbagi satu `browseId` — **params** adalah selektor aslinya).
- **`radio`** — endpoint `next` dengan `playlistId: RDAMVM<videoId>`; track benih disaring sebelum masuk antrean.
- **`newPl`** — pembuatan playlist **sengaja diblokir** Google untuk perangkat TV (`400 Precondition check failed`), jadi dikembalikan penjelasan ramah.

> [!WARNING]
> Flow web (login URL) dan device (entry kode) dari setup Google Console lama sudah dihapus. Jika fork Anda masih mereferensikan `YT_OAUTH_CLIENT_ID` / `YT_OAUTH_CLIENT_SECRET` / `YT_OAUTH_FLOW`, itu sudah tidak ada — hapus.

## Discord Music Player — Pembahasan Mendalam

### Sumber

| Input | Yang terjadi |
|---|---|
| URL YouTube / YTM | Diputar langsung via yt-dlp |
| **Link track Spotify** | Diresolusi **cerdas**: metadata track (judul + artis) dicari di YouTube Music dan hasil YTM diputar — tanpa audio Spotify |
| Album/playlist Spotify | Diambil via Spotify API, lalu tiap track diresolusi di YouTube Music |
| SoundCloud / link audio langsung | Diputar langsung |
| Query teks biasa | Dicari di YouTube, YouTube Music, Spotify, dan SoundCloud; Anda memilih dari menu hasil |

### Engine pemutaran (`system/bot/discord/plugins/music/engine.js`)

- Antrean per guild dengan volume, loop (off/track/queue), shuffle, autoplay dengan preset genre, dan lirik.
- yt-dlp mengunduh track **saat ini** sesuai permintaan dan **mengunduh berikutnya** saat yang sekarang diputar (cache mencegah unduhan ulang).
- Koneksi suara tangguh: saat terputus, otomatis runding ulang; koneksi **dipakai ulang** jika sudah `Ready` dan pembuatan antrean atomik (`qLocks`), jadi dua command yang dijalankan bersamaan (`/p` + `/ym radio`) tidak pernah berebut channel suara; `playNext` dilindungi mutex (`nxtBusy`/`nxtPending`) sehingga track tidak pernah terlewat.
- State pemutar (lagu berjalan, antrean, volume, loop, shuffle, autoplay, filter) disimpan ke disk dan **dipulihkan setelah restart**.

### Command

```
/p <query|url>    Putar musik (link Spotify cerdas didukung)
/queue            Tampilkan / kelola antrean
/skip             Lewati track saat ini
/stop             Berhenti & keluar dari voice
/autoplay <genre> Aktifkan autoplay dengan preset genre
/lyrics           Lirik lagu berjalan
/volume <0-100>   Atur volume
/np               Sedang diputar
/search           Cari dan pilih track
/lib playlists | liked | picks | search
```

## Media Downloaders

Semua unduhan media berjalan lewat `system/scrapers/` — satu engine untuk satu tugas, terkelola otomatis:

| Engine | Dipakai untuk | Implementasi |
|---|---|---|
| **yt-dlp** | YouTube, TikTok, Instagram, Facebook, X/Twitter, Pinterest — video & audio | `system/scrapers/src/ytdpl.js` — biner dicek saat boot dan auto-install via pip saat pertama jalan (`yt-dlp`, `yt-dlp-ejs`, `gallery-dl`); termasuk fallback TikTok native |
| **gallery-dl** | Galeri gambar & situs booru | di `ytdpl.js` yang sama (`galleryDlBin`, default `gallery-dl`) |
| **YouTube Music API** | YTM sign-in: lagu disukai, playlist, charts, mood & genre, radio | `system/scrapers/src/ytmusic.js` — memakai session TV-OAuth Anda |
| **YouTube TV OAuth** | Sign-in akun tanpa Google API key | `system/scrapers/src/ytsession.js` — lihat Pembahasan Mendalam YouTube Music di atas |

Catatan:

- Biner yang hilang di-auto-install dengan `pip install --break-system-packages -U yt-dlp yt-dlp-ejs gallery-dl`; bisa juga diinstall manual.
- Instagram, Facebook, dan X mungkin memerlukan `cookies.txt` browsable di root proyek — refresh tiap ~30 hari.
- Permukaan platform: WhatsApp & Telegram memakai plugin downloader (`system/bot/whatsapp/plugins/downloader/`, `system/bot/telegram/plugins/downloader/`); Discord memakai `/p` + `/search` untuk pemutaran dan keluarga `/ym` (pembahasan mendalam di atas).

## Menambahkan Plugin

Satu API unified untuk tiga platform. `define({...})` menormalkan metadata (nama, alias, gates, cooldown, option) dan menyesuaikannya ke tiap platform — bentuk file plugin yang sama berlaku di mana saja.

**Unified (disarankan)** — taruh di folder plugin platform mana pun:

```js
const { define } = require("../../../plugin");   // system/bot/plugin.js

module.exports = define({
  name: ["hello", "hi"],          // command + alias
  category: "example",            // pengelompokan menu (WA) / module (DC)
  help: "Menyapa",
  owner: false,                   // gate khusus owner
  premium: false,                 // gate khusus premium
  group: false,                   // gate khusus grup
  admin: false,                   // gate admin grup (TG/DC)
  cooldown: 3000,                 // ms (TG/DC)
  options: [{ name: "name", desc: "Siapa yang disapa", required: false }],  // argumen slash Discord
  example: "/hello world",
  run: async ({ platform, args, text, user, reply, fmt }) => {
    // platform: "whatsapp" | "telegram" | "discord"
    await reply(`${fmt.emoji("done")} Halo, ${args[0] || args.name || "Dunia"}!`);
  },
});
```

`fmt` mengekspor formatter gaya Akano: `status()`, `emoji()`, `sec()`, `panel()`, `list()`, `toTime()`, `matcher()` — tersedia juga sebagai `Utils` di dalam context, jadi tiap plugin dapat `Utils` gratis.

Key alias juga diterima: `usage` (alias), `use` (baris usage/example), `hidden`, `category`, dan `async` sebagai handler (`define({ usage, async: (ctx) => {} })`).

Context unified sama di semua platform: `args` (array posisi), `named` (hasil mapping dari `options`, jadi `options` juga berfungsi di WhatsApp/Telegram), `text`, `user`, `reply`, `client`/`sock` (client platform — socket Baileys, Telegram bot API, atau client discord.js), `Utils` (= `fmt`), `setting`, `Config`, plus `fmt`. `options` yang `required` divalidasi di semua platform (Discord menegakkan secara native).

Di Discord builder tersedia di `client`/`sock` untuk import ringkas: `mbuilder` (`StringSelectMenuBuilder`), `bbuilder` (`ButtonBuilder`), `abuilder` (`ActionRowBuilder`), `ebuilder` (`EmbedBuilder`), `modal`, `textInput` — yaitu `const { mbuilder, abuilder } = sock` ketimbang `require("discord.js")`.

### SDK (`system/bot/sdk`)

SDK unified yang menggabungkan tiga platform — plugin hanya perlu satu import:

```js
const { define, Utils, mbuilder, abuilder, Database, wa, tg, dc, libs } = require("../../../sdk");

module.exports = define({
  usage: ["nowplaying"],                  // key alias juga berfungsi (async/use/hidden)
  category: "music",
  async: async ({ args, named, reply, sock }) => {
    // ctx dari define(): args, named (dari options), text, user, reply,
    // client/sock (socket Baileys, API Telegram atau client discord.js), Utils (= fmt), setting, Config
  },
});
```

Ekspor SDK: `define`, `Utils` (= `fmt`), `fmt`, `settings()`, `config()`, `owners()`, `Database`/`getDB()`, aksesor platform `wa()`/`ok()`/`tg()`/`dc()` (instance live: socket Baileys, bot Telegraf, client discord.js), `libs()` (lazy `{ baileys, telegraf, discord }`), dan builder Discord `mbuilder`/`bbuilder`/`abuilder`/`ebuilder`/`modal`/`textInput`.

Folder per-platform masih menerima bentuk klasik di bawah ini.

**WhatsApp** — `system/bot/whatsapp/plugins/<kategori>/hello.js`

```js
let handler = async (m, { text }) => {
  m.reply(`Halo, ${text || "Dunia"}!`);
};

handler.help = ["hello"];
handler.tags = ["tools"];
handler.command = ["hello"];

module.exports = handler;
```

**Telegram** — `system/bot/telegram/plugins/hello.js`

```js
module.exports = {
  help: "Menyapa",
  command: ["hello"],
  tags: ["general"],
  run: async (ctx, args) => {
    await ctx.reply(`Halo, ${args || "Dunia"}!`);
  },
};
```

**Discord** — `system/bot/discord/plugins/tools/hello.js`

```js
module.exports = {
  name: "hello",
  description: "Menyapa",
  options: [],
  async execute(interaction) {
    await interaction.reply(`Halo, ${interaction.user}!`);
  },
};
```

Lihat plugin yang sudah ada untuk metadata lengkap (permissions, cooldown, limits, examples).

Dokumentasi plugin yang lebih dalam (termasuk contoh plugin `ping`): [docs/adding-a-plugin.md](docs/adding-a-plugin.md).

## Konvensi penamaan

Codebase sengaja menyukai **identifier pendek** (mis. `mkQueue`, `tvReq`, `np`, `svState`, `plist`) — nama deskriptif lengkap ada di README ini dan di riwayat commit. Saat berkontribusi, pilih nama pendek kecuali konteksnya benar-benar butuh nama panjang.

## Masalah Umum

| Masalah | Solusi |
|---|---|
| WhatsApp logout | Hapus `system/bot/whatsapp/sessions/` dan pairing lagi |
| "login required" saat unduhan | Refresh `cookies.txt` |
| yt-dlp/gallery-dl tidak ditemukan | `pip3 install -U yt-dlp` / `pip3 install -U gallery-dl` |
| YouTube 403 saat memutar musik | Update yt-dlp **dan** install `pip3 install -U yt-dlp-ejs` (wajib sejak rollout SABR/PO-token YouTube) |
| Plugin nonaktif setelah error | Plugin auto-disable setelah error berulang — restart untuk mengaktifkan kembali |
| Login Discord gagal | Token tidak valid, atau bot belum diundang ke server |
| File terlalu besar untuk diunggah | Cek `max_uploud` di settings (default 50MB) |
| Bot restart melulu (OOM) | Naikkan `MEM_LIMIT_MB` atau kurangi beban per-proses |
| Voice macet di "Signalling" | Biasanya race double-join — sudah diperbaiki: pakai `mkQueue`/`playPanel` (keduanya atomik sekarang), atau stop lalu `/p` lagi |
| `/ym` bilang "sign in first" | Jalankan `/account login` sekali; charts dan mood jalan tanpa login, radio butuh akun |

## Lisensi

Lisensi kustom (lihat [LICENSE](LICENSE)).

- Bebas dipakai, dimodifikasi, dan dijual
- **Wajib kredit** — sebutkan penulis asli (kutashiakano/Akano-Bot)
- **Dilarang salin kata per kata** — versi yang dijual/didistribusikan harus punya perubahan yang bermakna