let handler = async (m, { sock, args, usedPrefix, command }) => {
  const user = global.db?.data?.users?.[m.sender];

  if (command === "unreg") {
    if (!user || !user.registered) {
      return m.reply("You are not registered yet.");
    }
    user.registered = false;
    delete user.age;
    delete user.regTime;
    return m.reply("Your registration data has been cleared.");
  }

  if (user?.registered) {
    return m.reply(
      `You are already registered.\nUse ${usedPrefix}unreg to reset your registration.`,
    );
  }

  const text = args.join(" ").trim();

  const ageMatch = text.match(/^(.+)\.(\d+)$/);
  if (ageMatch) {
    const name = ageMatch[1].trim();
    const age = parseInt(ageMatch[2], 10);
    if (!name) return m.reply("🚩 Invalid format. Use: name.age (example: Budi.20)");
    if (age < 5 || age > 30) return m.reply("Age must be between 5 and 30.");
    if (!global.db?.data?.users) return;
    if (!global.db.data.users[m.sender]) global.db.data.users[m.sender] = {};
    global.db.data.users[m.sender].name = name;
    global.db.data.users[m.sender].age = age;
    global.db.data.users[m.sender].regTime = Date.now();
    global.db.data.users[m.sender].registered = true;
    return m.reply(`Registered successfully!\n\nName: ${name}\nAge: ${age} years`);
  }

  const name = (m.pushName || "User").trim();
  await sndAgeSel(sock, m.chat, { quoted: m, usedPrefix, name });
};

function sndAgeSel(sock, jid, { quoted, usedPrefix, name }) {
  const row = (age) => ({
    title: `${age} Years`,
    id: `${usedPrefix}daftar ${name}.${age}`,
  });
  const randomAge = 9 + Math.floor(Math.random() * 22);
  const buttons = [
    {
      name: "single_select",
      btnJson: JSON.stringify({
        title: "Select Your Age",
        sections: [
          { title: "Random Years", rows: [row(randomAge)] },
          { title: "30 - 21", rows: Array.from({ length: 10 }, (_, i) => 30 - i).map(row) },
          { title: "20 - 11", rows: Array.from({ length: 10 }, (_, i) => 20 - i).map(row) },
          { title: "10 - 9", rows: [10, 9].map(row) },
        ],
      }),
    },
  ];
  return sock.sendIAMessage(jid, buttons, quoted || null, {
    header: "REGISTER",
    content: "Select Your Age",
    footer: global.settings.footer,
  });
}

handler.help = ["register", "daftar", "reg", "unreg"];
handler.tags = ["settings"];
handler.command = ["register", "daftar", "reg", "unreg"];

handler.sndAgeSel = sndAgeSel;
module.exports = handler;
