const axios = require("axios");
const { format } = require("util");

let handler = async (m, { sock, text, command, usedPrefix }) => {
  if (!text || !/^https?:\/\//.test(text))
    return m.reply(`Prefix *URL* with http:// or https://\nUsage: ${usedPrefix + command} <url>`);

  let url = new URL(text).toString();

  try {
    let response = await axios({
      method: "GET",
      url,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://www.google.com/",
      },
      timeout: 30000,
      maxRedirects: 5,
      responseType: "arraybuffer",
    });

    let contentType = response.headers["content-type"] || "";
    if (!/text|json/.test(contentType)) {
      return sock.sendFile(m.chat, url, "file", text, m);
    }

    let txt = response.data.toString("utf-8");
    try {
      txt = format(JSON.parse(txt));
    } catch (e) {}

    m.reply(txt.slice(0, 65536) || "Empty response");
  } catch (e) {
    m.reply("🚩 " + (e.message || "Failed to fetch URL"));
  }
};
const { define } = require("../../../plugin");

module.exports = define({
  name: ["fetch", "get"],
  category: (["tools"])[0] || "tools",
  help: (["fetch"])[0] || "",
  reg: true,
  run: function (c) { return handler.apply(c.that, [c.m, c.props]); },
});
