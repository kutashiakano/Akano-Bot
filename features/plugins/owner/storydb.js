module.exports = {
  help: ["listsw", "getsw"],
  command: ["listsw", "getsw", "getstory"],
  tags: ["owner"],
  rowner: true,
  run: async (m, { sock, text, command }) => {
    const typeLabels = {
      imageMessage: "Image", 
      videoMessage: "Video",
      audioMessage: "Audio", 
      text: "Text"
    };

    switch(command) {
      case "listsw":
        const stories = (await sock.story().catch(() => []))
          .sort((a, b) => a.name.localeCompare(b.name) || (a.type || 'zzz').localeCompare(b.type || 'zzz'));
        
        if (!stories.length) return m.reply("No stories found");
        
        const grouped = stories.reduce((acc, cur) => {
          const key = cur.jid;
          if (!acc[key]) acc[key] = [];
          acc[key].push(cur);
          return acc;
        }, {});
        
        let count = 1;
        const list = Object.entries(grouped).map(([jid, items]) => {
          const types = items.map(v => `${count++}. ${typeLabels[v.type] || typeLabels.text}`).join('\n');
          return `📍@${jid.split('@')[0]}\n${types}`;
        }).join('\n\n');
        
        const mentions = Object.keys(grouped).concat(m.sender);
        sock.sendMessage(m.chat, {
          text: `\`\`\`[ STORY LIST ]\`\`\`\n\n${list}\n\nReply .getsw <number>`,
          mentions,
        }, { quoted: m });
        break;

      case "getsw":
      case "getstory":
        if (!text) return m.reply("Usage: .getsw <number>", m);
        const index = parseInt(text) - 1;
        const data = await sock.story().catch(() => []);
        
        if (isNaN(index) || index < 0 || index >= data.length) 
          return m.reply(`Invalid number (1-${data.length})`, m);
        
        const story = data[index];
        const buffer = story.base64 ? Buffer.from(story.base64, 'base64') : null;
        const msgType = story.type?.replace('Message', '') || 'text';
        
        const payload = buffer ? { 
          [msgType]: buffer, 
          caption: story.caption || '',
          mentions: [story.jid]
        } : { text: story.text || '' };
        
        sock.sendMessage(m.chat, payload, { quoted: m });
        break;
    }
  },
};