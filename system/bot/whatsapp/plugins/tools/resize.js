const { Jimp } = require("jimp");

let handler = async (m, { sock, args, usedPrefix, command }) => {
  let toWidth = parseInt(args[0]);
  let toHeight = parseInt(args[1]);
  if (!toWidth || !toHeight) return m.reply(`*Example:* ${usedPrefix + command} <width> <height>`);

  let q = m.quoted || m;
  let mime = (m.quoted || m.msg).mimetype || "";
  if (!mime) return m.reply("Please reply/caption the image you want to resize");
  if (!/image\/(png|jpe?g)/.test(mime)) return m.reply(`Mime ${mime} not supported`);

  let media = await q.download();
  let image = await Jimp.fromBuffer(media);
  const before = { height: image.bitmap.height, width: image.bitmap.width };
  image.resize({ w: toWidth, h: toHeight });
  const out = await image.getBuffer("image/png");

  await sock.sendFile(m.chat, out, "out.png", `*Resize Image*\n- *Width :* ${before.width} > ${toWidth}\n- *Height:* ${before.height} > ${toHeight}`, m);
};
handler.help = ["resize"];
handler.tags = ["tools"];
handler.command = ["resize"];
module.exports = handler;
