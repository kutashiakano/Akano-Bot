# Adding a Plugin

Satu file plugin, jalan di **tiga platform** (WhatsApp, Telegram, Discord) tanpa modifikasi. Format unified ini dibuat lewat `define()` dari `system/bot/plugin.js`, dan tidak perlu tahu platform apa yang sedang berjalan (platform agnostic — lihat AGENTS.md §2).

Semua plugin disimpan di `system/bot/<platform>/plugins/` (atau subfolder di dalamnya). Jangan pernah membuat folder terpisah per platform.

---

## Quick Start

Contoh canonical gaya Akano dengan `usage`, `async`, dan `use`. `define()` menerima key `run` atau `async` (alias), dan memanggilnya dengan **satu objek ctx** yang bisa langsung di-destructure.

```javascript
// system/bot/whatsapp/plugins/tools/ping.js (atau folder platform lain)
const { define } = require("../../../sdk"); // depth 2 folder; lihat §7

module.exports = define({
  usage: ["ping"],       // command / alias (bisa pakai name: [...] juga)
  use: "text",           // hint input yang dibutuhkan (tampil di menu)
  category: "tools",     // tag kategori
  help: "Cek respon bot",
  wait: true,            // tampilkan react 🕒 saat proses
  // options + required: divalidasi di SEMUA platform, hasilnya masuk ke ctx.named
  options: [
    { name: "text", desc: "Teks tambahan (opsional)", required: false },
  ],
  async: async ({ text, args, named, reply, Utils, sock }) => {
    // text  : string, hasil join args
    // args  : array argumen posisi
    // named : { text: "..." } hasil mapping dari options
    // reply : kirim pesan balasan (resolve safe di semua platform)
    // Utils : = fmt (system/bot/format.js), pakai Utils.texted / Utils.example
    // sock  : client aktif platform ini (WA: sock, TG: bot, Discord: client)
    try {
      const msg = text ? `${text}\n\n` : "";
      const status = named.text || args[0] || "online";
      return reply(
        `${msg}乂  *P O N G*\n\n` +
          `\t◦  *Status* : ✅ ${Utils.texted("mono", status)}`
      );
    } catch (e) {
      return reply(Utils.jsonFormat(e)); // fail-soft, jangan throw
    }
  },
});
```

> Catatan: **semua plugin di repo ini sudah memakai bentuk canonical `define()` ini** (key `usage`/`name`, `category`, `help`, gates, `options`, handler `async`). Bentuk lama per-platform (`module.exports = handler` + `handler.help/tags/command` di WA, `module.exports = { run: async (ctx, args) => ... }` di TG, `module.exports = { execute(interaction) }` di Discord) sudah dikonversi otomatis ke bentuk ini. Plugin baru cukup langsung pakai `define()` seperti contoh di atas.

---

## Full Option Reference

Semua key di bawah adalah key milik objek `m` yang dilewatkan ke `define(m)`:

| Key | Tipe | Default | Behavior |
| --- | --- | --- | --- |
| `name` | string \| string[] | `"unnamed"` | Nama command + alias. `names[0]` adalah nama utama. |
| `usage` | string \| string[] | — | Alias dari `name` (dipakai sebagai nama utama & trigger). |
| `command` | string \| string[] | — | Fallback bila `name` dan `usage` tidak ada. |
| `category` | string | `"tools"` | Kategori, menjadi `tags[0]` (untuk menu). |
| `help` | string \| string[] | — | Deskripsi; fallback ke `desc`, lalu join nama. |
| `desc` / `description` | string | — | Alias untuk `help`. |
| `options` | array | `[]` | `{ name, type?, desc?, required?, choices? }`. `type` default `3` (string). **Option `required: true` divalidasi otomatis di semua platform** — di WA/TG dipetakan posisional dari `args` ke `ctx.named`, yang missing akan menolak pesan dengan pesan "Missing required ...". |
| `owner` | boolean | `false` | Hanya owner bot yang boleh pakai. |
| `rowner` | boolean | `false` | Gate owner (reserved, divalidasi middleware). |
| `premium` | boolean | `false` | Hanya pengguna premium. |
| `group` | boolean | `false` | Hanya di dalam grup. |
| `admin` | boolean | `false` | Hanya admin grup. |
| `private` | boolean | `false` | Hanya chat pribadi. |
| `botAdmin` | boolean | `false` | Bot harus jadi admin. |
| `reg` | boolean | `false` | User harus terdaftar dulu. |
| `limit` | boolean | `false` | Menghabiskan limit harian user. |
| `cooldown` | number | `0` | Cooldown dalam milidetik. |
| `example` / `use` | string | `""` | `example = m.example \|\| m.use`; `use` juga disimpan terpisah (hint input). Dipakai menu/help. |
| `wait` | boolean | `false` | Tampilkan react/pesan 🕒 saat diproses. |
| `hidden` | boolean | `false` | Sembunyikan dari daftar menu. |
| `error` | number | `0` | Penghitung error (passthrough ke registry). |
| `before` | `async (ctx, extra) => boolean` | — | **Pre-hook** — dijalankan sebelum `run`. Return `true` untuk stop. Tersedia di **semua platform**: WA `before(m, { budy })` (dipanggil di `handler.js:368/434` untuk `plugins.before` global & `pl.before` per-plugin), TG `before(ctx, { budy })` (`handler.js:164`), DC `before(interaction, { budy })` (`handler.js:229` — `budy` = `interaction.options.getString("query")`). |
| `run` / `async` | `async (ctx) => {}` | no-op | **Executor.** Keduanya diterima; `async` adalah alias gaya Akano. Dijalankan dengan satu argumen `ctx`. |

Key lain yang tidak ada di daftar tetap **di-pass-through** (mis. `customPrefix`, `exp`, `fail`) dan tersedia di objek plugin.

---

## The ctx Object

Objek `ctx` (satu-satunya argumen `run`/`async`) berisi:

| Field | Platform | Keterangan |
| --- | --- | --- |
| `platform` | semua | `"discord"` \| `"whatsapp"` \| `"telegram"`. |
| `m` | WA | Pesan WA mentah (punya `m.reply`, `m.sender`, `m.pushName`, `m.chat`). |
| `that` | WA | Module handler lama (untuk `this`). |
| `props` | WA | Props command (`cmd`): `{ args, text, command, sock, isOwner, isPrems, isAdmin, isBotAdmin }`. |
| `ctx` | TG | Context Telegram (punya `ctx.reply`, `ctx.from`, dst). |
| `interaction` | Discord | Objek `Interaction` discord.js. |
| `args` | semua | Array argumen posisi. |
| `named` | semua | Object hasil mapping dari `options` (key = nama option). |
| `text` | semua | `args.join(" ")` (WA: `cmd.text`). |
| `command` | WA, TG | Nama command yang dipanggil (TG diambil dari `ctx.match[0]`, prefix `/` di-strip). |
| `user` | semua | WA: `m.sender`; TG: `ctx.from.id`; Discord: `interaction.user`. |
| `userId` | Discord | `interaction.user.id`. |
| `guild` / `channel` | Discord | Guild & channel tempat command dijalankan. |
| `sock` / `client` | semua | Client aktif: WA `cmd.sock`, TG `ctx.telegram`, Discord `interaction.client`. |
| `Utils` | semua | Module `system/bot/format.js` (=`fmt`). |
| `setting` | semua | `global.settings \|\| {}`. |
| `Config` | semua | `global.config \|\| null`. |
| `reply(content, extra?)` | semua | Reply pesan. Discord: `extra.ephemeral` untuk reply tersembunyi. Selalu resolve (tidak throw). |
| `editReply(content)` | Discord | Edit reply setelah `deferReply()`/reply. |
| `usage()` | semua | String `"nama <opt> [opt]"` dibangun dari nama utama + options. |
| `fmt` | semua | Sama dengan `Utils`. |
| `mbuilder`, `bbuilder`, `abuilder`, `ebuilder`, `modal`, `textInput` | semua | Builder Discord (`StringSelectMenuBuilder`, `ButtonBuilder`, `ActionRowBuilder`, `EmbedBuilder`, `ModalBuilder`, `TextInputBuilder`) — di-spread langsung ke ctx dari `system/bot/djs.js`. |

---

## Visual Style Guidelines

Salinan verbatim dari **AGENTS.md §1.5** — wajib dipatuhi **SEMUA** plugin:

> - **Error / Warning**: Gunakan emoji `🚩` (Contoh: `Utils.texted('bold', '🚩 Invalid input.')`)
> - **Processing / React**: Gunakan emoji `🕒` saat mengirim react atau pesan menunggu.
> - **Section Header**: Gunakan karakter `乂` diikuti spasi dan teks kapital dengan spasi antar huruf (Contoh: `乂  *U S E R - P R O F I L E*`)
> - **List Bullet**: Gunakan karakter tab (`\t`) diikuti karakter `◦` dan spasi (Contoh: `\t◦  *Name* : ${m.pushName}`)
> - **Menu Tree**: Gunakan struktur pohon `┌  ◦`, `│  ◦`, dan `└  ◦` untuk daftar command.
> - **Emphasis**: Selalu gunakan `Utils.texted('bold', text)` untuk menonjolkan kata kunci.
> - **Footer**: Selalu akhiri pesan informasi panjang dengan variabel footer (misal: `global.footer` atau `setting.footer`).

Contoh penerapan (kombinasi `乂`, tab + `◦`, footer):

```javascript
let caption = `乂  *U S E R - P R O F I L E*\n\n`;
caption += `\t◦  *Name* : ${m.pushName}\n`;
caption += `\t◦  *Limit* : ${Utils.formatNumber(u.limit)}\n\n`;
caption += global.footer;
```

---

## SDK & Shortcuts

`system/bot/sdk/index.js` menyediakan **satu import** untuk semua kebutuhan:

```javascript
const sdk = require("../../../sdk"); // depth 2 folder, sesuaikan kedalaman
const { define, Utils, fmt } = sdk;
```

Ekspor SDK (lihat `system/bot/sdk/index.js`):

| Member | Keterangan |
| --- | --- |
| `define` | API plugin unified (dari `system/bot/plugin.js`). |
| `Utils` / `fmt` | Module `system/bot/format.js`. |
| `version` | Versi dari `package.json`. |
| `settings()` / `config()` | `global.settings` / `global.config`. |
| `owners()` | Array owner (WA + Discord + TG). |
| `Database` / `getDB()` | Abstraksi database (`system/database`). |
| `wa()` / `ok()` | Socket WhatsApp (`global.sock`). |
| `walib()` | Lazy `require("../whatsapp/lib")` — gabungan lib WA ke SDK biar simple: `makeWASocket`, `utils` (`downloadStatus`), `converter` (`ffmpeg`/`sticker`), `serializer` (`serializeM`/`smsg`), `auth`/`socket`/`events`. Dipakai WA plugin via `sdk.walib().utils` atau `require("../../lib")` tetap jalan. |
| `tg()` | Bot Telegram (`global.telegramBot.bot`). |
| `dc()` | Client Discord (`global.discordBot.client`). |
| `libs()` | `{ baileys, telegraf, discord }` (lazy require, aman null). |
| `Builders()` | Builder Discord dari `system/bot/djs.js`. |
| `mbuilder` ... `textInput` | Getter langsung untuk builder Discord. |

Shortcut penting:

- Builder Discord juga **di-spread ke ctx** — `const { mbuilder, abuilder } = c;` langsung jalan. Atau ambil via `require("<path>/djs")` (lihat §7).
- `Utils.texted(style, text)` — style: `bold`, `italic`, `mono`, `strike`, `underline`, `quote`, `code` (format.js:53).
- `Utils.example(isPrefix, command, botname)` — `"Contoh: .cmd botname"` (format.js:136).
- `Utils.sec(title)` + `Utils.panel(title, lines)` untuk section/menu.
- `Utils.status(key)` — pesan gate siap pakai (`owner`, `group`, `limit`, dll).
- `Utils.toDate(ms)`, `toTime(ms)`, `timeReverse(ms)`, `formatNumber(n)`, `isUrl(str)`, `jsonFormat(err)`.

> ⚠️ **JANGAN** mengimpor `baileys`, `telegraf`/`grammy`, atau `discord.js` langsung dari dalam folder plugin (AGENTS.md §10). Semua akses lewat `djs.js` / `sdk` / ctx (`sock`, `client`).

---

## Platform-Specific Request Shapes

Satu `define()` dijalankan berbeda per platform:

- **WhatsApp** — `run(ctx)` dipanggil sekali per pesan. `ctx` berisi `{ m, that, props, args, named, text, command, user, sock, isOwner, isPrems, isAdmin, isBotAdmin, reply, ... }`. Handler lama `module.exports = handler` (dengan `handler.help/tags/command`) di-wrap jadi `run: (c) => orig.apply(c.that, [c.m, c.props])`.
- **Telegram** — `run(ctx)` dengan `ctx.ctx` = context telegram (punya `.reply`), `args` = argumen posisi, `command` tanpa `/`. Handler lama `run: async (ctx, args)` di-wrap jadi `run: async (c) => orig.run(c.ctx, c.args)`.
- **Discord** — `run(ctx)` dengan `ctx.interaction` + `userId/guild/channel` + `editReply` + builder spread. Plugin gaya lama `module.exports = { name, description, options, execute(interaction) }` di-wrap jadi `run: (c) => orig.execute(c.interaction)`. Builder diambil dari `require(".../djs")` atau langsung dari ctx (`c.mbuilder`); objek discord.js (client, rest, guild) diakses via `ctx.client` / `ctx.interaction`.

**Relative import paths** (verifikasi langsung dari layout folder):

| Lokasi plugin | `plugin.js` | `sdk` | `djs.js` | `database` |
| --- | --- | --- | --- | --- |
| `system/bot/<platform>/plugins/x.js` (depth 1) | `require("../../plugin")` | `require("../../sdk")` | `require("../../djs")` | `require("../../../database")` |
| `system/bot/<platform>/plugins/<sub>/x.js` (depth 2) | `require("../../../plugin")` | `require("../../../sdk")` | `require("../../../djs")` | `require("../../../../database")` |

Contoh nyata di repo:

```javascript
// system/bot/discord/plugins/tools/status.js (depth 2)
const { EmbedBuilder, ChannelType } = global.djs;
const database = require("../../../../database");

// system/bot/whatsapp/plugins/tools/ping.js (depth 2)
const { define } = require("../../../plugin");

// system/bot/telegram/plugins/downloader/youtube.js (depth 2)
const { define } = require("../../../plugin");
```

Aturan: dari file plugin, naik `..` sekali per level folder (`plugins/` = level 1 → 1x `..`), lalu temukan target di `system/bot/` (`plugin.js`, `djs.js`, `sdk/`) atau `system/` (`database`).

> Builder Discord **tidak di-import** — `global.djs` dipasang saat boot (satu sumber: `system/bot/djs.js`), dan di dalam handler pakai `sock.mbuilder/bbuilder/abuilder/ebuilder`.

## Dokumen lain

- [adding-a-plugin.en.md](adding-a-plugin.en.md) — versi Bahasa Inggris
- [cookies.md](cookies.md) — `cookies.txt` untuk unduhan Instagram/Facebook/X (lengkap dengan letak file `../../../../../cookies.txt`)
- [cookies.en.md](cookies.en.md) — English version
- [ytmusic.en.md](ytmusic.en.md) — dokumentasi lengkap YouTube Music (Discord)

> **package.json**: edit langsung `Akano-Bot/package.json` — dependency yang tidak pernah di-`require` sudah dihapus (`discord-gamecord`, `libsodium-wrappers`, `link-preview-js`, `lowdb`, `opusscript`, `prism-media`). Jika menambah plugin baru dan butuh package baru, cukup `npm i <pkg>` lalu `require` via SDK/`libs()` — jangan import langsung di plugin (ikuti AGENTS.md §10).
