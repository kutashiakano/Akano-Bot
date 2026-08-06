const axios = require("axios");
const { fileTypeFromBuffer } = require("file-type");

let handler = async (m, { sock }) => {
  let q = m.quoted || m;
  let mime = (m.quoted || m.msg).mimetype || "";
  if (!mime) return m.reply("Reply or caption an image/video/document");

  let buffer = await q.download();
  if (!buffer) return m.reply("Can't download media");

  const { ext, mime: fileMime } = (await fileTypeFromBuffer(buffer)) || {};
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: fileMime || mime }), `tmp.${ext || "bin"}`);

  try {
    const { data } = await axios.post("https://tmpfiles.org/api/v1/upload", form, {
      timeout: 60000,
    });
    const match = /https?:\/\/tmpfiles\.org\/(.*)/.exec(data.data.url);
    const url = `https://tmpfiles.org/dl/${match[1]}`;

    const size = formatSize(buffer.length);
    let text = `*Upload Success*\n\n*Size:* ${size}\n*Type:* ${fileMime || mime}\n\n*URL:* ${url}`;
    m.reply(text);
  } catch (e) {
    m.reply(`Upload failed: ${e.message}`);
  }
};
handler.help = ["tourl", "upload"];
handler.tags = ["tools"];
handler.command = ["tourl", "upload"];
module.exports = handler;

function formatSize(size) {
  if (size >= 1024 * 1024 * 1024) return (size / (1024 * 1024 * 1024)).toFixed(2) + " GB";
  if (size >= 1024 * 1024) return (size / (1024 * 1024)).toFixed(2) + " MB";
  if (size >= 1024) return (size / 1024).toFixed(2) + " KB";
  return size + " B";
}
