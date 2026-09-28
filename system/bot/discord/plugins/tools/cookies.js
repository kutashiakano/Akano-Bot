import fs from "node:fs";
import path from "node:path";
import { defineBot as define } from "@kutashiakanocanzy/sdk";

const COOKIES_PATH = path.join(process.cwd(), "cookies.txt");

function isOwner(userId) {
  try {
    const owners = [].concat(global.settings?.discord?.owner || global.dcOwner || []);
    return owners.includes(String(userId));
  } catch {
    return false;
  }
}

function validateNetscape(text) {
  const lines = String(text || "").split("\n").map(l => l.trim()).filter(Boolean);
  if (!lines.length) return { ok: false, reason: "Empty file." };
  const head = lines.find(l => l.startsWith("#"));
  if (!head || !/netscape/i.test(head)) return { ok: false, reason: "Missing '# Netscape HTTP Cookie File' header." };
  const rows = lines.filter(l => !l.startsWith("#"));
  if (!rows.length) return { ok: false, reason: "No cookie rows found." };
  const bad = rows.filter(l => l.split("\t").length < 6);
  if (bad.length > rows.length / 2) return { ok: false, reason: "Rows are not tab-separated (broken copy-paste?)." };
  return { ok: true, count: rows.length };
}

function statusEmbed(client) {
  let desc = "No cookies installed. Music/downloader runs without login (some videos may fail).";
  try {
    if (fs.existsSync(COOKIES_PATH)) {
      const st = fs.statSync(COOKIES_PATH);
      const n = String(fs.readFileSync(COOKIES_PATH, "utf8")).split("\n").filter(l => l.trim() && !l.trim().startsWith("#")).length;
      desc = `Installed: **${n} cookies** (${(st.size / 1024).toFixed(1)} KB, updated ${st.mtime.toISOString().slice(0, 10)}).`;
    }
  } catch {}
  return (new client.ebuilder).setColor("#5865F2").setTitle("yt-dlp Cookies").setDescription(desc + "\n\n**From phone:** export cookies with an app like “Get cookies.txt” (Android) or a cookie-export extension (Kiwi/Yandex), then attach the file here or paste the text.\nUpload replaces the old file (backup kept as `cookies.txt.bak`). Owner only.");
}

async function execute(interaction) {
  if (!isOwner(interaction.user.id)) {
    await interaction.reply({ content: "Only the bot owner can manage cookies.", flags: 64 }).catch(() => {});
    return;
  }
  const file = interaction.options.getAttachment("file");
  const pasted = (interaction.options.getString("text") || "").trim();
  if (!file && !pasted) {
    await interaction.reply({ embeds: [statusEmbed(interaction.client)], flags: 64 }).catch(() => {});
    return;
  }
  await interaction.deferReply({ flags: 64 }).catch(() => {});
  let content = pasted;
  try {
    if (file) {
      const res = await fetch(file.url);
      if (!res.ok) throw new Error("Download failed: " + res.status);
      content = await res.text();
    }
  } catch (e) {
    await interaction.editReply({ content: "Could not fetch the attachment: " + String((e && e.message) || e).slice(0, 120) }).catch(() => {});
    return;
  }
  if (content.length > 300000) {
    await interaction.editReply({ content: "File too large (max ~300KB)." }).catch(() => {});
    return;
  }
  const v = validateNetscape(content);
  if (!v.ok) {
    await interaction.editReply({ content: "Invalid cookies.txt: " + v.reason + "\nExport again as **Netscape HTTP Cookie File** format." }).catch(() => {});
    return;
  }
  try {
    if (fs.existsSync(COOKIES_PATH)) fs.copyFileSync(COOKIES_PATH, COOKIES_PATH + ".bak");
    fs.writeFileSync(COOKIES_PATH, content.replace(/\r\n/g, "\n"));
  } catch (e) {
    await interaction.editReply({ content: "Failed to save: " + String((e && e.message) || e).slice(0, 120) }).catch(() => {});
    return;
  }
  await interaction.editReply({ embeds: [(new interaction.client.ebuilder).setColor("#57F287").setTitle("Cookies Installed").setDescription(`**${v.count} cookies** saved. Music + downloader will use login session now.\nOld file backed up as \`cookies.txt.bak\`.`)] }).catch(() => {});
}

export default define({
  name: ["cookies"],
  category: "tools",
  description: "Install yt-dlp login cookies (owner only, phone friendly)",
  examples: ["/cookies (attach cookies.txt)", "/cookies (paste text)"],
  options: [{
    name: "file",
    type: 11,
    description: "cookies.txt file (Netscape format)",
    required: false
  }, {
    name: "text",
    type: 3,
    description: "Paste cookies.txt content (small files)",
    required: false
  }],
  run: async ctx => execute(ctx.interaction)
});
