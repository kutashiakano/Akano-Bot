const util = require("util");
const { exec } = require("child_process");

let handler = async (m, { sock }) => {
  let text = m.text.trim();
  let type = text[0];
  if (!["x", ">", "$"].includes(type)) return;

  let command = text.slice(2).trim();
  let { key } = await sock.sendMessage(
    m.chat,
    { text: "Processing..." },
    { quoted: m },
  );

  try {
    if (type === "x") {
      const result = await eval(`(async () => { return ${command} })()`);
      await sock.sendMessage(m.chat, { text: util.format(result), edit: key });
    } else if (type === ">") {
      const result = await eval(`(async() => { ${command} })()`);
      await sock.sendMessage(m.chat, { text: util.inspect(result), edit: key });
    } else if (type === "$") {
      exec(command, async (err, stdout) => {
        let output = err ? util.format(err) : stdout;
        await sock.sendMessage(m.chat, { text: output, edit: key });
      });
    }
  } catch (e) {
    await sock.sendMessage(m.chat, { text: util.format(e), edit: key });
  }
};

handler.help = [">", "x", "$"];
handler.tags = ["advanced"];
handler.customPrefix = /^[x>\$] /;
handler.command = new RegExp();
handler.rowner = true;

module.exports = handler;
