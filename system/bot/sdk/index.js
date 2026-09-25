import path from "path";
import {
  core as fmt,
  card as dcCard, button as dcButton, actionRow as dcRow, watch as dcWatch, clear as dcClear,
  attach as dcAttach, thumb as dcThumb, meter as dcMeter, clock as dcClock, md as dcMd,
  sanitize as txtSanitize, splitSmart as txtSplit, stripMd as txtStrip,
  Cooldown as SdkCooldown, SpamDetection as SdkSpam,
  reply as waReply, poll as waPoll, file as waFile, sticker as waSticker, react as waReact,
  mention as waMention, delay as waDelay, download as waDownload,
  answerTap, mediaFile, isConflict, classifyError, Esc as tgEsc, chop as tgChop,
  presence as tgPresence, typing as tgTypingRaw, keyboard as tgKb, sendRetry, sendReact,
  isLink, isVirtex, extractLinks, AntiDelete, Queue as SdkQueue,
  telegram as tgNs, discord as dcNs
} from "@kutashiakanocanzy/sdk";
import sdkConverter from "./common/converter.js";
import sdkPerm from "./common/permission.js";
import sdkProxy from "./common/proxy.js";
import * as walibModule from "../whatsapp/lib/index.js";
import dbModule from "../../database/index.js";
import packageJson from "../../../package.json" with { type: "json" };

const ICON_DIR = path.join(import.meta.dirname, "..", "website", "dashboard", "client", "icons");
try { dcNs.icons(ICON_DIR); } catch {}

const ui = {
  embed: () => dcCard(),
  btn: (id, label, style) => dcButton(id, label, style),
  row: (buttons) => dcRow(buttons),
  collect: (msg, filter, ms, onEnd) => dcWatch(msg, filter, ms, onEnd),
  strip: (msg) => dcClear(msg),
  file: (name) => dcAttach(name),
  art: (name, embed) => dcThumb(name, embed),
  bar: (cur, max, len) => dcMeter(cur, max, len),
  chunk: (text, maxLength) => tgChop(text, maxLength || 1900),
  fmtTime: (ms) => dcClock(ms),
  rich: (src) => dcMd(src)
};

const aiText = {
  sanitizeMd: (src) => txtSanitize(src),
  splitSmart: (text, max) => txtSplit(text, max),
  stripMd: (src) => txtStrip(src)
};

function wa() {
  return global.sock || null;
}

function ok() {
  return global.sock || null;
}

function walib() {
  return walibModule;
}

function msgqueue() {
  return global.msgqueue || global.queue || null;
}

async function waSend(sock, chat, content, quoted) {
  return sock.sendMessage(chat, content, quoted ? { quoted: quoted } : {});
}

async function waMedia(sock, chat, buf, kind, quoted, extra) {
  const content = Object.assign({}, extra);
  if (kind === "audio") {
    content.audio = buf;
    if (!content.mimetype) content.mimetype = "audio/mpeg";
    if (content.ptt === undefined) content.ptt = true;
  } else {
    content[kind] = buf;
  }
  return waSend(sock, chat, content, quoted);
}

const whatsapp = {
  wa: wa,
  ok: ok,
  walib: walib,
  Cooldown: (...a) => new SdkCooldown(...a),
  SpamDetection: (...a) => new SdkSpam(...a),
  msgqueue: msgqueue,
  send: waSend,
  media: waMedia
};

function tg() {
  return global.telegramBot?.bot || global.telegramBot?.api || null;
}

const telegram = {
  tg: tg,
  answerCb: answerTap,
  inputFile: mediaFile,
  isConflictError: isConflict,
  describeError: classifyError,
  esc: tgEsc,
  splitMessage: tgChop,
  typing: (ctx, action) => action ? tgPresence(ctx, action) : tgTypingRaw(ctx),
  kb: tgKb,
  retry: sendRetry,
  react: sendReact
};

for (const key of ["Bot", "Api", "Composer", "session", "InlineKeyboard", "Keyboard", "InputMediaBuilder", "InputFile", "GrammyError", "HttpError", "BotError", "hydrateFiles"]) {
  Object.defineProperty(telegram, key, {
    enumerable: true,
    configurable: true,
    get: () => tgNs[key]
  });
}

const tgFull = telegram;

function buildMap(d) {
  return {
    mbuilder: d.StringSelectMenuBuilder,
    bbuilder: d.ButtonBuilder,
    abuilder: d.ActionRowBuilder,
    ebuilder: d.EmbedBuilder,
    modal: d.ModalBuilder,
    textInput: d.TextInputBuilder,
    EmbedBuilder: d.EmbedBuilder,
    ActionRowBuilder: d.ActionRowBuilder,
    ButtonBuilder: d.ButtonBuilder,
    ButtonStyle: d.ButtonStyle,
    StringSelectMenuBuilder: d.StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder: d.StringSelectMenuOptionBuilder,
    ModalBuilder: d.ModalBuilder,
    TextInputBuilder: d.TextInputBuilder,
    TextInputStyle: d.TextInputStyle,
    AttachmentBuilder: d.AttachmentBuilder,
    PermissionFlagsBits: d.PermissionFlagsBits,
    ChannelType: d.ChannelType,
    Colors: d.Colors,
    MessageFlags: d.MessageFlags,
    Collection: d.Collection,
    ComponentType: d.ComponentType
  };
}

let _builders = null;

function loadBuilders() {
  if (_builders) return _builders;
  let d = null;
  try { d = dcNs.engine(); } catch {}
  if (!d) return null;
  _builders = buildMap(d);
  return _builders;
}

const djs = () => loadBuilders() || {};
const Builders = djs;

function dc() {
  return global.discordBot?.client || null;
}

const discord = {
  loadBuilders: loadBuilders,
  djs: djs,
  Builders: Builders,
  engine: () => dcNs.engine(),
  dc: dc
};

for (const key of ["mbuilder", "bbuilder", "abuilder", "ebuilder", "modal", "textInput"]) {
  Object.defineProperty(discord, key, {
    enumerable: true,
    get: () => (loadBuilders() || {})[key]
  });
}

let _libs = null;

async function libs() {
  if (!_libs) {
    const attempt = async name => {
      try {
        const mod = await import(name);
        return mod.default ?? mod;
      } catch (e) {
        return null;
      }
    };
    _libs = {
      baileys: await attempt("@whiskeysockets/baileys"),
      grammy: await attempt("grammy"),
      telegraf: await attempt("telegraf"),
      discord: await attempt("discord.js")
    };
  }
  return _libs;
}

function define(m = {}) {
  const names = m.usage ? Array.isArray(m.usage) ? m.usage : [ m.usage ] : Array.isArray(m.name) ? m.name : [ m.name || m.command || "unnamed" ];
  const run = m.run || m.async || (async () => {});
  const gate = {
    owner: m.owner ?? false,
    rowner: m.rowner ?? false,
    premium: m.premium ?? false,
    group: m.group ?? false,
    admin: m.admin ?? false,
    private: m.private ?? false,
    botAdmin: m.botAdmin ?? false,
    reg: m.reg ?? false,
    limit: m.limit ?? false,
    cooldown: m.cooldown ?? 0
  };
  const mapOpt = o => {
    const r = {
      name: o.name,
      type: o.type || 3,
      description: o.desc || o.description || o.name,
      required: !!o.required
    };
    if (o.choices) r.choices = o.choices;
    if (o.min_value !== undefined) r.min_value = o.min_value;
    if (o.max_value !== undefined) r.max_value = o.max_value;
    if (Array.isArray(o.options)) r.options = o.options.map(mapOpt);
    return r;
  };
  const options = (m.options || []).map(mapOpt);
  const usage = () => names[0] + " " + options.map(o => o.required ? `<${o.name}>` : `[${o.name}]`).join(" ");
  const mapNamed = argsArray => {
    const named = {};
    if (options.length) {
      for (let i = 0; i < options.length; i++) named[options[i].name] = argsArray[i];
    }
    return named;
  };
  const missingRequired = named => options.filter(o => o.required && (named[o.name] === undefined || named[o.name] === ""));
  const phase = {
    __unified: true,
    name: names[0],
    description: m.help || m.desc || names.join(", "),
    help: m.help || m.desc || names.join(", "),
    command: names,
    tags: [ m.category || "tools" ],
    options: options,
    ...gate,
    example: m.example || m.use || "",
    wait: !!m.wait,
    error: 0,
    hidden: !!m.hidden,
    use: m.use || "",
    ...passthrough(m),
    async execute(interaction) {
      const named = {};
      const dig = opts => {
        for (const x of opts || []) {
          if (x.type === 1 || x.type === 2) dig(x.options); else named[x.name] = x.value;
        }
      };
      dig(interaction.options?.data);
      const argsArray = Object.values(named);
      const djs = discord.loadBuilders() || {};
      const pctx = {
        platform: "discord",
        interaction: interaction,
        ...djs,
        args: argsArray,
        named: named,
        text: argsArray.join(" "),
        user: interaction.user,
        userId: interaction.user?.id,
        guild: interaction.guild,
        channel: interaction.channel,
        sock: interaction.client,
        client: interaction.client,
        Utils: fmt,
        setting: global.settings || {},
        Config: global.config || null,
        DB: Database(),
        db: safeGet(),
        reply: (content, extra = {}) => new Promise(resolve => {
          try {
            const result = interaction.reply({
              content: content,
              flags: extra.ephemeral ? 64 : undefined
            });
            (result && typeof result.then === "function" ? result : Promise.resolve()).then(resolve).catch(() => resolve());
          } catch (e) {
            resolve();
          }
        }),
        editReply: content => new Promise(resolve => {
          try {
            const result = interaction.editReply({
              content: content
            });
            (result && typeof result.then === "function" ? result : Promise.resolve()).then(resolve).catch(() => resolve());
          } catch (e) {
            resolve();
          }
        }),
        usage: usage,
        fmt: fmt
      };
      try {
        const missing = missingRequired(named);
        if (missing.length) {
          return await pctx.reply("Missing required " + missing.map(o => o.name).join(", ") + "\nUsage: " + names[0] + " " + missing.map(o => `<${o.name}>`).join(" "), {
            ephemeral: true
          });
        }
        await run(pctx);
      } catch (e) {
        global.logError?.("dc.plugin." + names[0], e);
        await pctx.reply(fmt.status("error"), {
          ephemeral: true
        }).catch(() => {});
      }
    },
    async run(_m, _cmd) {
      const isWa = !!_m?.key?.id || !!_m?.mtype;
      if (isWa) {
        const cmd = _cmd || {};
        const argsArray = Array.isArray(cmd.args) ? cmd.args : [];
        const named = mapNamed(argsArray);
        const pctx = {
          platform: "whatsapp",
          m: _m,
          that: this,
          props: cmd,
          args: argsArray,
          named: named,
          text: cmd.text || "",
          command: cmd.command || "",
          user: _m?.sender,
          isOwner: cmd.isOwner,
          isPrems: cmd.isPrems,
          isAdmin: cmd.isAdmin,
          isBotAdmin: cmd.isBotAdmin,
          sock: cmd.sock,
          client: cmd.sock,
          Utils: fmt,
          setting: global.settings || {},
          Config: global.config || null,
          DB: Database(),
          db: safeGet(),
          reply: t => _m.reply(t),
          usage: usage,
          fmt: fmt
        };
        const missing = missingRequired(named);
        if (missing.length) {
          return await _m.reply("Missing required: " + missing.map(o => o.name).join(", ") + "\nUsage: " + usage());
        }
        return run(pctx);
      }
      const tg = _m || {};
      const rawCmd = Array.isArray(_cmd) ? _cmd : String(_cmd || "").split(/\s+/).filter(Boolean);
      const args = rawCmd;
      const named = mapNamed(args);
      const api = tg?.api || tg?.telegram || null;
      const pctx = Object.create(tg);
      const overrides = {
        platform: "telegram",
        ctx: tg,
        args: args,
        named: named,
        text: args.join(" "),
        command: String(tg?.match?.[0] || (tg?.msg?.text || tg?.msg?.caption || tg?.message?.caption || "")?.match(/^\/(\w+)/)?.[1] || "").replace(/^\//, ""),
        user: tg?.from?.id,
        sock: api,
        client: api,
        telegram: api,
        api: api,
        Utils: fmt,
        setting: global.settings || {},
        Config: global.config || null,
        DB: Database(),
        db: safeGet(),
        usage: usage,
        fmt: fmt
      };
      for (const [key, value] of Object.entries(overrides)) {
        try {
          Object.defineProperty(pctx, key, {
            value: value,
            writable: true,
            enumerable: true,
            configurable: true
          });
        } catch (e) {}
      }
      if (typeof pctx.reply !== "function") {
        pctx.reply = () => Promise.resolve();
      }
      const missing = missingRequired(named);
      if (missing.length) {
        return await tg.reply(fmt.texted("bold", "Missing required") + ": " + missing.map(o => o.name).join(", ") + "\n*Usage:* /" + usage());
      }
      return run(pctx);
    }
  };
  if (m.defaultMemberPermissions !== undefined) phase["default_member_permissions"] = m.defaultMemberPermissions;
  return phase;
}

function passthrough(m) {
  const own = new Set([ "name", "command", "help", "desc", "category", "options", "owner", "rowner", "premium", "group", "admin", "private", "botAdmin", "reg", "limit", "cooldown", "example", "wait", "run" ]);
  const extra = {};
  for (const k of Object.keys(m)) {
    if (!own.has(k) && m[k] !== undefined) extra[k] = m[k];
  }
  return extra;
}

function Database() {
  return dbModule;
}

function safeGet() {
  try {
    return Database().get();
  } catch {
    return null;
  }
}

const sdk = {
  define: define,
  Utils: fmt,
  fmt: fmt,
  version: packageJson.version || "",
  settings: () => global.settings || {},
  config: () => global.config || {},
  owners: () => [ global.owner, global.dcOwner, global.tgOwner ].filter(Boolean),
  Database: Database,
  getDB: () => Database().get(),
  DB: Database,
  db: safeGet,
  Cooldown: (...a) => whatsapp.Cooldown(...a),
  SpamDetection: (...a) => whatsapp.SpamDetection(...a),
  msgqueue: whatsapp.msgqueue,
  wa: whatsapp.wa,
  ok: whatsapp.ok,
  walib: whatsapp.walib,
  waSend: whatsapp.send,
  waMedia: whatsapp.media,
  waReply: waReply,
  waPoll: waPoll,
  waFile: waFile,
  waSticker: waSticker,
  waReact: waReact,
  waMention: waMention,
  waDelay: waDelay,
  waDownload: waDownload,
  tg: tg,
  tgFull: tgFull,
  answerCb: telegram.answerCb,
  inputFile: telegram.inputFile,
  tgEsc: telegram.esc,
  tgSplit: telegram.splitMessage,
  tgTyping: telegram.typing,
  tgKb: telegram.kb,
  tgRetry: telegram.retry,
  tgReact: telegram.react,
  dc: discord.dc,
  engine: discord.engine,
  libs: libs,
  Builders: discord.Builders,
  djs: discord.djs,
  loadBuilders: discord.loadBuilders,
  ui: ui,
  aiText: aiText,
  Anti: { isLink: isLink, isVirtex: isVirtex, extractLinks: extractLinks, AntiDelete: AntiDelete },
  Proxy: sdkProxy,
  Queue: SdkQueue,
  Converter: sdkConverter,
  Permission: sdkPerm
};

const builderGetters = [ "mbuilder", "bbuilder", "abuilder", "ebuilder", "modal", "textInput" ];

for (const key of builderGetters) {
  Object.defineProperty(sdk, key, {
    enumerable: true,
    get: () => discord[key]
  });
}

export default sdk;
export {
  define,
  ui,
  aiText,
  whatsapp,
  telegram,
  tgFull,
  discord,
  djs,
  Builders,
  loadBuilders,
  libs,
  Database,
  wa,
  ok,
  walib,
  msgqueue,
  waSend,
  waMedia,
  tg,
  dc,
  waReply,
  waPoll,
  waFile,
  waSticker,
  waReact,
  waMention,
  waDelay,
  waDownload,
  tgEsc,
  tgKb,
  answerTap,
  mediaFile,
  sendRetry,
  sendReact,
  fmt,
  fmt as Utils,
  tgChop,
  tgPresence,
  isLink,
  isVirtex,
  extractLinks,
  AntiDelete,
  tgNs,
  dcNs,
  SdkCooldown,
  SdkSpam
};
export { sdkConverter as Converter, sdkPerm as Permission, sdkProxy as Proxy, SdkQueue as Queue };
export const version = sdk.version;
export const settings = sdk.settings;
export const config = sdk.config;
export const owners = sdk.owners;
export const getDB = sdk.getDB;
export const DB = sdk.DB;
export const db = sdk.db;
export const Cooldown = sdk.Cooldown;
export const SpamDetection = sdk.SpamDetection;
export const answerCb = sdk.answerCb;
export const inputFile = sdk.inputFile;
export const tgSplit = sdk.tgSplit;
export const tgTyping = sdk.tgTyping;
export const tgRetry = sdk.tgRetry;
export const tgReact = sdk.tgReact;
export const engine = sdk.engine;
export const Anti = sdk.Anti;
export const mbuilder = sdk.mbuilder;
export const bbuilder = sdk.bbuilder;
export const abuilder = sdk.abuilder;
export const ebuilder = sdk.ebuilder;
export const modal = sdk.modal;
export const textInput = sdk.textInput;
