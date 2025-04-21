module.exports = {
  help: ["aoyoai"],
  command: ["aoyoai"],
  tags: ["ai"],
  run: async (m, { sock, text }) => {
    let resAoyo = await scraper.aoyoai(text);
    await sock.sendMessageModify(
      m.chat,
      resAoyo.jawaban,
      m, {
        thumbnail: await Buffer.from(
          (await sock.getFile("https://telegra.ph/file/11713f14259552836b315.png")).data
        ),
        body: `Aoyo Ai • ${new Date().toLocaleString("en-GB", { timeZone: "UTC" })}`,
        title: "AI Response",
        largeThumb: false,
        ads: false
      }
    );
  },
  example: "%cmd what is furrylover?",
};