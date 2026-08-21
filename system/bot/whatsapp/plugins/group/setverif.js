let handler = async (m, { args, usedPrefix, isOwner: _isOwner, isAdmin: _isAdmin }) => {
  if (!m.isGroup) return m.reply(global.settings.message.group);

  const isOwner = _isOwner || global.owner.includes(m.sender.split("@")[0]) || m.fromMe;
  const isAdmin = _isAdmin;
  if (!isAdmin && !isOwner) return m.reply(global.settings.message.admin);

  if (!global.db.data.chats[m.chat]) {
    global.db.data.chats[m.chat] = {
      welcome: true,
      left: true,
      detect: false,
      mute: false,
      member: [],
      chat: 0,
      expired: 0,
    };
  }
  const chat = global.db.data.chats[m.chat];

  const input = args.join(" ").trim();

  if (!input) {
    const mode =
      chat.verifQuestion && chat.verifAnswer
        ? `Question: ${chat.verifQuestion}\nAnswer: ${chat.verifAnswer}`
        : "Current mode: random CAPTCHA";
    return m.reply(
      `Verification:\n${mode}\n\nSet a question: ${usedPrefix}setverif <question> | <answer>\nReset to CAPTCHA: ${usedPrefix}setverif reset`,
    );
  }

  if (input.toLowerCase() === "reset") {
    delete chat.verifQuestion;
    delete chat.verifAnswer;
    return m.reply("Verification reset to random CAPTCHA.");
  }

  const [question, answer] = input.split("|").map((s) => s.trim());
  if (!question || !answer) {
    return m.reply(
      `Invalid format.\nUsage: ${usedPrefix}setverif <question> | <answer>\nExample: ${usedPrefix}setverif What is this bot name? | akano`,
    );
  }

  chat.verifQuestion = question;
  chat.verifAnswer = answer;
  return m.reply(`Verification question saved.\n\nQuestion: ${question}\nAnswer: ${answer}`);
};
const { define } = require("../../../plugin");

module.exports = define({
  name: ["setverif", "verifquestion"],
  category: (["group"])[0] || "tools",
  help: (["setverif"])[0] || "",
  group: true,
  reg: true,
  run: function (c) { return handler.apply(c.that, [c.m, c.props]); },
});
