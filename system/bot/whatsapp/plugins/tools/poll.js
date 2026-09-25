import { defineBot as define } from "@kutashiakanocanzy/sdk";
let handler = async (m, { sock: sock, text: text, usedPrefix: usedPrefix }) => {
  const parts = String(text || "").split("|").map(s => s.trim()).filter(Boolean);
  if (parts.length < 3) {
    return m.reply(`*Poll*\n\nUsage: ${usedPrefix}poll question | option1 | option2 [| option3] [| option4]\nExample: ${usedPrefix}poll lunch? | rice | noodles`);
  }
  const question = parts[0].slice(0, 300);
  const options = parts.slice(1, 6).map(s => s.slice(0, 100));
  try {
    const sent = await sock.sendMessage(m.chat, {
      poll: {
        name: question,
        values: options,
        selectableCount: 1
      }
    }, {
      quoted: m
    });
    try {
      if (!global.pollTrack) global.pollTrack = new Map;
      const id = sent && sent.key && sent.key.id;
      if (id) global.pollTrack.set(String(m.chat) + "|" + String(id), { question: question, options: options, updates: [], at: Date.now() });
    } catch (e) {}
  } catch (e) {
    await m.reply("Could not create poll. Try again soon.");
  }
};

export default define({
  name: /^(poll)$/i,
  category: "tools",
  help: "poll question | option1 | option2",
  run: function(c) {
    return handler.apply(c.that, [ c.m, c.props ]);
  }
});
