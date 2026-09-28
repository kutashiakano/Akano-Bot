import { discord as dcNs } from "@kutashiakanocanzy/sdk";
import { card, button, actionRow, watch, discord as dcSdk } from "@kutashiakanocanzy/sdk";
import database from "../../../../database/index.js";

import { defineBot as define } from "@kutashiakanocanzy/sdk";
const { ButtonStyle } = dcNs.engine();

export default define({
  name: ["unregister"],
  category: "tools",
  description: "Unlink your Discord account from Akano (game data is kept)",
  options: [],
  run: async ctx => {
    const interaction = ctx.interaction;
    try {
      await dcSdk.thinking(interaction);
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
      return dcSdk.editReply(interaction, { embeds: [card().setColor("#99AAB5").setTitle("Not Linked").setThumbnail(avatar).setDescription("Your Discord account is not linked to Akano. Use /register to link it.")] }).catch(() => {});
    }
    const e = card().setColor("#ED4245").setTitle("Unlink Account").setThumbnail(avatar).setDescription("Unlink " + interaction.user.username + " from Akano?\n\nYou will lose access to /rpg until you link again. Money, XP, and items are kept.");
    const row = actionRow([
      button("unreg_yes", "Unlink", ButtonStyle.Danger),
      button("unreg_no", "Cancel", ButtonStyle.Secondary)
    ]);
    await dcSdk.editReply(interaction, { embeds: [e], components: [row] }).catch(() => {});
    let msg = null;
    try {
      msg = await interaction.fetchReply();
    } catch (e) {
      return;
    }
    let done = false;
    const col = await watch(msg, i => (i.customId === "unreg_yes" || i.customId === "unreg_no") && i.user.id === userId && !i.user.bot, 60000, () => {
      if (!done) {
        try { msg.edit({ components: [] }).catch(() => {}); } catch (e) {}
      }
    }, {
      collect: async i => {
        if (i.customId === "unreg_no") {
          done = true;
          try { await i.update({ embeds: [card().setColor("#99AAB5").setTitle("Cancelled").setThumbnail(avatar).setDescription("Your account stays linked.")], components: [] }); } catch (e) {}
          try { col.stop(); } catch (e) {}
          return;
        }
        done = true;
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
        try { await i.update({ embeds: [card().setColor("#57F287").setTitle("Account Unlinked").setThumbnail(avatar).setDescription("Your Discord account is unlinked from Akano. Use /register to link again.")], components: [] }); } catch (e) {}
        try { col.stop(); } catch (e) {}
      }
    });
    if (!col) return;
  }
});
