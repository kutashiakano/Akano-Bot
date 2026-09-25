import sdkFacade from "../../../sdk/index.js";
import { card, discord as dcSdk } from "@kutashiakanocanzy/sdk";
import database from "../../../../database/index.js";

const { define } = sdkFacade;

export default define({
  name: [ "me", "profile" ],
  category: "tools",
  description: "Show user profile card",
  options: [ {
    name: "user",
    type: 6,
    description: "User to view (default: yourself)",
    required: false
  } ],
  run: async ctx => {
    const interaction = ctx.interaction;
    try {
      await dcSdk.thinking(interaction);
    } catch {
      return;
    }
    const target = interaction.options.getUser("user") || interaction.user;
    let extra = {};
    try {
      extra = database.get().discord?.users?.[target.id] || {};
    } catch {}
    const warns = Array.isArray(extra.mod?.warns) ? extra.mod.warns.length : 0;
    const viols = extra.mod?.violations || 0;
    const body = ctx.fmt.userCard("dc", {
      name: target.username,
      id: target.id,
      username: target.username + (target.discriminator !== "0" ? "#" + target.discriminator : ""),
      accountCreated: new Date(target.createdTimestamp).toLocaleDateString(),
      bot: !!target.bot,
      registered: !!extra.registered,
      warning: warns + " warn / " + viols + " auto",
      premium: false,
      expired: "-",
      footer: global.botname || ""
    });
    const embed = card().setColor("#5865F2").setThumbnail(target.displayAvatarURL({
      dynamic: true,
      size: 256
    })).setDescription(body).setTimestamp();
    await dcSdk.editReply(interaction, {
      embeds: [ embed ]
    }).catch(() => {});
  }
});
