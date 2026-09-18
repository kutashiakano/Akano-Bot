let _builders = null;

function loadBuilders() {
  if (_builders) return _builders;
  const build = d => ({
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

const djs = () => loadBuilders() || {};
const Builders = djs;

function dc() {
  return global.discordBot?.client || null;
}

const api = {
  loadBuilders: loadBuilders,
  djs: djs,
  Builders: Builders,
  dc: dc
};

const builderKeys = [ "mbuilder", "bbuilder", "abuilder", "ebuilder", "modal", "textInput" ];

for (const key of builderKeys) {
  Object.defineProperty(api, key, {
    enumerable: true,
    get: () => (loadBuilders() || {})[key]
  });
}

module.exports = api;
