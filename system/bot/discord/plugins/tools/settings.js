
const database = require("../../../../database");



async function apply(interaction, db, { nick, avatar, banner, bio }, guildId) {
  const isAdmin = Boolean(
    interaction.member?.permissions?.has("ManageGuild") ||
      interaction.member?.permissions?.has("Administrator"),
  );
  if (!isAdmin) {
    return interaction.reply({
      embeds: [
        new (interaction.client.ebuilder)()
          .setColor("#ED4245")
          .setDescription("Only members with `Manage Server` or `Administrator` can change the settings."),
      ],
      flags: 64,
    });
  }

  await interaction.deferReply({ flags: 64 });

  const body = {};
  const changed = [];

  if (nick) {
    if (nick.length > 32) {
      return interaction.followUp({
        embeds: [
          new (interaction.client.ebuilder)()
            .setColor("#ED4245")
            .setDescription("Nickname is too long (max 32 characters)."),
        ],
        flags: 64,
      });
    }
    body.nick = nick;
    changed.push("Nickname: `" + nick + "`");
  }

  if (avatar) {
    const dataUri = await toDataUri(avatar);
    if (!dataUri) {
      return interaction.followUp({
        embeds: [
          new (interaction.client.ebuilder)()
            .setColor("#ED4245")
            .setDescription("Avatar must be an image file (PNG/JPG/GIF)."),
        ],
        flags: 64,
      });
    }
    body.avatar = dataUri;
    changed.push("Avatar");
  }

  if (banner) {
    const dataUri = await toDataUri(banner);
    if (!dataUri) {
      return interaction.followUp({
        embeds: [
          new (interaction.client.ebuilder)()
            .setColor("#ED4245")
            .setDescription("Banner must be an image file (PNG/JPG/GIF)."),
        ],
        flags: 64,
      });
    }
    body.banner = dataUri;
    changed.push("Banner");
  }

  if (bio) {
    if (bio.length > 190) {
      return interaction.followUp({
        embeds: [
          new (interaction.client.ebuilder)()
            .setColor("#ED4245")
            .setDescription("Bio is too long (max 190 characters)."),
        ],
        flags: 64,
      });
    }
    body.bio = bio;
    changed.push("Bio");
  }

  if (Object.keys(body).length > 0) {
    await interaction.client.rest.patch(`/guilds/${guildId}/members/@me`, { body });
  }

  if (!db.discord) db.discord = {};
  if (!db.discord.servers) db.discord.servers = {};
  if (!db.discord.servers[guildId]) db.discord.servers[guildId] = {};
  if (!db.discord.servers[guildId].settings) db.discord.servers[guildId].settings = {};
  const s = db.discord.servers[guildId].settings;

  if (nick) s.nick = nick;
  if (bio) s.bio = bio;

  database.write(db);

  return interaction.followUp({
    embeds: [
      new (interaction.client.ebuilder)()
        .setColor("#57F287")
        .setTitle("Settings Updated")
        .setDescription(
          "Applied to **" +
            (interaction.guild?.name || "this server") +
            "**:\n\n" +
            changed.join("\n"),
        )
        .setTimestamp(),
    ],
    flags: 64,
  });
}

async function toDataUri(attachment) {
  try {
    const mime = String(attachment.contentType || "").split(";")[0] || "";
    if (!/^image\/(png|jpe?g|gif)$/i.test(mime)) return null;
    const res = await fetch(attachment.url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 8 * 1024 * 1024) return null;
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch (e) {
    global.logError("discord.settings.image", e);
    return null;
  }
}
const { define } = require("../../../plugin");

module.exports = define({
  name: ["settings"],
  category: "tools",
  description: "Change bot settings for this server: nickname, avatar, banner, bio",
  options: [
    {
      name: "nick",
      type: 3,
      description: "Bot nickname in this server (max 32 characters) — admin only",
      required: false,
    },
    {
      name: "avatar",
      type: 11,
      description: "Bot avatar in this server (PNG/JPG/GIF) — admin only",
      required: false,
    },
    {
      name: "banner",
      type: 11,
      description: "Bot banner in this server (PNG/JPG/GIF) — admin only",
      required: false,
    },
    {
      name: "bio",
      type: 3,
      description: "Bot bio in this server (max 190) — admin only",
      required: false,
    },
  ],
  run: async (ctx) => {
    const interaction = ctx.interaction;

    
    try {
      const guildId = interaction.guildId;
      const db = database.get();

      const nick = interaction.options.getString("nick");
      const avatar = interaction.options.getAttachment("avatar");
      const banner = interaction.options.getAttachment("banner");
      const bio = interaction.options.getString("bio");

      if (!nick && !avatar && !banner && !bio) {
        return require("./status").view(interaction);
      }

      return await apply(interaction, db, { nick, avatar, banner, bio }, guildId);
    } catch (e) {
      global.logError("discord.settings", e);
      try {
        return interaction.reply({
          embeds: [
            new (interaction.client.ebuilder)()
              .setColor("#ED4245")
              .setDescription("Sorry, an error occurred while reading the settings.")
              .setTimestamp(),
          ],
          flags: 64,
        });
      } catch (err) {}
    }
  
  },
});
