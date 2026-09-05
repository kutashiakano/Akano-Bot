function parseBlocks(text) {
  const blocks = [];
  const pushText = t => {
    t = t.replace(/\n{3,}/g, "\n\n").trim();
    if (!t) return;
    const lines = t.split("\n");
    let cur = [];
    let i = 0;
    const flush = () => {
      if (cur.length) {
        blocks.push({
          type: "text",
          text: cur.join("\n")
        });
        cur = [];
      }
    };
    while (i < lines.length) {
      const line = lines[i].trim();
      if (line.startsWith("|") && line.endsWith("|")) {
        const rows = [];
        while (i < lines.length) {
          const l = lines[i].trim();
          if (!l.startsWith("|") || !l.endsWith("|")) break;
          const cells = l.slice(1, -1).split("|").map(c => c.trim());
          if (cells.every(c => /^:?-+:?$/.test(c))) {
            i++;
            continue;
          }
          rows.push(cells);
          i++;
        }
        flush();
        if (rows.length) blocks.push({
          type: "table",
          rows: rows
        });
      } else {
        cur.push(lines[i]);
        i++;
      }
    }
    flush();
  };
  const fenceRe = /```(\w*)\r?\n([\s\S]*?)```/g;
  let last = 0;
  let m;
  while ((m = fenceRe.exec(text)) !== null) {
    if (m.index > last) pushText(text.slice(last, m.index));
    blocks.push({
      type: "code",
      lang: m[1] || "text",
      code: m[2]
    });
    last = m.index + m[0].length;
  }
  if (last < text.length) pushText(text.slice(last));
  return blocks;
}

const __orig = {
  reg: true,
  help: [ "gemini", "new_session", "del_session", "gmodel" ],
  command: [ "gemini", "new_session", "del_session", "gmodel" ],
  tags: [ "ai" ],
  run: async (m, {sock: sock, text: text, usedPrefix: usedPrefix, command: command}) => {
    const gemini = global.scraper.gemini;
    switch (command) {
     case "new_session":
     case "newsession":
      if (gemini) gemini.clearSession(m.sender);
      return m.reply("Session cleared. Starting fresh conversation.");

     case "del_session":
     case "delsession":
      if (gemini) gemini.clearSession(m.sender);
      return m.reply("Session deleted.");

     case "gmodel":
      if (!gemini) return m.reply("Gemini module not available.");
      const models = gemini.listModels();
      const modelList = models.map(mo => `• ${mo.name}: ${mo.model_name}`).join("\n");
      return m.reply(`*Available Models:*\n\n${modelList}\n\nUsage: ${usedPrefix}gemini --model BASIC_PRO your question`);

     case "gemini":
      if (!text) {
        return m.reply(`*Gemini AI Chat*\n\n` + `*Basic:* ${usedPrefix}gemini your question\n` + `*Temporary:* ${usedPrefix}gemini --temp your question\n` + `*Model:* ${usedPrefix}gemini --model BASIC_PRO your question\n` + `*Clear:* ${usedPrefix}new_session`);
      }
      try {
        if (!gemini) throw new Error("Gemini module not available.");
        let options = {};
        let prompt = text;
        if (text.includes("--temp")) {
          options.temporary = true;
          prompt = prompt.replace("--temp", "").trim();
        }
        const modelMatch = text.match(/--model\s+(\w+)/i);
        if (modelMatch) {
          const modelName = modelMatch[1].toUpperCase();
          if (gemini.MODEL[modelName]) {
            options.model = gemini.MODEL[modelName];
          }
          prompt = prompt.replace(/--model\s+\w+/i, "").trim();
        }
        if (!prompt) return m.reply("Please provide a question after the options.");
        const response = await gemini.chat(prompt, m.sender, null, options);
        if (!response || !response.text) throw new Error("Empty response from Gemini.");
        let replyText = response.text;
        if (options.temporary) replyText = `*[Temporary]*\n\n${replyText}`;
        const blocks = parseBlocks(replyText);
        const hasRich = blocks.some(b => b.type === "code" || b.type === "table") || /https?:\/\/\S+/i.test(replyText);
        if (hasRich && typeof sock.aiRich === "function") {
          const rich = sock.aiRich().setTitle(options.model ? `Gemini ${options.model.model_name}` : "Gemini AI");
          for (const b of blocks) {
            if (b.type === "code") rich.addCode(b.lang || "text", b.code); else if (b.type === "table") rich.addTable(b.rows); else if (b.text.trim()) rich.addText(b.text);
          }
          await rich.send(m.chat, {
            quoted: m
          });
        } else {
          await sock.sendMessage(m.chat, {
            text: replyText
          }, {
            quoted: m
          });
        }
        if (response.images && response.images.length > 0) {
          for (const imgUrl of response.images) {
            try {
              await sock.sendMessage(m.chat, {
                image: {
                  url: imgUrl
                },
                caption: "Generated image"
              }, {
                quoted: m
              });
            } catch (e) {}
          }
        }
      } catch (e) {
        console.error("[Gemini WA]", e.message);
        if (e.message && e.message.includes("Header overflow")) {
          gemini.clearSession(m.sender);
        }
        m._pluginHandledError = true;
        m.reply("Gemini is currently unavailable. Please try again later.");
      }
      break;
    }
  },
  example: "%cmd what is the meaning of life?"
};

const {define: define} = require("../../../plugin");

module.exports = define({
  name: [ "gemini", "new_session", "del_session", "gmodel" ],
  category: "ai",
  help: [ "gemini", "new_session", "del_session", "gmodel" ][0] || "",
  reg: true,
  example: "%cmd what is the meaning of life?",
  run: async function(c) {
    return __orig.run.call(__orig, c.m, c.props);
  }
});