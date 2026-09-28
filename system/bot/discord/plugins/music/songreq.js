import { defineBot as define } from "@kutashiakanocanzy/sdk";

function srvOf(db, gid, gname) {
  if (!db.discord || typeof db.discord !== "object") db.discord = { servers: {}, users: {} };
  if (!db.discord.servers) db.discord.servers = {};
  if (!db.discord.servers[gid]) db.discord.servers[gid] = { id: gid, name: gname || "", createdAt: new Date().toISOString() };
  const srv = db.discord.servers[gid];
  if (!srv.settings || typeof srv.settings !== "object") srv.settings = {};
  return srv.settings;
}

export function songRequestChannel(db, gid) {
  try {
    const st = db?.discord?.servers?.[String(gid)]?.settings;
    return st && st.songRequest ? String(st.songRequest) : null;
  } catch {
    return null;
  }
}

async function execute(interaction) {
  const gid = interaction.guildId;
  const gname = (interaction.guild && interaction.guild.name) || "";
  const ch = interaction.options.getChannel("channel") || interaction.channel;
  const { default: database } = await import("../../database/index.js");
  const db = database.get();
  const st = srvOf(db, gid, gname);
  st.songRequest = String(ch.id);
  try {
    await database.write(db);
  } catch {}
  await interaction.reply({
    embeds: [(new interaction.client.ebuilder).setColor("#57F287").setTitle("Song Requests ON").setDescription(`Type any song title in <#${ch.id}> — no slash needed, it plays automatically.\n\nJoin a voice channel first, then just type: \`bohemian rhapsody\`\n\nStaff: run this again in another channel to move it, or use /config to manage modules.`)],
    flags: 64
  }).catch(() => {});
}

export default define({
  name: ["setup-requests"],
  category: "music",
  description: "Turn a channel into song-request box (type title, auto-play)",
  examples: ["/setup-requests #music-request"],
  default_member_permissions: "32",
  options: [{
    name: "channel",
    type: 7,
    description: "Channel for requests (default: this channel)",
    required: false
  }],
  run: async ctx => execute(ctx.interaction)
});
