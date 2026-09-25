import { whatsapp } from "@kutashiakanocanzy/sdk";
import { defineBot as define } from "@kutashiakanocanzy/sdk";

const { tallyPoll } = whatsapp;

let handler = async (m, { sock: sock }) => {
  if (!global.pollTrack || global.pollTrack.size === 0) {
    return m.reply("No tracked polls yet. Create one with poll first.");
  }
  let entry = null;
  let entryId = "";
  try {
    const qid = m.quoted && ((m.quoted.key && m.quoted.key.id) || m.quoted.id);
    if (qid) {
      const k = String(m.chat) + "|" + String(qid);
      if (global.pollTrack.has(k)) {
        entry = global.pollTrack.get(k);
        entryId = qid;
      }
    }
  } catch (e) {}
  if (!entry) {
    let best = 0;
    for (const [k, v] of global.pollTrack) {
      if (k.startsWith(String(m.chat) + "|") && (v.at || 0) >= best) {
        best = v.at || 0;
        entry = v;
        entryId = k.split("|")[1];
      }
    }
  }
  if (!entry) {
    return m.reply("No tracked polls in this chat. Create one with poll first.");
  }
  let rows = [];
  try {
    rows = tallyPoll({ pollCreationMessage: { options: entry.options.map(t => ({ optionName: t })) } }, entry.updates || []) || [];
  } catch (e) {
    return m.reply("Could not tally votes yet. Try again soon.");
  }
  const total = rows.reduce((n, r) => n + (r.voters ? r.voters.length : 0), 0);
  const lines = rows.map(r => {
    const c = r.voters ? r.voters.length : 0;
    const pct = total ? Math.round(c / total * 100) : 0;
    const bar = "#".repeat(Math.round(pct / 10)) + "-".repeat(10 - Math.round(pct / 10));
    return `◦ ${r.name} : ${c} vote (${pct}%)\n  [${bar}]`;
  });
  return m.reply(`*Poll Results*\n${entry.question}\n\n${lines.join("\n")}\n\nTotal: ${total} vote(s)`);
};

export default define({
  name: /^(pollresults|cekpoll|hasilpoll)$/i,
  category: "tools",
  help: "pollresults (reply to a poll)",
  run: function(c) {
    return handler.apply(c.that, [ c.m, c.props ]);
  }
});
