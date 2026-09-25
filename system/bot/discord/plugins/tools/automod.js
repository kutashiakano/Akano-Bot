import database from "../../../../database/index.js";
import sdkFacade from "../../../sdk/index.js";
const { define } = sdkFacade;

function cfgOf(db, gid, gname) {
  if (!db.discord) db.discord = { servers: {}, users: {} };
  if (!db.discord.servers) db.discord.servers = {};
  let s = db.discord.servers[gid];
  if (!s || typeof s !== "object") {
    s = { id: gid, name: gname || "", createdAt: new Date().toISOString() };
    db.discord.servers[gid] = s;
  }
  if (!s.settings || typeof s.settings !== "object") s.settings = {};
  if (!s.settings.automod || typeof s.settings.automod !== "object") {
    s.settings.automod = { enabled: false, words: [], invites: false, floodMsgs: 5, floodSecs: 10, capsPct: 80, capsLen: 20, action: "delete", timeoutMin: 10, exempt: [], log: "" };
  }
  const a = s.settings.automod;
  if (!Array.isArray(a.words)) a.words = [];
  if (!Array.isArray(a.exempt)) a.exempt = [];
  return a;
}

function isStaff(interaction) {
  try {
    if (interaction.memberPermissions) return interaction.memberPermissions.has(8n) || interaction.memberPermissions.has(32n);
    return !!(interaction.member && interaction.member.permissions && (interaction.member.permissions.has(8n) || interaction.member.permissions.has(32n)));
  } catch (e) {
    return false;
  }
}

async function maybeSync(interaction) {
  try {
    if (!interaction.guild) return;
    const db = database.get();
    const nat = db.discord?.servers?.[String(interaction.guildId)]?.settings?.automod?.native;
    if (!nat || !nat.on) return;
    const sync = await import("../../automod-sync.js");
    sync.syncGuild(interaction.guild).catch(e => {
      try { if (global.logError) global.logError("automod.autosync", e); } catch (e2) {}
    });
  } catch (e) {}
}

export default define({
  name: ["automod"],
  category: "tools",
  description: "Automatic moderation: word filter, invites, flood, caps",
  defaultMemberPermissions: "32",
  options: [
    { name: "on", type: 1, description: "Enable auto-mod" },
    { name: "off", type: 1, description: "Disable auto-mod" },
    { name: "status", type: 1, description: "Show auto-mod settings" },
    { name: "words", type: 1, description: "Manage banned words", options: [{ name: "action", type: 3, description: "Add, remove, or show", required: true, choices: [{ name: "add", value: "add" }, { name: "remove", value: "remove" }, { name: "show", value: "show" }] }, { name: "word", type: 3, description: "Word for add/remove", required: false }] },
    { name: "invites", type: 1, description: "Block Discord invite links", options: [{ name: "mode", type: 3, description: "On or off", required: true, choices: [{ name: "on", value: "on" }, { name: "off", value: "off" }] }] },
    { name: "flood", type: 1, description: "Limit messages per seconds (0 to disable)", options: [{ name: "messages", type: 4, description: "Max messages", required: true, min_value: 0, max_value: 20 }, { name: "seconds", type: 4, description: "Window seconds", required: true, min_value: 3, max_value: 120 }] },
    { name: "caps", type: 1, description: "Limit ALL-CAPS messages, percent 0 disables", options: [{ name: "percent", type: 4, description: "Caps percent 0-100", required: true, min_value: 0, max_value: 100 }] },
    { name: "action", type: 1, description: "What to do on violation", options: [{ name: "mode", type: 3, description: "Delete or timeout", required: true, choices: [{ name: "delete", value: "delete" }, { name: "timeout", value: "timeout" }] }] },
    { name: "timeout", type: 1, description: "Timeout length in minutes", options: [{ name: "minutes", type: 4, description: "1-1440", required: true, min_value: 1, max_value: 1440 }] },
    { name: "exempt", type: 1, description: "Role exempt from auto-mod", options: [{ name: "role", type: 8, description: "Role to exempt (empty to clear)", required: false }] },
    { name: "log", type: 1, description: "Log channel for violations", options: [{ name: "target", type: 7, description: "Channel (empty to clear)", required: false }] },
    { name: "native", type: 1, description: "Discord native AutoMod rules (badge progress)", options: [{ name: "action", type: 3, description: "Sync, off, or status", required: true, choices: [{ name: "sync", value: "sync" }, { name: "off", value: "off" }, { name: "status", value: "status" }] }] }
  ],
  run: async ctx => {
    const interaction = ctx.interaction;
    const EB = interaction.client.ebuilder;
    try { await interaction.deferReply({ flags: 64 }); } catch (e) { return; }
    if (!interaction.guildId) {
      await interaction.editReply({ content: "Use this inside a server." }).catch(() => {});
      return;
    }
    if (!isStaff(interaction)) {
      await interaction.editReply({ content: "Staff only." }).catch(() => {});
      return;
    }
    let sub = "status";
    try { sub = interaction.options.getSubcommand() || "status"; } catch (e) {}
    const db = database.get();
    const a = cfgOf(db, String(interaction.guildId), interaction.guild && interaction.guild.name);
    const save = async () => { await database.write(db).catch(() => {}); };
    const done = async text => { await interaction.editReply({ content: text }).catch(() => {}); };
    if (sub === "on") {
      a.enabled = true;
      await save();
      await done("Auto-mod is ON. Bot needs Manage Messages + Timeout Members permission to act.");
      return;
    }
    if (sub === "off") {
      a.enabled = false;
      await save();
      await done("Auto-mod is OFF.");
      return;
    }
    if (sub === "status") {
      const e = new EB().setColor("#5865F2").setTitle("Auto-mod Settings").addFields(
        { name: "Status", value: a.enabled ? "ON" : "OFF", inline: true },
        { name: "Action", value: a.action + (a.action === "timeout" ? " (" + a.timeoutMin + "m)" : ""), inline: true },
        { name: "Words", value: a.words.length ? a.words.slice(0, 20).join(", ") : "None", inline: false },
        { name: "Invites", value: a.invites ? "Blocked" : "Allowed", inline: true },
        { name: "Flood", value: a.floodMsgs > 0 ? a.floodMsgs + " per " + a.floodSecs + "s" : "Off", inline: true },
        { name: "Caps", value: a.capsPct > 0 ? a.capsPct + "% over " + a.capsLen + " chars" : "Off", inline: true },
        { name: "Exempt", value: a.exempt.length ? a.exempt.map(id => "<@&" + id + ">").join(" ") : "None", inline: false },
        { name: "Log", value: a.log ? "<#" + a.log + ">" : "None", inline: false }
      );
      await interaction.editReply({ embeds: [e] }).catch(() => {});
      return;
    }
    if (sub === "words") {
      const action = interaction.options.getString("action");
      const word = String(interaction.options.getString("word") || "").trim().toLowerCase().slice(0, 40);
      if (action === "show") {
        await done(a.words.length ? "Banned words: " + a.words.join(", ") : "No banned words.");
        return;
      }
      if (!word) {
        await done("Provide a word first.");
        return;
      }
      if (action === "add") {
        if (!a.words.includes(word)) a.words.push(word);
        await save();
        maybeSync(interaction);
        await done("Added banned word: " + word);
        return;
      }
      a.words = a.words.filter(w => w !== word);
      await save();
      maybeSync(interaction);
      await done("Removed banned word: " + word);
      return;
    }
    if (sub === "invites") {
      a.invites = interaction.options.getString("mode") === "on";
      await save();
      await done("Invite links are now " + (a.invites ? "blocked." : "allowed."));
      return;
    }
    if (sub === "flood") {
      a.floodMsgs = interaction.options.getInteger("messages");
      a.floodSecs = interaction.options.getInteger("seconds");
      await save();
      await done(a.floodMsgs > 0 ? "Flood limit: " + a.floodMsgs + " messages per " + a.floodSecs + "s." : "Flood protection off.");
      return;
    }
    if (sub === "caps") {
      a.capsPct = interaction.options.getInteger("percent");
      await save();
      await done(a.capsPct > 0 ? "Caps limit: " + a.capsPct + "%." : "Caps protection off.");
      return;
    }
    if (sub === "action") {
      a.action = interaction.options.getString("mode");
      await save();
      maybeSync(interaction);
      await done("Violation action: " + a.action + ".");
      return;
    }
    if (sub === "timeout") {
      a.timeoutMin = interaction.options.getInteger("minutes");
      await save();
      maybeSync(interaction);
      await done("Timeout length: " + a.timeoutMin + " minutes.");
      return;
    }
    if (sub === "exempt") {
      const role = interaction.options.getRole("role");
      if (!role) {
        a.exempt = [];
        await save();
        maybeSync(interaction);
        await done("Exempt roles cleared.");
        return;
      }
      if (!a.exempt.includes(role.id)) a.exempt.push(role.id);
      await save();
      maybeSync(interaction);
      await done("Exempted role: " + role.name);
      return;
    }
    if (sub === "log") {
      const target = interaction.options.getChannel("target");
      a.log = target ? target.id : "";
      await save();
      maybeSync(interaction);
      await done(target ? "Violations will be logged in <#" + target.id + ">." : "Log channel cleared.");
      return;
    }
    if (sub === "native") {
      const sync = await import("../../automod-sync.js");
      const action = interaction.options.getString("action");
      if (action === "status") {
        const nat = db.discord.servers[String(interaction.guildId)].settings.automod.native || {};
        const prog = await sync.badgeProgress().catch(() => ({ total: 0, per: [] }));
        const mine = ["keyword", "spam", "mentions", "preset"].filter(k => nat[k]).length;
        const e = new EB().setColor("#5865F2").setTitle("Native AutoMod").setDescription("Badge progress: " + prog.total + "/100 native rules.\nThis server: " + mine + "/4 Akano rules" + (nat.on ? " (sync ON)" : " (sync OFF)") + ".").setFooter({ text: "Badge needs Manage Server here + rules across servers" });
        await interaction.editReply({ embeds: [e] }).catch(() => {});
        return;
      }
      if (action === "off") {
        const n = await sync.disableGuild(interaction.guild).catch(() => 0);
        await done("Removed " + n + " Akano native rules from this server. Custom filter keeps running.");
        return;
      }
      await interaction.editReply({ content: "Syncing native rules, wait..." }).catch(() => {});
      try {
        const done2 = await sync.syncGuild(interaction.guild);
        const prog = await sync.badgeProgress().catch(() => ({ total: 0, per: [] }));
        await interaction.editReply({ content: "Synced 4 native rules (keyword, spam, mentions, profanity). Badge progress: " + prog.total + "/100." }).catch(() => {});
      } catch (e) {
        await interaction.editReply({ content: "Sync failed: " + String((e && e.message) || e).slice(0, 200) }).catch(() => {});
      }
      return;
    }
  }
});
