import sdkFacade from "../../../sdk/index.js";
import { card, discord as dcSdk } from "@kutashiakanocanzy/sdk";
import sharp from "sharp";

const { define } = sdkFacade;
const { PermissionFlagsBits } = sdkFacade.engine();

async function fBuf(url) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error("Fetch failed: HTTP " + res.status);
  return Buffer.from(await res.arrayBuffer());
}

async function toPng320(buf) {
  let w = 320;
  let out = await sharp(buf).resize(320, 320, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  while (out.length > 480 * 1024 && w > 64) {
    w = Math.round(w * 0.8);
    out = await sharp(buf).resize(w, w, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  }
  return out;
}

export default define({
  name: ["sticker"],
  category: "sticker",
  description: "Make sticker",
  options: [
    { name: "image", type: 11, description: "Image", required: false },
    { name: "url", type: 3, description: "URL", required: false },
    { name: "name", type: 3, description: "Name", required: false }
  ],
  run: async ctx => {
    const interaction = ctx.interaction;
    const fail = async t => {
      try {
        if (interaction.deferred || interaction.replied) await dcSdk.editReply(interaction, { embeds: [card().setColor("#ED4245").setDescription(t)] });
        else await interaction.reply({ embeds: [card().setColor("#ED4245").setDescription(t)], flags: 64 });
      } catch {}
    };
    try {
      await dcSdk.thinking(interaction);
    } catch {
      return;
    }
    try {
      if (!interaction.guild) throw new Error("Use this inside a server.");
      const me = await interaction.guild.members.fetchMe().catch(() => null);
      if (me && !me.permissions.has(PermissionFlagsBits.ManageGuildExpressions)) throw new Error("I need the Manage Expressions permission.");
      const att = interaction.options.getAttachment("image");
      const url = att?.url || interaction.options.getString("url");
      if (!url) throw new Error("Attach an image or provide a URL.");
      const png = await toPng320(await fBuf(url));
      const rawName = String(interaction.options.getString("name") || interaction.user.username).toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30);
      const name = rawName.length >= 2 ? rawName : "akano";
      const sticker = await interaction.guild.stickers.create({ file: png, name: name, tags: "⭐", description: "Created by Akano", reason: `Sticker by ${interaction.user.tag}` });
      await dcSdk.editReply(interaction, { embeds: [card().setColor("#57F287").setDescription(`Sticker **${sticker.name}** created. Type :${sticker.name}: to use it.`)] });
    } catch (e) {
      await fail(e.message || "Failed.");
    }
  }
});
