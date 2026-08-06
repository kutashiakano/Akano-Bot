const axios = require("axios");

let handler = async (m, { sock, text, command, usedPrefix }) => {
  if (!text) return m.reply(`- Input url.\n${usedPrefix + command} <url> [phone/tablet]`);

  let type = "desktop";
  if (/phone/i.test(text)) type = "phone";
  if (/tablet/i.test(text)) type = "tablet";

  await sock.sendReact(m.chat, "🔎", m.key);

  try {
    let buffer = await ssweb(text.split(" ")[0], type);
    await sock.sendFile(m.chat, buffer, "ss.png", `*Screenshot*\n- *URL:* ${text.split(" ")[0]}\n- *Device:* ${type}`, m);
    await sock.sendReact(m.chat, "✅", m.key);
  } catch (e) {
    m.reply(`Screenshot failed: ${e.message}`);
  }
};
handler.help = ["ssweb"];
handler.tags = ["tools"];
handler.command = ["ssweb", "screenshot"];
module.exports = handler;

async function ssweb(url, type = "desktop") {
  const base = "https://www.screenshotmachine.com";
  const param = { url, device: type, cacheLimit: 0, full: true };
  const { data, headers } = await axios({
    url: `${base}/capture.php`,
    method: "POST",
    data: new URLSearchParams(Object.entries(param)),
    headers: { "content-type": "application/x-www-form-urlencoded; charset=UTF-8" },
    timeout: 60000,
  });

  if (data.status !== "success") throw new Error("Screenshot service failed");
  const cookies = headers["set-cookie"];
  const res = await axios.get(`${base}/${data.link}`, {
    headers: { cookie: cookies.join("; ") },
    responseType: "arraybuffer",
    timeout: 60000,
  });
  return res.data;
}
