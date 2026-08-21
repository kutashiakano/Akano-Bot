# Adding a Plugin (English)

One plugin file, runs on **all three platforms** (WhatsApp, Telegram, Discord) with zero modifications. The unified format is built with `define()` from `system/bot/plugin.js`, and the plugin never needs to know which platform is currently running (platform agnostic — see AGENTS.md §2).

All plugins live in `system/bot/<platform>/plugins/` (or a subfolder). Never create a separate folder per platform.

The canonical file shape (this is the exact standard every plugin in this repo follows):

```javascript
// system/bot/whatsapp/plugins/tools/ping.js (or any platform folder)
const { define } = require("../../../sdk"); // depth-2 folder; see §7

module.exports = define({
  usage: ["ping"],       // command / alias (name: [...] also works)
  use: "text",           // input hint shown in the menu
  category: "tools",     // menu category
  help: "Check bot response",
  wait: true,            // shows a 🕒 react while processing
  // options + required are validated on ALL platforms, mapped into ctx.named
  options: [
    { name: "text", desc: "Extra text (optional)", required: false },
  ],
  async: async ({ text, args, named, reply, Utils, sock }) => {
    // text  : string, join of all positional args
    // args  : array of positional arguments
    // named : { text: "..." } mapped from options
    // reply : send a reply (safe-resolving on every platform)
    // Utils : = fmt (system/bot/format.js), use Utils.texted / Utils.example
    // sock  : the live platform client (WA socket, TG bot, Discord client)
    try {
      const msg = text ? `${text}\n\n` : "";
      const status = named.text || args[0] || "online";
      return reply(
        `${msg}乂  *P O N G*\n\n` +
          `\t◦  *Status* : ✅ ${Utils.texted("mono", status)}`
      );
    } catch (e) {
      return reply(Utils.jsonFormat(e)); // fail-soft, never throw
    }
  },
});
```

> Note: all plugins in this repository consistently use this canonical `define()` shape (name/usage keys, category, help, gates, options, async handler). The old per-platform shapes (`module.exports = handler` + `handler.help/tags/command` on WA, `module.exports = { run: async (ctx, args) => ... }` on TG, `module.exports = { execute(interaction) }` on Discord) were converted to it automatically.

---

## Full Option Reference

Every key below is a member of the object `m` passed to `define(m)`:

| Key | Type | Default | Behavior |
| --- | --- | --- | --- |
| `name` | string \| string[] | `"unnamed"` | Command name + aliases. `names[0]` is the main name. |
| `usage` | string \| string[] | — | Alias of `name` (used as main name & trigger). |
| `command` | string \| string[] | — | Fallback when `name` and `usage` are absent. |
| `category` | string | `"tools"` | Category, becomes `tags[0]` (menu grouping). |
| `help` | string \| string[] | — | Description; falls back to `desc`, then joined names. |
| `use` | string | — | Usage hint shown in menus; becomes `example` shortcut. |
| `example` | string | — | Full example line (`%cmd` is replaced with the prefix/command). |
| `options` | array | `[]` | Slash-command options (name, type, desc, required, choices). Mapped to `named` on all platforms. |
| `run` | fn | no-op | Executor. Receives one ctx argument. |
| `async` | fn | no-op | Alias of `run`. |
| `owner` | bool | `false` | Owner-only gate. |
| `rowner` | bool | `false` | Real-owner-only gate. |
| `premium` | bool | `false` | Premium-only gate. |
| `group` | bool | `false` | Group-only gate. |
| `admin` | bool | `false` | Group-admin gate (TG/DC). |
| `botAdmin` | bool | `false` | Bot must be group admin (WA). |
| `private` | bool | `false` | Private-chat-only gate. |
| `reg` | bool | `false` | User must be registered. |
| `cooldown` | number | `0` | Cooldown in ms (TG/DC). |
| `wait` | bool | `false` | Shows 🕒 while processing. |
| `hidden` | bool | `false` | Hides the command from menus. |
| `before` | `async (ctx, extra) => bool` | — | Optional pre-hook (**all platforms**): return `true` to stop. WA `before(m, { budy })` (`handler.js:368/434` — `plugins.before` global & `pl.before` per-plugin), TG `before(ctx, { budy })` (`handler.js:164`), DC `before(interaction, { budy })` (`handler.js:229`, `budy` = `options.getString("query")`). |
| any other key | — | — | Passed through onto the exported phase object. |

## Execution context (ctx)

The handler receives **one object** you can destructure. Same fields on every platform:

| Field | Description |
| --- | --- |
| `platform` | `"whatsapp"` \| `"telegram"` \| `"discord"` |
| `m` / `ctx` / `interaction` | Native message (WA), Telegram context, or Discord interaction |
| `args` | Positional arguments array (options values on Discord) |
| `named` | `{}` mapped from `options` — `options` therefore work on WA/TG too |
| `text` | Joined args string |
| `command` | Triggered command name |
| `user` | Sender id (WA number, TG id, DC user object) |
| `isOwner`, `isPrems`, `isAdmin`, `isBotAdmin` | Computed permission flags (WA) |
| `sock` / `client` | Live client: Baileys socket, Telegram bot, or discord.js client |
| `reply(text)` | Safe reply helper (resolves on all platforms) |
| `editReply(text)` | Discord: edit the pending reply |
| `Utils` | = `fmt` (formatters) |
| `setting` / `Config` | Runtime settings / config |
| `usage()` | Generated usage string from name + options |

On Discord the builders are attached to `sock`/`client` for compact imports:

```js
const { mbuilder, bbuilder, abuilder, ebuilder, modal, textInput } = sock;
// StringSelectMenuBuilder / ButtonBuilder / ActionRowBuilder / EmbedBuilder / ModalBuilder / TextInputBuilder
```

## Visual Style (must be consistent — AGENTS.md §1.5)

- 🚩 for error/warning replies, 🕒 for processing/wait messages.
- 乂 as section header, ◦ as bullet, menu tree with ┌/│/└.
- Use `Utils.texted('bold', ...)`, `Utils.example(...)`, `Utils.status(...)`.

## SDK (`system/bot/sdk`)

Plugins need just **one import**:

```js
const { define, Utils, mbuilder, abuilder, Database, wa, tg, dc, libs } = require("../../../sdk");

module.exports = define({
  usage: ["ping"],
  category: "tools",
  async: async ({ args, named, reply, sock }) => {
    // ...
  },
});
```

SDK exports: `define`, `Utils` (= `fmt`), `fmt`, `settings()`, `config()`, `owners()`, `Database`/`getDB()`, live platform accessors `wa()`/`ok()`/`walib()`/`tg()`/`dc()`, lazy `libs()` (`{ baileys, telegraf, discord }`), and the Discord builders. `walib()` is the WA lib merged into the SDK (`makeWASocket`, `utils`, `converter`, `serializer`, etc. — lazy `require("../whatsapp/lib")`).

## Import path cheatsheet

| File location | define / sdk | djs builders | database |
| --- | --- | --- | --- |
| `plugins/x.js` | `../../plugin` (or `../../sdk`) | `global.djs` | `../../../database` |
| `plugins/<sub>/x.js` | `../../../plugin` (or `../../../sdk`) | `global.djs` | `../../../../database` |

> Builders are never imported directly: `global.djs` is attached at boot (single source `system/bot/djs.js`), and inside handlers prefer `sock.mbuilder/bbuilder/abuilder/ebuilder`.

See also:

- [docs/adding-a-plugin.md](adding-a-plugin.md) — Indonesian version
- [docs/cookies.en.md](cookies.en.md) — cookies.txt for downloads
- [docs/ytmusic.en.md](ytmusic.en.md) — full YouTube Music (Discord) documentation