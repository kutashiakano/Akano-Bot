module.exports = {
  help: ["calculator", "calc"],
  command: ["calc", "calculator"],
  tags: ["tools"],
  run: async (m, { sock, text }) => {
    let id = m.chat;
    sock.math = sock.math ? sock.math : {};
    if (id in sock.math) {
      clearTimeout(sock.math[id][3]);
      delete sock.math[id];
      m.reply(`Game over, you're caught cheating..`);
    }
    let val = text
      .replace(/[^0-9\-\/+*×÷πEe()piPI/]/g, "")
      .replace(/×/g, "*")
      .replace(/÷/g, "/")
      .replace(/π|pi/gi, "Math.PI")
      .replace(/e/gi, "Math.E")
      .replace(/\/+/g, "/")
      .replace(/\++/g, "+")
      .replace(/-+/g, "-");
    let format = val
      .replace(/Math\.PI/g, "π")
      .replace(/Math\.E/g, "e")
      .replace(/\//g, "÷")
      .replace(/\*×/g, "×");
    try {
      console.log(val);
      let result = new Function("return " + val)();
      if (!result) throw result;
      m.reply(`*${format}* = _${result}_`);
    } catch (e) {
      return m.reply(
        "Incorrect format, only 0-9 and Symbols -, +, *, /, ×, ÷, π, e, (, ) are supported.",
      );
    }
  },
  example: "%cmd 1+8",
};
