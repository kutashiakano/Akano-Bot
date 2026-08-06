let handler = async (m) => {
  m.reply("Pong!");
};
handler.help = ["ping"];
handler.tags = ["general"];
handler.command = /^(ping)$/i;
module.exports = handler;
