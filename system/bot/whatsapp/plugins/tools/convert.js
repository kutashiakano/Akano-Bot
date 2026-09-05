const {ffmpeg: ffmpeg, toPTT: toPTT, toAudio: toAudio} = require("../../lib/converter.js");

let handler = async (m, {sock: sock, command: command, usedPrefix: usedPrefix}) => {
  if (command === "toimg") {
    if (!m.quoted) return m.reply(`Reply sticker with command *${usedPrefix + command}*`);
    let mime = m.quoted.mimetype || "";
    if (!/sticker/.test(mime)) return m.reply(`Reply sticker with command *${usedPrefix + command}*`);
    let media = await m.quoted.download();
    let out = await ffmpeg(media, [], "webp", "png").catch(() => null);
    if (!out) return m.reply("🚩 Failed to convert sticker to image");
    await sock.sendFile(m.chat, out.data, "out.png", null, m);
  }
  if (command === "tovideo") {
    if (!m.quoted) return m.reply(`Reply sticker/audio with command *${usedPrefix + command}*`);
    let mime = m.quoted.mimetype || "";
    if (!/webp|audio/.test(mime)) return m.reply(`Reply sticker/audio with command *${usedPrefix + command}*`);
    let media = await m.quoted.download();
    let out = null;
    if (/webp/.test(mime)) {
      out = await ffmpeg(media, [ "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "28" ], "webp", "mp4").catch(() => null);
    } else {
      out = await ffmpeg(media, [ "-filter_complex", "color", "-pix_fmt", "yuv420p", "-crf", "51", "-c:a", "copy", "-shortest" ], "mp3", "mp4").catch(() => null);
    }
    if (!out) return m.reply("🚩 Failed to convert to video");
    await sock.sendFile(m.chat, out.data, "out.mp4", null, m);
  }
  if (/^to(vn|ptt|voicenote)$/i.test(command)) {
    let q = m.quoted || m;
    let mime = (m.quoted || m.msg).mimetype || "";
    if (!/video|audio/.test(mime)) return m.reply(`Reply video/audio to convert to voice note with *${usedPrefix + command}*`);
    let media = await q.download();
    if (!media) return m.reply("Can't download media");
    let audio = await toPTT(media, "mp4").catch(() => null);
    if (!audio) return m.reply("Can't convert media to audio");
    await sock.sendFile(m.chat, audio.data, "audio.ogg", "", m, true, {
      mimetype: "audio/ogg; codecs=opus"
    });
  }
  if (/^to(mp3|a(udio)?)$/i.test(command)) {
    let q = m.quoted || m;
    let mime = (m.quoted || m.msg).mimetype || "";
    if (!/video|audio/.test(mime)) return m.reply(`Reply video/voice note to convert to mp3 with *${usedPrefix + command}*`);
    let media = await q.download();
    if (!media) return m.reply("Can't download media");
    let audio = await toAudio(media, "mp4").catch(() => null);
    if (!audio) return m.reply("Can't convert media to audio");
    await sock.sendFile(m.chat, audio.data, "audio.opus", "", m, null, {
      mimetype: "audio/ogg; codecs=opus"
    });
  }
};

const {define: define} = require("../../../plugin");

module.exports = define({
  name: /^(toimg|tovideo|to(vn|ptt|voicenote)|to(mp3|a(udio)?))$/,
  category: "tools",
  help: [ "toimg", "tovideo", "tovn", "tovoicenote", "tomp3" ][0] || "",
  reg: true,
  run: function(c) {
    return handler.apply(c.that, [ c.m, c.props ]);
  }
});