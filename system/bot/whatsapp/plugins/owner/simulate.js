let handler = async (m, { sock, args, usedPrefix, command, isOwner: _isOwner }) => {
  const isOwner = _isOwner || global.owner.includes(m.sender.split("@")[0]) || m.fromMe;
  if (!isOwner) return m.reply(global.settings.message.owner);

  const event = (args[0] || "").toLowerCase();
  const mention = args.slice(1).join(" ");

  if (!event) {
    return m.reply([
      `*SIMULATE* — Test welcome/leave/promote/demote`,
      "",
      `*Usage:*`,
      `${usedPrefix}simulate welcome @user`,
      `${usedPrefix}simulate bye @user`,
      `${usedPrefix}simulate promote @user`,
      `${usedPrefix}simulate demote @user`,
      "",
      `*Events:*`,
      `welcome/add/invite — simulate user join`,
      `bye/kick/leave/remove — simulate user leave`,
      `promote — simulate user promoted`,
      `demote — simulate user demoted`,
    ].join("\n"));
  }

  let who = mention ? sock.parseMention(mention) : [];
  let part = who.length ? who : [m.sender];

  let act = false;
  switch (event) {
    case "add":
    case "invite":
    case "welcome":
      act = "add";
      break;
    case "bye":
    case "kick":
    case "leave":
    case "remove":
      act = "remove";
      break;
    case "promote":
      act = "promote";
      break;
    case "demote":
      act = "demote";
      break;
    default:
      return m.reply(`Unknown event: *${event}*\nAvailable: welcome, bye, promote, demote`);
  }

  await m.reply(`*Simulating ${event}...*`);

  await sock.onParticipantsUpdate({
    id: m.chat,
    participants: part,
    action: act,
  });
};
handler.help = ["simulate"];
handler.tags = ["owner"];
handler.command = ["simulate"];
handler.owner = true;
module.exports = handler;
