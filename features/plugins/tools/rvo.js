const { downloadContentFromMessage } = require('baileys');

module.exports = {
	help: ["rvo"],
    command: ["rvo"],
    tags: "tools",
    owner: true,
    async run(m, { sock, usedPrefix, command }) {
        try {
            const msg = m.quoted.message;
            const type = Object.keys(msg)[0];
            const mediaTypes = {
                imageMessage: 'image',
                videoMessage: 'video',
                audioMessage: 'audio'
            };

            if (!mediaTypes[type]) {
                throw new Error('Unsupported media type.');
            }

            const media = await downloadContentFromMessage(msg[type], mediaTypes[type]);
            let buffer = Buffer.from([]);

            for await (const chunk of media) {
                buffer = Buffer.concat([buffer, chunk]);
            }

            const messageOptions = {
                caption: msg[type]?.caption || '',
                viewOnce: m.command === "torvo",
                quoted: m
            };

            switch (type) {
                case 'videoMessage':
                    await sock.sendMessage(m.chat, { video: buffer, ...messageOptions });
                    break;
                case 'imageMessage':
                    await sock.sendMessage(m.chat, { image: buffer, ...messageOptions });
                    break;
                case 'audioMessage':
                    await sock.sendMessage(m.chat, { 
                        audio: buffer, 
                        mimetype: 'audio/mpeg', 
                        ptt: true, 
                        ...messageOptions 
                    });
                    break;
            }
        } catch (e) {
            return m.reply(Func.texted('bold', "Make sure you reply to a valid one-time view media message."));
        }
    },
    example: "%cmd [ reply to a one-time view message ]"
};