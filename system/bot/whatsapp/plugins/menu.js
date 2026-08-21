const moment = require("moment-timezone");

let cachedCover = null;

async function resolveCover() {
  if (cachedCover) return cachedCover;
  const url = global.settings?.cover || global.settings?.icon;
  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    cachedCover = Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
  return cachedCover;
}

function collectCommands(usedPrefix) {
  const map = new Map();
  for (const pl of Object.values(global.plugin || {})) {
    if (!pl || !pl.help || pl.disabled || (pl.before && !pl.run)) continue;
    const cats = Array.isArray(pl.category)
      ? pl.category.flat().filter(Boolean)
      : pl.tags
        ? Array.isArray(pl.tags)
          ? pl.tags
          : [pl.tags]
        : [];
    if (!cats.length) continue;
    if (cats.some((c) => String(c).toLowerCase() === "hidden")) continue;
    const helps = Array.isArray(pl.help) ? pl.help.filter(Boolean) : [pl.help];
    for (const cmd of helps) {
      const entry = pl.customPrefix ? cmd.replace(/^\./, "") : usedPrefix + cmd;
      for (const c of cats) {
        const key = String(c).toUpperCase();
        if (!map.has(key)) map.set(key, new Set());
        map.get(key).add(entry);
      }
    }
  }
  return map;
}

const tagMap = {
  AI: "AI",
  DOWNLOADER: "Downloader",
  GROUP: "Group",
  OWNER: "Owner",
  SUBBOT: "Sub-Bot",
  TOOLS: "Tools",
  SETTINGS: "Settings",
  GENERAL: "General",
  MAIN: "Main",
  INFO: "Info",
};

function ucapan() {
  const time = moment.tz("Asia/Jakarta").format("HH");
  let res = "Selamat dinihari";
  if (time >= 4) res = "Selamat pagi 🌄";
  if (time > 10) res = "Selamat siang ☀️";
  if (time >= 15) res = "Selamat sore 🌇";
  if (time >= 18) res = "Selamat malam 🌙";
  return res;
}

function boxList(cmds) {
  const sorted = cmds.slice().sort((a, b) => a.localeCompare(b));
  return sorted
    .map((c, i) => {
      if (i === 0) return `┌  ◦  ${c}`;
      if (i === sorted.length - 1) return `└  ◦  ${c}`;
      return `│  ◦  ${c}`;
    })
    .join("\n");
}

const __orig = {
  help: ["menu", "help"],
  command: ["menu", "help"],
  tags: ["main"],
  run: async (m, { sock, usedPrefix, args }) => {
    const categoryMap = collectCommands(usedPrefix);
    const catKeys = Array.from(categoryMap.keys()).sort();
    const totalCommands = Array.from(categoryMap.values()).reduce((a, b) => a + b.size, 0);
    const key = String(args[0] || "").toLowerCase();

    const isOwner = (global.owner || []).some((o) => o === m.sender.split("@")[0]);
    const status = isOwner ? "Owner" : "User";
    const name = m.pushName || "Unknown";
    const prefix = usedPrefix || ".";

    if (key) {
      const keyUpper = Array.from(categoryMap.keys()).find((k) => k.toLowerCase() === key);
      if (!keyUpper) return;
      const cmds = Array.from(categoryMap.get(keyUpper)).map(
        (c) => prefix + c.replace(new RegExp("^\\" + prefix), ""),
      );
      const print = `乂  *${(tagMap[keyUpper] || keyUpper).toUpperCase()}*\n\n${boxList(cmds)}`;
      return m.reply(print);
    }

    const sections = catKeys.map((v) => ({
      rows: [
        {
          title: tagMap[v] || v,
          description: `There are ${categoryMap.get(v).size} commands`,
          id: `${prefix}menu ${v.toLowerCase()}`,
        },
      ],
    }));

    const message =
      `${ucapan()}, ${name} !\n\n` +
      `乂  *${global.botname}*\n` +
      `  ◦  Status : ${status}\n` +
      `  ◦  Users : ${Object.keys(db.data.users).length}\n` +
      `  ◦  Commands : ${totalCommands}\n` +
      `  ◦  Prefix : [ ${prefix} ]\n` +
      `  ◦  Date : ${new Date(new Date() + 3600000).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`;

    const buttons = [
      {
        name: "single_select",
        btnJson: JSON.stringify({ title: "Tap Here!", sections: sections }),
      },
    ];

    return sock.sendIAMessage(m.chat, buttons, m, {
      header: "",
      content: message,
      footer: global.botname,
      media: await resolveCover(),
    });
  },
}
const { define } = require("../../plugin");

module.exports = define({
  name: ["menu", "help"],
  category: (["main"])[0] || "tools",
  help: (["menu", "help"])[0] || "",
  run: async function (c) { return __orig.run.call(__orig, c.m, c.props); },
});
