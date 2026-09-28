import { defineBot as define } from "@kutashiakanocanzy/sdk";
import { ui as makeUi } from "@kutashiakanocanzy/sdk";
import path from "node:path";
const ui = makeUi({ iconsDir: path.join(import.meta.dirname, "../../../website/dashboard/client/icons") });

const CATS = {
  ai: {
    label: "AI",
    icon: "oracle",
    blurb: "Gemini AI chat with per-user memory, image vision, and auto-chat channels.",
    usage: "/gemini chat (text or image) anywhere. Staff: /gemini channel add #ai for auto-reply, no slash needed. /gemini forget erases memory."
  },
  rpg: {
    label: "RPG",
    icon: "duel",
    blurb: "Fantasy RPG: hunt monsters, fish, mine, duel players, open loot crates, hatch pets, climb the leaderboard.",
    usage: "Link with /register, then /rpg menu (buttons, no typing). Start: menu, profile, daily, weekly. Earn: work, beg, fish, mine. Battle: hunt, quest, duel, rob. Fun: gamble, slots, oracle, fate. Items: shop, buy, open, heal, gift. Ranks: inventory, leaderboard."
  },
  confess: {
    label: "Confess",
    icon: "mask",
    blurb: "Anonymous confessions with numbered thread replies, polls, reports, and staff moderation queue.",
    usage: "Staff: /confess setup once, /confess queue to moderate. Everyone: /confess send (media ok), Reply button or /confess reply (number or message link, to: quotes, color), /confess report (3 trusted reports hide), edit/delete own posts, settings for initials, stats for totals."
  },
  music: {
    label: "Music",
    icon: "music",
    blurb: "YouTube Music playback with queue, autoplay, lyrics, and dashboard controls.",
    usage: "Join a voice channel, then /play <song>. Pick from the list, control via buttons."
  },
  images: {
    label: "Images",
    icon: "image",
    blurb: "Image effects, memes, and processing.",
    usage: "Attach an image or paste a URL, pick an effect."
  },
  sticker: {
    label: "Sticker",
    icon: "sticker",
    blurb: "Turn images into stickers.",
    usage: "Attach an image with the sticker command."
  },
  tools: {
    label: "Tools",
    icon: "shield",
    blurb: "Account, moderation, auto-mod, server config, AI chat, utilities.",
    usage: "Staff tools need Manage Server. Start with /config to set up modules."
  }
};

function groupCommands() {
  const cmds = Object.values(global.discordCommands || {});
  const seen = new Set;
  const map = new Map;
  for (const c of cmds) {
    if (seen.has(c)) continue;
    seen.add(c);
    const cat = (c.category || c.tags?.[0] || "tools").toLowerCase();
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat).push(c);
  }
  for (const [k, v] of map) v.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  return map;
}

function meta(cat) {
  return CATS[cat] || { label: cat, icon: "profile", blurb: "Miscellaneous commands.", usage: "Pick a command below." };
}

function mainEmbed() {
  const map = groupCommands();
  const cats = [...map.keys()].sort();
  const e = ui.embed().setColor("#5865F2").setTitle("Akano Help").setDescription(
    "One guide for everything. Pick a category to see what it does and how to use it.\n\n" +
    cats.map(c => "**" + meta(c).label + "** — " + meta(c).blurb.split(".")[0] + ". (" + map.get(c).length + ")").join("\n")
  ).setFooter({ text: cats.length + " categories" });
  return { embed: e, art: null };
}

function catEmbed(client, cat) {
  const map = groupCommands();
  const list = map.get(cat) || [];
  const m = meta(cat);
  const lines = [];
  let subTotal = 0;
  for (const c of list) {
    const name = Array.isArray(c.name) ? c.name[0] : c.name;
    const subs = Array.isArray(c.options) ? c.options.filter(o => o.type === 1) : [];
    if (subs.length) {
      subTotal += subs.length;
      lines.push("**/" + name + "** — " + (c.description || c.help || "No description").slice(0, 60));
      for (const s of subs.slice(0, 24)) lines.push("◦ /" + name + " " + s.name + " — " + String(s.description || "").slice(0, 60));
    } else {
      const desc = (c.description || c.help || "No description").slice(0, 80);
      const opts = Array.isArray(c.options) && c.options.length ? " `" + c.options.map(o => o.required ? "<" + o.name + ">" : "[" + o.name + "]").join(" ") + "`" : "";
      lines.push("**/" + name + "**" + opts + " — " + desc);
    }
  }
  if (!lines.length) lines.push("No commands.");
  const body = lines.join("\n").slice(0, 3500);
  const e = ui.embed().setColor("#5865F2").setTitle(m.label).setDescription(m.blurb + "\n\n**How to use:** " + m.usage + "\n\n" + body).setFooter({ text: list.length + " command(s), " + subTotal + " subcommand(s)" });
  const files = ui.art(m.icon, e);
  return { embed: e, files: files };
}

function findCommand(q) {
  const key = String(q || "").trim().toLowerCase().replace(/^\//, "");
  if (!key) return null;
  const cmds = global.discordCommands || {};
  if (cmds[key]) return cmds[key];
  for (const c of Object.values(cmds)) {
    const names = Array.isArray(c.command) && c.command.length ? c.command.map(String) : [String(c.name)];
    if (names.map(n => n.toLowerCase()).includes(key)) return c;
  }
  return null;
}

function usageOf(c) {
  const name = Array.isArray(c.name) ? c.name[0] : c.name;
  const opts = Array.isArray(c.options) ? c.options : [];
  const subs = opts.filter(o => o.type === 1);
  if (subs.length) return "/" + name + " <" + subs.map(s => s.name).join("|") + ">";
  const args = opts.filter(o => o.type !== 1).map(o => (o.required ? "<" : "[") + o.name + (o.required ? ">" : "]")).join(" ");
  return ("/" + name + (args ? " " + args : "")).trim();
}

function detailEmbed(c) {
  const name = Array.isArray(c.name) ? c.name[0] : c.name;
  const names = Array.isArray(c.command) && c.command.length ? c.command.map(String) : [String(name)];
  const aliases = names.filter(n => n !== name);
  const lines = [ "**Usage:** `" + usageOf(c) + "`" ];
  if (aliases.length) lines.push("**Aliases:** " + aliases.map(a => "`/" + a + "`").join(" "));
  const ex = Array.isArray(c.examples) && c.examples.length ? c.examples : null;
  if (ex) lines.push("", "**Examples:**", ...ex.map(e => "`" + e + "`"));
  const cat = (c.category || c.tags?.[0] || "tools").toLowerCase();
  if (meta(cat) && CATS[cat]) lines.push("", "**Category:** " + meta(cat).label);
  const e = ui.embed().setColor("#5865F2").setTitle("/" + name).setDescription((c.description || c.help || "No description.") + "\n\n" + lines.join("\n")).setFooter({ text: "Tip: type / and pick the command — no need to memorize" });
  return e;
}

async function execute(interaction) {
  const q = interaction.options?.getString ? interaction.options.getString("command") : null;
  if (q) {
    const c = findCommand(q);
    if (!c) {
      await interaction.reply({ content: "No command named `" + String(q).slice(0, 50) + "`. Try /help to browse categories.", flags: 64 }).catch(() => {});
      return;
    }
    await interaction.reply({ embeds: [detailEmbed(c)], flags: 64 }).catch(() => {});
    return;
  }
  const { embed } = mainEmbed();
  const map = groupCommands();
  const cats = [...map.keys()].sort().slice(0, 25);
  const menu = new interaction.client.mbuilder().setCustomId("help_cat").setPlaceholder("Choose a category").addOptions(cats.map(c => ({
    label: meta(c).label,
    value: c,
    description: (meta(c).blurb.split(".")[0] + ".").slice(0, 90)
  })));
  const msg = await interaction.reply({
    embeds: [embed],
    components: [ui.row([menu])],
    flags: 64
  }).catch(() => null);
  if (!msg) return;
  const fetched = await interaction.fetchReply().catch(() => msg);
  const col = await ui.collect(fetched, i => i.user.id === interaction.user.id, 12e4, m => {
    try { m.edit({ components: [] }).catch(() => {}); } catch (e) {}
  });
  if (!col) return;
  const back = () => ui.row([ui.btn("help_back", "Back", interaction.client.ButtonStyle.Secondary)]);
  col.on("collect", async i => {
    if (i.customId === "help_cat") {
      const cat = i.values?.[0];
      if (!cat) return i.deferUpdate().catch(() => {});
      const r = catEmbed(i.client, cat);
      const menu2 = new i.client.mbuilder().setCustomId("help_cat").setPlaceholder("Choose a category").addOptions(cats.map(c => ({
        label: meta(c).label,
        value: c,
        description: (meta(c).blurb.split(".")[0] + ".").slice(0, 90)
      })));
      await i.update({ embeds: [r.embed], files: r.files, components: [ui.row([menu2]), back()] }).catch(() => {});
    } else if (i.customId === "help_back") {
      const r = mainEmbed();
      const menu2 = new i.client.mbuilder().setCustomId("help_cat").setPlaceholder("Choose a category").addOptions(cats.map(c => ({
        label: meta(c).label,
        value: c,
        description: (meta(c).blurb.split(".")[0] + ".").slice(0, 90)
      })));
      await i.update({ embeds: [r.embed], components: [ui.row([menu2])] }).catch(() => {});
    }
  });
}

export default define({
  name: ["help"],
  category: "tools",
  description: "The one guide: categories with explanations and usage",
  options: [ {
    name: "command",
    type: 3,
    description: "Command name for usage + examples (e.g. play)",
    required: false
  } ],
  run: async ctx => execute(ctx.interaction)
});
