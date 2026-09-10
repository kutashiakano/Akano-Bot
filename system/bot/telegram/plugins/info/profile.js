const database = require("../../../../database");
const { define: define } = require("../../../sdk");

module.exports = define({
  name: [ "profile", "me" ],
  category: "info",
  help: "Show user profile card",
  run: async c => {
    const ctx = c.ctx;
    const msg = ctx.message || ctx.msg || {};
    const replyFrom = msg.reply_to_message?.from;
    const from = (c.command === "me" ? ctx.from : replyFrom || ctx.from) || {};
    const uid = String(from.id || "");
    let extra = {};
    try {
      extra = database.get().telegram?.users?.[uid] || {};
    } catch {}
    const name = [ from.first_name, from.last_name ].filter(Boolean).join(" ") || from.username || "Unknown";
    const card = c.Utils.userCard("tg", {
      name: name,
      id: uid || "-",
      username: from.username ? "@" + from.username : "-",
      exp: typeof extra.exp === "number" ? c.Utils.formatNumber(extra.exp) : undefined,
      limit: typeof extra.limit === "number" ? c.Utils.formatNumber(extra.limit) : undefined,
      registered: !!extra.registered,
      premium: !!extra.premium,
      expired: extra.premium ? "∞" : "-",
      footer: global.botname || ""
    });
    await ctx.reply(card, { parse_mode: "HTML" }).catch(() => {});
  }
});
