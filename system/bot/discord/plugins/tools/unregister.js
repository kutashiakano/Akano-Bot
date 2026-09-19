const database = require("../../../../database");
const { define: define } = require("../../../sdk");

module.exports = define({
  name: ["unregister"],
  category: "tools",
  description: "Unlink your Discord account from Akano (game data is kept)",
  options: [],
  run: async ctx => {
    const interaction = ctx.interaction;
    const client = interaction.client;
    const EB = client.ebuilder;
    try {
      await interaction.deferReply();
    } catch (e) {
      return;
    }
    const userId = String(interaction.user.id);
    const avatar = interaction.user.displayAvatarURL({ size: 256 });
    let prof = null;
    try {
      prof = database.get().discord?.users?.[userId] || null;
    } catch (e) {}
    if (!prof?.registered) {
      return interaction.editReply({ embeds: [new EB().setColor("#99AAB5").setTitle("Not Linked").setThumbnail(avatar).setDescription("Your Discord account is not linked to Akano. Use /register to link it.")] }).catch(() => {});
    }
    const e = new EB().setColor("#ED4245").setTitle("Unlink Account").setThumbnail(avatar).setDescription("Unlink " + interaction.user.username + " from Akano?\n\nYou will lose access to /rpg until you link again. Money, XP, and items are kept.");
    const row = new client.abuilder().addComponents(
      new client.bbuilder().setCustomId("unreg_yes").setLabel("Unlink").setStyle(client.ButtonStyle.Danger),
      new client.bbuilder().setCustomId("unreg_no").setLabel("Cancel").setStyle(client.ButtonStyle.Secondary)
    );
    await interaction.editReply({ embeds: [e], components: [row] }).catch(() => {});
    let msg = null;
    try {
      msg = await interaction.fetchReply();
    } catch (e) {
      return;
    }
    let col = null;
    try {
      col = msg.createMessageComponentCollector({ filter: i => (i.customId === "unreg_yes" || i.customId === "unreg_no") && i.user.id === userId && !i.user.bot, time: 60000 });
    } catch (e) {
      return;
    }
    col.on("collect", async i => {
      if (i.customId === "unreg_no") {
        try { await i.update({ embeds: [new EB().setColor("#99AAB5").setTitle("Cancelled").setThumbnail(avatar).setDescription("Your account stays linked.")], components: [] }); } catch (e) {}
        try { col.stop(); } catch (e) {}
        return;
      }
      try {
        const db = database.get();
        const u = db.discord?.users?.[userId];
        if (u) {
          u.registered = false;
          delete u.age;
          delete u.regTime;
        }
        await database.write(db).catch(() => {});
      } catch (e) {}
      try { await i.update({ embeds: [new EB().setColor("#57F287").setTitle("Account Unlinked").setThumbnail(avatar).setDescription("Your Discord account is unlinked from Akano. Use /register to link again.")], components: [] }); } catch (e) {}
      try { col.stop(); } catch (e) {}
    });
    col.on("end", () => {
      try { msg.edit({ components: [] }).catch(() => {}); } catch (e) {}
    });
  }
});
