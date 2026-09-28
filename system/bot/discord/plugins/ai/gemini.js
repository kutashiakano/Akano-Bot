import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import database from "../../../../database/index.js";
import { defineBot as define } from "@kutashiakanocanzy/sdk";
import { md } from "@kutashiakanocanzy/sdk";

async function downloadImage(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 30000);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) return null;
    const ct = String(r.headers.get("content-type") || "");
    if (ct && !ct.startsWith("image/")) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (!buf.length || buf.length > 10000000) return null;
    const ext = ct.includes("png") ? ".png" : ct.includes("gif") ? ".gif" : ct.includes("webp") ? ".webp" : ".jpg";
    const p = path.join(os.tmpdir(), "gemini-" + Date.now() + "-" + Math.floor(Math.random() * 1e6) + ext);
    fs.writeFileSync(p, buf);
    return p;
  } catch (e) {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function dropFile(p) {
  if (!p) return;
  try { fs.unlinkSync(p); } catch (e) {}
}

function splitMessage(text, maxLength) {
  return aiText.splitSmart(text, maxLength);
}

function aiChannelsOf(db, gid, gname) {
  if (!db.discord) db.discord = { servers: {}, users: {} };
  if (!db.discord.servers) db.discord.servers = {};
  let s = db.discord.servers[gid];
  if (!s || typeof s !== "object") {
    s = { id: gid, name: gname || "", createdAt: new Date().toISOString() };
    db.discord.servers[gid] = s;
  }
  if (!s.settings || typeof s.settings !== "object") s.settings = {};
  if (!Array.isArray(s.settings.aiChannels)) s.settings.aiChannels = [];
  return s.settings.aiChannels;
}

function isStaff(interaction) {
  try {
    if (interaction.memberPermissions) return interaction.memberPermissions.has(8n) || interaction.memberPermissions.has(32n);
    return !!(interaction.member && interaction.member.permissions && (interaction.member.permissions.has(8n) || interaction.member.permissions.has(32n)));
  } catch (e) {
    return false;
  }
}

async function askGemini(prompt, userId, imagePath) {
  const gemini = global.scraper && global.scraper.gemini;
  if (!gemini) throw new Error("Gemini module not available.");
  if (imagePath && typeof gemini.chatWithImage === "function") {
    const r = await gemini.chatWithImage(String(prompt || "Describe this image in detail.").slice(0, 1500), imagePath, String(userId));
    const t = typeof r === "string" ? r : String((r && r.text) || "");
    if (!t.trim()) throw new Error("Empty response from Gemini.");
    return t;
  }
  let full = "";
  await gemini.chat(String(prompt).slice(0, 1500), String(userId), chunk => { full += chunk; });
  if (!full.trim()) throw new Error("Empty response from Gemini.");
  return full;
}

export default define({
  name: [ "gemini" ],
  category: "tools",
  description: "Chat with Gemini AI (memory per user) or set AI auto-chat channels",
  options: [
    { name: "chat", type: 1, description: "Ask Gemini anything, text or image", options: [{ name: "prompt", type: 3, description: "Your question or message", required: false }, { name: "media", type: 11, description: "Optional image for Gemini to see", required: false }] },
    { name: "channel", type: 1, description: "Manage AI auto-chat channels (staff)", options: [{ name: "action", type: 3, description: "Add, remove, or show", required: true, choices: [{ name: "add", value: "add" }, { name: "remove", value: "remove" }, { name: "show", value: "show" }] }, { name: "target", type: 7, description: "Channel for add/remove", required: false }] },
    { name: "forget", type: 1, description: "Erase your conversation memory with Gemini" }
  ],
  run: async ctx => {
    const interaction = ctx.interaction;
    const EB = interaction.client.ebuilder;
    try { await interaction.deferReply(); } catch (e) { return; }
    let sub = "chat";
    try { sub = interaction.options.getSubcommand() || "chat"; } catch (e) {}
    const uid = String(interaction.user.id);
    if (sub === "forget") {
      try {
        const gemini = global.scraper && global.scraper.gemini;
        if (gemini) gemini.clearSession(uid);
      } catch (e) {}
      await interaction.editReply({ embeds: [new EB().setColor("#57F287").setTitle("Memory Erased").setDescription("Your conversation with Gemini was forgotten.")] }).catch(() => {});
      return;
    }
    if (sub === "channel") {
      if (!interaction.guildId) {
        await interaction.editReply({ content: "Use this inside a server." }).catch(() => {});
        return;
      }
      if (!isStaff(interaction)) {
        await interaction.editReply({ content: "Staff only." }).catch(() => {});
        return;
      }
      const db = database.get();
      const list = aiChannelsOf(db, String(interaction.guildId), interaction.guild && interaction.guild.name);
      const action = interaction.options.getString("action");
      const target = interaction.options.getChannel("target");
      if (action === "show" || !target) {
        await database.write(db).catch(() => {});
        await interaction.editReply({ content: list.length ? "AI auto-chat channels:\n" + list.map(id => "<#" + id + ">").join("\n") : "No AI channels set. Add one with /gemini channel add." }).catch(() => {});
        return;
      }
      if (action === "add") {
        if (!list.includes(target.id)) list.push(target.id);
        await database.write(db).catch(() => {});
        await interaction.editReply({ content: "<#" + target.id + "> is now an AI channel. Every message there is answered automatically, no slash needed. Use /gemini forget to reset memory." }).catch(() => {});
        return;
      }
      db.discord.servers[String(interaction.guildId)].settings.aiChannels = list.filter(x => x !== target.id);
      await database.write(db).catch(() => {});
      await interaction.editReply({ content: "<#" + target.id + "> is no longer an AI channel." }).catch(() => {});
      return;
    }
    const prompt = interaction.options.getString("prompt");
    const media = interaction.options.getAttachment("media");
    let imagePath = null;
    if (media && media.url) {
      imagePath = await downloadImage(media.url);
      if (!imagePath) {
        await interaction.editReply({ content: "Could not read that image (max 10 MB)." }).catch(() => {});
        return;
      }
    }
    if (!prompt && !imagePath) {
      await interaction.editReply({ content: "Write a prompt or attach an image." }).catch(() => {});
      return;
    }
    try {
      const fullResponse = await askGemini(prompt, uid, imagePath);
      const chunks = splitMessage(fullResponse, 4000).map(c => md(c));
      const firstEmbed = (new EB()).setColor("#4285F4").setAuthor({
        name: "Gemini AI",
        iconURL: "https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg"
      }).setDescription(chunks[0]).setFooter({
        text: "Requested by " + interaction.user.username
      }).setTimestamp();
      await interaction.editReply({ embeds: [firstEmbed] });
      for (let i = 1; i < chunks.length; i++) {
        await interaction.followUp({ embeds: [(new EB()).setColor("#4285F4").setDescription(chunks[i])] });
      }
    } catch (e) {
      console.error("[Gemini Discord]", e.message);
      if (e.message && e.message.includes("Header overflow")) {
        const gemini = global.scraper && global.scraper.gemini;
        if (gemini) gemini.clearSession(uid);
      }
      await interaction.editReply({ embeds: [(new EB()).setColor("#ED4245").setDescription(global.settings.message.geminiUnavailable)] });
    }
    dropFile(imagePath);
  }
});
