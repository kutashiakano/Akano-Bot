const fmt = require("../format");

let _libs = null;
function libs() {
  if (!_libs) {
    const attempt = (name) => {
      try {
        return require(name);
      } catch (e) {
        return null;
      }
    };
    _libs = {
      baileys: attempt("baileys"),
      telegraf: attempt("telegraf"),
      discord: attempt("discord.js"),
    };
  }
  return _libs;
}

let _builders = null;
function loadBuilders() {
  if (_builders) return _builders;
  const build = (d) => ({
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
    ComponentType: d.ComponentType,
  });
  const d = (() => {
    try {
      return require("discord.js");
    } catch (e) {
      return null;
    }
  })();
  if (d) {
    _builders = build(d);
    return _builders;
  }
  for (const p of Object.keys(require.cache || {})) {
    if (p.includes("discord.js")) delete require.cache[p];
  }
  _builders = null;
  return null;
}

function define(m = {}) {
  const names = m.usage
    ? Array.isArray(m.usage)
      ? m.usage
      : [m.usage]
    : Array.isArray(m.name)
      ? m.name
      : [m.name || m.command || "unnamed"];

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
    cooldown: m.cooldown ?? 0,
  };

  const options = (m.options || []).map((o) => ({
    name: o.name,
    type: o.type || 3,
    description: o.desc || o.description || o.name,
    required: !!o.required,
    choices: o.choices || undefined,
  }));

  const usage = () =>
    names[0] +
    " " +
    options
      .map((o) => (o.required ? `<${o.name}>` : `[${o.name}]`))
      .join(" ");

  const mapNamed = (argsArray) => {
    const named = {};
    if (options.length) {
      for (let i = 0; i < options.length; i++) named[options[i].name] = argsArray[i];
    }
    return named;
  };

  const missingRequired = (named) =>
    options.filter((o) => o.required && (named[o.name] === undefined || named[o.name] === ""));

  const phase = {
    __unified: true,
    name: names[0],
    description: m.help || m.desc || names.join(", "),
    help: m.help || m.desc || names.join(", "),
    command: names,
    tags: [m.category || "tools"],
    options,
    ...gate,
    example: m.example || m.use || "",
    wait: !!m.wait,
    error: 0,
    hidden: !!m.hidden,
    use: m.use || "",
    ...passthrough(m),

    async execute(interaction) {
      const named = {};
      const dig = (opts) => {
        for (const x of opts || []) {
          if (x.type === 1 || x.type === 2) dig(x.options);
          else named[x.name] = x.value;
        }
      };
      dig(interaction.options?.data);
      const argsArray = Object.values(named);
      const djs = loadBuilders() || {};
      const pctx = {
        platform: "discord",
        interaction,
        ...djs,
        args: argsArray,
        named,
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
        reply: (content, extra = {}) =>
          new Promise((resolve) => {
            try {
              const result = interaction.reply({
                content,
                flags: extra.ephemeral ? 64 : undefined,
              });
              (result && typeof result.then === "function" ? result : Promise.resolve()).then(resolve).catch(() => resolve());
            } catch (e) {
              resolve();
            }
          }),
        editReply: (content) =>
          new Promise((resolve) => {
            try {
              const result = interaction.editReply({ content });
              (result && typeof result.then === "function" ? result : Promise.resolve()).then(resolve).catch(() => resolve());
            } catch (e) {
              resolve();
            }
          }),
        usage,
        fmt,
      };
      try {
        const missing = missingRequired(named);
        if (missing.length) {
          return await pctx.reply("Missing required " + missing.map((o) => o.name).join(", ") + "\nUsage: " + names[0] + " " + missing.map((o) => `<${o.name}>`).join(" "), { ephemeral: true });
        }
        await run(pctx);
      } catch (e) {
        global.logError?.("dc.plugin." + names[0], e);
        await pctx.reply(fmt.status("error"), { ephemeral: true }).catch(() => {});
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
          named,
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
          reply: (t) => _m.reply(t),
          usage,
          fmt,
        };
        const missing = missingRequired(named);
        if (missing.length) {
          return await _m.reply(
            "Missing required: " + missing.map((o) => o.name).join(", ") + "\nUsage: " + usage(),
          );
        }
        return run(pctx);
      }

      const tg = _m;
      const args = Array.isArray(_cmd) ? _cmd : [];
      const named = mapNamed(args);
      const pctx = {
        platform: "telegram",
        ctx: tg,
        args,
        named,
        text: args.join(" "),
        command: String(tg?.match?.[0] || "").replace(/^\//, ""),
        user: tg?.from?.id,
        sock: tg?.telegram,
        client: tg?.telegram,
        Utils: fmt,
        setting: global.settings || {},
        Config: global.config || null,
        reply: (t) => Promise.resolve(tg.reply(t)).catch(() => {}),
        usage,
        fmt,
      };
      const missing = missingRequired(named);
      if (missing.length) {
        return await tg.reply(
          fmt.texted("bold", "Missing required") +
            ": " +
            missing.map((o) => o.name).join(", ") +
            "\n*Usage:* /" +
            usage(),
        );
      }
      return run(pctx);
    },
  };
  return phase;
}

function passthrough(m) {
  const own = new Set([
    "name",
    "command",
    "help",
    "desc",
    "category",
    "options",
    "owner",
    "rowner",
    "premium",
    "group",
    "admin",
    "private",
    "botAdmin",
    "reg",
    "limit",
    "cooldown",
    "example",
    "wait",
    "run",
  ]);
  const extra = {};
  for (const k of Object.keys(m)) {
    if (!own.has(k) && m[k] !== undefined) extra[k] = m[k];
  }
  return extra;
}

let _db = null;
function Database() {
  if (!_db) _db = require("../../database");
  return _db;
}

const djs = () => loadBuilders() || {};

const sdk = {
  define,
  Utils: fmt,
  fmt,
  version: require("../../../package.json").version || "",
  settings: () => global.settings || {},
  config: () => global.config || {},
  owners: () => [global.owner, global.dcOwner, global.tgOwner].filter(Boolean),
  Database,
  getDB: () => Database().get(),
  wa: () => global.sock || null,
  ok: () => global.sock || null,
  walib: (() => {
    let m = null;
    return () => {
      if (!m) m = require("../whatsapp/lib");
      return m;
    };
  })(),
  tg: () => global.telegramBot?.bot || null,
  dc: () => global.discordBot?.client || null,
  libs,
  Builders: djs,
  djs,
};

const builderGetters = [
  "mbuilder",
  "bbuilder",
  "abuilder",
  "ebuilder",
  "modal",
  "textInput",
];

for (const key of builderGetters) {
  Object.defineProperty(sdk, key, {
    enumerable: true,
    get: () => (loadBuilders() || {})[key],
  });
}

module.exports = sdk;