const database = require("../../../database");


const { define } = require("../../plugin");

module.exports = define({
  name: ["groupstats", "memberstats", "activity"],
  category: "statistics",
  help: "Group stats: member list, activity overview, growth stats",
  group: true,
  run: async (ctx) => {

    if (ctx.chat.type !== "group" && ctx.chat.type !== "supergroup") {
      return ctx.reply("🚩 Error: This command can only be used in groups.");
    }

    const db = database.get();
    const groupId = ctx.chat.id;
    const group = db.telegram.groups?.[groupId];
    if (!group) {
      return ctx.reply("🚩 Error: No statistics available for this group yet.");
    }

    const command = ctx.message.text.split(" ")[0].substring(1).toLowerCase();
    const now = new Date();

    if (command === "groupstats") {
      const totalMembers = Object.keys(group.members || {}).length;
      const createdAt = group.createdAt ? new Date(group.createdAt).toLocaleString() : "N/A";
      const welcome = group.welcomeMessage ? "On" : "Off";
      const goodbye = group.goodbyeMessage ? "On" : "Off";
      const text =
        `<b>Group Statistics</b>\n\n` +
        `Total members: <b>${totalMembers}</b>\n` +
        `Created at: <b>${createdAt}</b>\n` +
        `Welcome: <b>${welcome}</b> | Goodbye: <b>${goodbye}</b>\n` +
        `Antiflood: <b>${group.antiflood ? "On" : "Off"}</b> | Antispam: <b>${group.antispam ? "On" : "Off"}</b>`;
      return ctx.reply(text, { parse_mode: "HTML" });
    }

    if (command === "memberstats") {
      const members = group.members || {};
      const sorted = Object.values(members).sort((a, b) => a.id - b.id);
      const lines = sorted
        .slice(0, 20)
        .map((m) => `• ${m.first_name || "User"} (${m.id})${m.username ? ` @${m.username}` : ""}`);
      const text = `<b>Member List (first 20)</b>\n\n${lines.join("\n")}`;
      return ctx.reply(text, { parse_mode: "HTML" });
    }

    if (command === "activity") {
      const created = group.createdAt ? new Date(group.createdAt) : now;
      const days = Math.floor((now - created) / (1000 * 60 * 60 * 24)) || 1;
      const memberCount = Object.keys(group.members || {}).length;
      const avgGrowth = (memberCount / days).toFixed(2);
      const text =
        `<b>Activity Overview</b>\n\n` +
        `Days since creation: <b>${days}</b>\n` +
        `Current members: <b>${memberCount}</b>\n` +
        `Average new members per day: <b>${avgGrowth}</b>`;
      return ctx.reply(text, { parse_mode: "HTML" });
    }
  
  },
});
