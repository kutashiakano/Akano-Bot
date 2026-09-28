import database from "../../../../database/index.js";
import { defineBot as define } from "@kutashiakanocanzy/sdk";
const MODS = ["rpg", "confess", "music", "images", "tools"];
const MOD_LABEL = {
  rpg: "RPG",
  confess: "Confess",
  music: "Music",
  images: "Images",
  tools: "Tools"
};
function isStaff(interaction) {
  try {
    const p = interaction.memberPermissions;
    if (p && typeof p.has === "function") {
      if (p.has(8n) || p.has(32n)) {
        return true;
      }
    }
  } catch (e) {}
  try {
    const q = interaction.member && interaction.member.permissions;
    if (q && typeof q.has === "function") {
      if (q.has(8n) || q.has(32n)) {
        return true;
      }
    }
  } catch (e) {}
  return false;
}
function cfgOf(db, gid, gname) {
  if (!db.discord) {
    db.discord = { servers: {}, users: {} };
  }
  if (!db.discord.servers) {
    db.discord.servers = {};
  }
  let s = db.discord.servers[gid];
  if (!s || typeof s !== "object") {
    s = { id: gid, name: gname || "", createdAt: new Date().toISOString() };
    db.discord.servers[gid] = s;
  }
  if (!s.settings || typeof s.settings !== "object") {
    s.settings = {};
  }
  const st = s.settings;
  if (!st.modules || typeof st.modules !== "object") {
    st.modules = {};
  }
  for (const m of MODS) {
    if (typeof st.modules[m] !== "boolean") {
      st.modules[m] = true;
    }
  }
  if (!Array.isArray(st.disabled)) {
    st.disabled = [];
  }
  if (!st.channels || typeof st.channels !== "object") {
    st.channels = {};
  }
  return st;
}
function killNames() {
  try {
    const cmds = Object.values(global.discordCommands || {});
    const names = [];
    for (const c of cmds) {
      const n = Array.isArray(c.name) ? c.name[0] : c.name;
      if (typeof n === "string" && n && n !== "config" && names.includes(n) === false) {
        names.push(n);
      }
    }
    names.sort();
    return names.slice(0, 25);
  } catch (e) {
    return [];
  }
}
function panelEmbed(client, st) {
  const modText = MODS.map((m) => {
    return (MOD_LABEL[m] || m) + ": " + (st.modules[m] ? "ON" : "OFF");
  }).join("\n");
  const killText = st.disabled.length ? st.disabled.slice().sort().map((n) => {
    return "`" + n + "`";
  }).join(", ") : "None";
  const chanText = MODS.map((m) => {
    const ids = Array.isArray(st.channels[m]) ? st.channels[m] : [];
    return (MOD_LABEL[m] || m) + ": " + (ids.length ? ids.map((id) => {
      return "<#" + id + ">";
    }).join(" ") : "Everywhere");
  }).join("\n");
  return new client.ebuilder().setColor("#5865F2").setTitle("Server Configuration").addFields({
    name: "Modules",
    value: modText,
    inline: false
  }, {
    name: "Kill-switch",
    value: killText,
    inline: false
  }, {
    name: "Channels",
    value: chanText,
    inline: false
  }, {
    name: "Native",
    value: "Discord native controls need no code: Server Settings, Integrations, Akano — per-command role and channel locks there apply instantly.",
    inline: false
  });
}
function mainRows(client, st) {
  const rows = [];
  const toggles = MODS.map((m) => {
    const on = !!st.modules[m];
    return new client.bbuilder().setCustomId("cfg_mod_" + m).setLabel((MOD_LABEL[m] || m) + " " + (on ? "ON" : "OFF")).setStyle(on ? client.ButtonStyle.Success : client.ButtonStyle.Secondary);
  });
  rows.push(new client.abuilder().addComponents(...toggles));
  const names = killNames();
  if (names.length) {
    const sel = new client.mbuilder().setCustomId("cfg_kill").setPlaceholder("Toggle kill-switch").addOptions(names.map((n) => {
      return { label: n.slice(0, 100), value: n.slice(0, 100), description: "Toggle kill-switch" };
    }));
    rows.push(new client.abuilder().addComponents(sel));
  }
  const modSel = new client.mbuilder().setCustomId("cfg_chanmod").setPlaceholder("Pick module to set channels").addOptions(MODS.map((m) => {
    return { label: m, value: m, description: "Pick module to set channels" };
  }));
  rows.push(new client.abuilder().addComponents(modSel));
  rows.push(new client.abuilder().addComponents(new client.bbuilder().setCustomId("cfg_chan_clear").setLabel("Clear channels").setStyle(client.ButtonStyle.Secondary)));
  return rows;
}
function chanRows(client, mod) {
  const sel = new client.ChannelSelectMenuBuilder().setCustomId("cfg_chanset_" + mod).setPlaceholder("Select channels for " + mod).setMinValues(1).setMaxValues(5);
  return [new client.abuilder().addComponents(sel), new client.abuilder().addComponents(new client.bbuilder().setCustomId("cfg_back").setLabel("Back").setStyle(client.ButtonStyle.Secondary))];
}
export default define({
  name: ["config"],
  category: "tools",
  description: "Server control panel: modules, kill-switch, channels",
  defaultMemberPermissions: "32",
  options: [],
  run: async (ctx) => {
    const interaction = ctx.interaction;
    const client = interaction.client;
    await interaction.deferReply({ flags: 64 }).catch(() => {});
    if (isStaff(interaction) === false) {
      await interaction.editReply({ content: "Staff only" }).catch(() => {});
      return;
    }
    const gid = String(interaction.guildId || "");
    if (!gid) {
      await interaction.editReply({ content: "Staff only" }).catch(() => {});
      return;
    }
    const gname = (interaction.guild && interaction.guild.name) || "";
    const authorId = String(interaction.user.id);
    const db = database.get();
    const st = cfgOf(db, gid, gname);
    database.write(db).catch(() => {});
    await interaction.editReply({ embeds: [panelEmbed(client, st)], components: mainRows(client, st) }).catch(() => {});
    const msg = await interaction.fetchReply().catch(() => null);
    if (!msg) {
      return;
    }
    let pending = "";
    let col = null;
    try {
      col = msg.createMessageComponentCollector({ filter: (i) => {
        return i.user.id === authorId && isStaff(i) && !i.user.bot;
      }, time: 300000 });
    } catch (e) {
      return;
    }
    col.on("end", () => {
      try {
        msg.edit({ components: [] }).catch(() => {});
      } catch (e) {}
    });
    col.on("collect", async (i) => {
      try {
        const id = String(i.customId || "");
        if (id.indexOf("cfg_mod_") === 0) {
          const m = id.slice(8);
          if (MODS.includes(m) === false) {
            await i.deferUpdate().catch(() => {});
            return;
          }
          const d2 = database.get();
          const s2 = cfgOf(d2, gid, (i.guild && i.guild.name) || gname);
          s2.modules[m] = !s2.modules[m];
          database.write(d2).catch(() => {});
          await i.update({ embeds: [panelEmbed(i.client, s2)], components: mainRows(i.client, s2) }).catch(() => {});
          return;
        }
        if (id === "cfg_kill") {
          const killed = String((i.values && i.values[0]) || "");
          if (!killed) {
            await i.deferUpdate().catch(() => {});
            return;
          }
          const d2 = database.get();
          const s2 = cfgOf(d2, gid, (i.guild && i.guild.name) || gname);
          const at = s2.disabled.indexOf(killed);
          let on = false;
          if (at >= 0) {
            s2.disabled.splice(at, 1);
          } else {
            s2.disabled.push(killed);
            on = true;
          }
          database.write(d2).catch(() => {});
          await i.update({ embeds: [panelEmbed(i.client, s2)], components: mainRows(i.client, s2) }).catch(() => {});
          await i.followUp({ content: on ? "Kill-switch ON for " + killed + "." : "Kill-switch OFF for " + killed + ".", flags: 64 }).catch(() => {});
          return;
        }
        if (id === "cfg_chanmod") {
          const m = String((i.values && i.values[0]) || "");
          if (MODS.includes(m) === false) {
            await i.deferUpdate().catch(() => {});
            return;
          }
          pending = m;
          const d2 = database.get();
          const s2 = cfgOf(d2, gid, (i.guild && i.guild.name) || gname);
          await i.update({ embeds: [panelEmbed(i.client, s2)], components: chanRows(i.client, m) }).catch(() => {});
          return;
        }
        if (id.indexOf("cfg_chanset_") === 0) {
          const m = id.slice(12);
          if (MODS.includes(m) === false) {
            await i.deferUpdate().catch(() => {});
            return;
          }
          const ids = ((i.values && i.values.slice()) || []).filter(Boolean).slice(0, 5);
          const d2 = database.get();
          const s2 = cfgOf(d2, gid, (i.guild && i.guild.name) || gname);
          s2.channels[m] = ids;
          database.write(d2).catch(() => {});
          pending = "";
          await i.update({ embeds: [panelEmbed(i.client, s2)], components: mainRows(i.client, s2) }).catch(() => {});
          return;
        }
        if (id === "cfg_chan_clear") {
          if (!pending || MODS.includes(pending) === false) {
            await i.reply({ content: "Pick a module first.", flags: 64 }).catch(() => {});
            return;
          }
          const d2 = database.get();
          const s2 = cfgOf(d2, gid, (i.guild && i.guild.name) || gname);
          delete s2.channels[pending];
          database.write(d2).catch(() => {});
          pending = "";
          await i.update({ embeds: [panelEmbed(i.client, s2)], components: mainRows(i.client, s2) }).catch(() => {});
          return;
        }
        if (id === "cfg_back") {
          pending = "";
          const d2 = database.get();
          const s2 = cfgOf(d2, gid, (i.guild && i.guild.name) || gname);
          await i.update({ embeds: [panelEmbed(i.client, s2)], components: mainRows(i.client, s2) }).catch(() => {});
          return;
        }
        await i.deferUpdate().catch(() => {});
      } catch (e) {
        try {
          await i.deferUpdate().catch(() => {});
        } catch (e2) {}
      }
    });
  }
});
