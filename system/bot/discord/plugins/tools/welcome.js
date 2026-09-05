const {define: define} = require("../../../plugin");
const database = require("../../../../database");
const canvas = require("../../../../scrapers/src/canvas.js");

function getCfg(gid) {
  const db = database.get();
  if (!db.discord.servers[gid]) database.ensureDiscord(db, {
    guildId: gid,
    guild: {
      name: ""
    }
  });
  const s = db.discord.servers[gid];
  if (!s.welcome) s.welcome = {
    enabled: false,
    channelId: null,
    message: "Welcome {user} to **{server}**! You are member #{count}",
    autoRoleId: null,
    goodbyeEnabled: true,
    goodbyeMessage: "**{user}** left the server",
    cardTitle: "WELCOME",
    cardCaption: "Member #{count} of {server}"
  };
  return s.welcome;
}

async function renderWelcomeCard(member, count, cfg) {
  if (!canvas.available) return null;
  const W = 1024;
  const H = 500;
  const cv = canvas.createCanvas(W, H);
  const g = cv.getContext("2d");


  canvas.roundRect(g, 0, 0, W, H, 32);
  g.clip();


  const bgGrad = g.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, "#0a0a12");
  bgGrad.addColorStop(0.3, "#0d0f1a");
  bgGrad.addColorStop(0.6, "#111328");
  bgGrad.addColorStop(1, "#0a0a12");
  g.fillStyle = bgGrad;
  g.fillRect(0, 0, W, H);


  const drawOrb = (x, y, r, color, alpha) => {
    g.save();
    g.globalAlpha = alpha;
    const orbGrad = g.createRadialGradient(x, y, 0, x, y, r);
    orbGrad.addColorStop(0, color);
    orbGrad.addColorStop(0.5, color.replace(")", ",0.4)").replace("rgb(", "rgba("));
    orbGrad.addColorStop(1, "transparent");
    g.fillStyle = orbGrad;
    canvas.circle(g, x, y, r);
    g.fill();
    g.restore();
  };

  drawOrb(W * 0.15, H * 0.2, 280, "rgb(88,101,242)", 0.18);
  drawOrb(W * 0.85, H * 0.15, 220, "rgb(139,92,246)", 0.14);
  drawOrb(W * 0.5, H * 0.9, 300, "rgb(6,182,212)", 0.08);
  drawOrb(W * 0.75, H * 0.7, 180, "rgb(236,72,153)", 0.06);


  g.save();
  g.globalAlpha = 0.03;
  g.strokeStyle = "#ffffff";
  g.lineWidth = 0.5;
  for (let x = 0; x < W; x += 48) {
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke();
  }
  for (let y = 0; y < H; y += 48) {
    g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
  }
  g.restore();


  g.save();
  const sparkles = [
    [120, 60, 2.5], [W - 150, 80, 2], [W - 80, H - 120, 1.8],
    [200, H - 80, 2.2], [W / 2 + 100, 50, 1.5], [W / 2 - 80, H - 60, 1.8],
    [W - 200, H / 2, 2], [80, H / 2 + 40, 1.5]
  ];
  sparkles.forEach(([sx, sy, sr]) => {
    g.globalAlpha = 0.3 + Math.random() * 0.3;
    g.fillStyle = "#ffffff";
    canvas.circle(g, sx, sy, sr);
    g.fill();
  });
  g.restore();


  const cardX = 40, cardY = 40, cardW = W - 80, cardH = H - 80;
  g.save();


  canvas.roundRect(g, cardX, cardY, cardW, cardH, 24);
  g.fillStyle = "rgba(255, 255, 255, 0.04)";
  g.fill();


  canvas.roundRect(g, cardX, cardY, cardW, cardH, 24);
  g.strokeStyle = "rgba(255, 255, 255, 0.10)";
  g.lineWidth = 1.5;
  g.stroke();


  g.save();
  canvas.roundRect(g, cardX, cardY, cardW, cardH, 24);
  g.clip();
  const specGrad = g.createLinearGradient(cardX, cardY, cardX + cardW, cardY);
  specGrad.addColorStop(0, "transparent");
  specGrad.addColorStop(0.3, "rgba(255,255,255,0.12)");
  specGrad.addColorStop(0.5, "rgba(255,255,255,0.18)");
  specGrad.addColorStop(0.7, "rgba(255,255,255,0.12)");
  specGrad.addColorStop(1, "transparent");
  g.fillStyle = specGrad;
  g.fillRect(cardX, cardY, cardW, 1.5);
  g.restore();
  g.restore();


  g.save();
  canvas.roundRect(g, cardX, cardY, cardW, cardH, 24);
  g.clip();
  const accentGrad = g.createLinearGradient(cardX, cardY, cardX + cardW, cardY);
  accentGrad.addColorStop(0, "#5865F2");
  accentGrad.addColorStop(0.5, "#8b5cf6");
  accentGrad.addColorStop(1, "#ec4899");
  g.fillStyle = accentGrad;
  g.fillRect(cardX, cardY, cardW, 4);
  g.restore();


  const avatarSize = 164;
  const avX = cardX + 80 + avatarSize / 2;
  const avY = cardY + cardH / 2;

  try {
    const img = await canvas.loadImage(member.user.displayAvatarURL({
      extension: "png",
      size: 512
    }));


    g.save();
    g.shadowColor = "rgba(88,101,242,0.55)";
    g.shadowBlur = 40;
    g.fillStyle = "rgba(88,101,242,0.15)";
    canvas.circle(g, avX, avY, avatarSize / 2 + 12);
    g.fill();
    g.restore();


    g.save();
    g.shadowColor = "rgba(139,92,246,0.35)";
    g.shadowBlur = 24;
    canvas.circle(g, avX, avY, avatarSize / 2 + 8);
    g.strokeStyle = "rgba(139,92,246,0.35)";
    g.lineWidth = 3;
    g.stroke();
    g.restore();


    g.save();
    const ringGrad = g.createLinearGradient(avX - avatarSize / 2, avY - avatarSize / 2, avX + avatarSize / 2, avY + avatarSize / 2);
    ringGrad.addColorStop(0, "#5865F2");
    ringGrad.addColorStop(0.5, "#8b5cf6");
    ringGrad.addColorStop(1, "#ec4899");
    g.strokeStyle = ringGrad;
    g.lineWidth = 4;
    canvas.circle(g, avX, avY, avatarSize / 2 + 5);
    g.stroke();
    g.restore();


    g.save();
    g.strokeStyle = "#0d0f1a";
    g.lineWidth = 5;
    canvas.circle(g, avX, avY, avatarSize / 2 + 1);
    g.stroke();
    g.restore();


    g.save();
    canvas.circle(g, avX, avY, avatarSize / 2);
    g.clip();
    g.drawImage(img, avX - avatarSize / 2, avY - avatarSize / 2, avatarSize, avatarSize);
    g.restore();


    const dotX = avX + avatarSize / 2 - 10;
    const dotY = avY + avatarSize / 2 - 10;
    g.save();
    g.shadowColor = "rgba(48,209,88,0.6)";
    g.shadowBlur = 10;
    g.fillStyle = "#0d0f1a";
    canvas.circle(g, dotX, dotY, 14);
    g.fill();
    g.fillStyle = "#30D158";
    canvas.circle(g, dotX, dotY, 10);
    g.fill();
    g.restore();
  } catch {}


  let tx = avX + avatarSize / 2 + 50;
  if (tx < 310) tx = 310;
  const tCenterY = avY;


  const title = String(cfg.cardTitle || "WELCOME").toUpperCase();
  g.save();
  g.font = canvas.font(12, true);
  const tagW = g.measureText(title).width + 24;
  const tagH = 26;
  const tagY = tCenterY - 80;


  const tagGrad = g.createLinearGradient(tx, tagY, tx + tagW, tagY);
  tagGrad.addColorStop(0, "rgba(88,101,242,0.3)");
  tagGrad.addColorStop(1, "rgba(139,92,246,0.2)");
  g.fillStyle = tagGrad;
  canvas.roundRect(g, tx, tagY - tagH / 2, tagW, tagH, 13);
  g.fill();
  canvas.roundRect(g, tx, tagY - tagH / 2, tagW, tagH, 13);
  g.strokeStyle = "rgba(88,101,242,0.5)";
  g.lineWidth = 1;
  g.stroke();


  g.fillStyle = "#8b9cf7";
  g.textBaseline = "middle";
  g.fillText(title.slice(0, 22), tx + 12, tagY + 1);
  g.textBaseline = "alphabetic";
  g.restore();


  g.fillStyle = "#ffffff";
  g.font = canvas.font(46, true);
  const uname = String(member.user.username).slice(0, 18);
  g.fillText(uname, tx, tCenterY - 20);


  const displayName = member.user.globalName || member.user.displayName || "";
  if (displayName && displayName !== member.user.username) {
    g.fillStyle = "rgba(255,255,255,0.4)";
    g.font = canvas.font(20);
    g.fillText("@" + displayName.slice(0, 24), tx, tCenterY + 10);
  }


  const rawCaption = String(cfg.cardCaption || "Member #{count} of {server}")
    .replaceAll("{user}", member.user.username)
    .replaceAll("{server}", member.guild.name)
    .replaceAll("{count}", String(count));
  g.font = canvas.font(20);
  g.fillStyle = "rgba(165,163,189,0.85)";
  const capLines = [];
  let line = "";
  const maxLineW = W - tx - 80;
  for (const word of rawCaption.split(" ")) {
    if (g.measureText(line + " " + word).width > maxLineW) {
      capLines.push(line.trim());
      line = word + " ";
    } else line += word + " ";
  }
  if (line.trim()) capLines.push(line.trim());
  const capStartY = tCenterY + 42;
  capLines.slice(0, 2).forEach((l, i) => {
    g.fillText(l, tx, capStartY + i * 30);
  });


  g.save();
  const countText = `Member #${count}`;
  g.font = canvas.font(14, true);
  const countW = g.measureText(countText).width + 32;
  const countH = 30;
  const countX = tx;
  const countY = capStartY + Math.min(capLines.length, 2) * 30 + 16;

  g.fillStyle = "rgba(255,255,255,0.06)";
  canvas.roundRect(g, countX, countY, countW, countH, 15);
  g.fill();
  canvas.roundRect(g, countX, countY, countW, countH, 15);
  g.strokeStyle = "rgba(255,255,255,0.10)";
  g.lineWidth = 1;
  g.stroke();

  g.fillStyle = "rgba(255,255,255,0.55)";
  g.textBaseline = "middle";
  g.fillText(countText, countX + 16, countY + countH / 2 + 1);
  g.textBaseline = "alphabetic";
  g.restore();


  g.save();

  const sepY = cardY + cardH - 52;
  const sepGrad = g.createLinearGradient(cardX + 32, sepY, cardX + cardW - 32, sepY);
  sepGrad.addColorStop(0, "transparent");
  sepGrad.addColorStop(0.2, "rgba(255,255,255,0.06)");
  sepGrad.addColorStop(0.8, "rgba(255,255,255,0.06)");
  sepGrad.addColorStop(1, "transparent");
  g.strokeStyle = sepGrad;
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(cardX + 32, sepY);
  g.lineTo(cardX + cardW - 32, sepY);
  g.stroke();


  g.font = canvas.font(13);
  g.fillStyle = "rgba(255,255,255,0.3)";
  const serverLabel = "✦  " + member.guild.name.slice(0, 40);
  g.fillText(serverLabel, cardX + 40, cardY + cardH - 24);


  const now = new Date();
  const ts = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const tsW = g.measureText(ts).width;
  g.fillText(ts, cardX + cardW - 40 - tsW, cardY + cardH - 24);
  g.restore();

  return cv.toBuffer("image/png");
}

let boundGuilds = new Set;

function bindEvents(client) {
  client.on("guildMemberAdd", async member => {
    try {
      const cfg = getCfg(member.guild.id);
      if (!cfg.enabled) return;
      const count = member.guild.memberCount;
      if (cfg.autoRoleId) {
        try {
          await member.roles.add(cfg.autoRoleId);
        } catch {}
      }
      const ch = member.guild.channels.cache.get(cfg.channelId) || await client.channels.fetch(cfg.channelId).catch(() => null);
      if (!ch) return;
      const card = await renderWelcomeCard(member, count, cfg).catch(() => null);
      const text = cfg.message.replaceAll("{user}", `<@${member.user.id}>`).replaceAll("{server}", member.guild.name).replaceAll("{count}", String(count));
      const payload = {
        content: text
      };
      if (card) payload.files = [ {
        attachment: card,
        name: "welcome.png"
      } ];
      await ch.send(payload).catch(() => {});
    } catch (e) {
      global.logError("welcome.join", e);
    }
  });
  client.on("guildMemberRemove", async member => {
    try {
      const cfg = getCfg(member.guild?.id);
      if (!cfg.enabled || !cfg.goodbyeEnabled) return;
      const ch = member.guild.channels.cache.get(cfg.channelId) || await client.channels.fetch(cfg.channelId).catch(() => null);
      if (!ch) return;
      const text = cfg.goodbyeMessage.replaceAll("{user}", `<@${member.user?.id || "?"}>`).replaceAll("{server}", member.guild.name).replaceAll("{count}", String(member.guild.memberCount));
      await ch.send(text).catch(() => {});
    } catch (e) {
      global.logError("welcome.leave", e);
    }
  });
  boundGuilds.add(client.user?.id || "default");
}

async function setup(client) {
  try {
    const db = database.get();
    const servers = db.discord?.servers || {};
    const anyEnabled = Object.values(servers).some(s => s.welcome?.enabled);
    if (anyEnabled && !boundGuilds.has(client.user?.id || "default")) bindEvents(client);
  } catch (e) {
    global.logError("welcome.setup", e);
  }
}

module.exports = define({
  name: [ "welcome" ],
  category: "tools",
  description: "Welcome card canvas + goodbye + autorole on member join",
  setup: setup,
  options: [ {
    name: "channel",
    type: 7,
    description: "Channel for welcome messages",
    required: false
  }, {
    name: "enabled",
    type: 5,
    description: "Turn welcome on/off",
    required: false
  }, {
    name: "autorole",
    type: 8,
    description: "Role given automatically on join",
    required: false
  }, {
    name: "goodbye",
    type: 5,
    description: "Toggle goodbye message",
    required: false
  }, {
    name: "title",
    type: 3,
    description: "Card title text (max 22 chars)",
    required: false
  }, {
    name: "caption",
    type: 3,
    description: "Card caption, vars: {user} {server} {count}",
    required: false
  } ],
  run: async ctx => {
    const i = ctx.interaction;
    await i.deferReply({
      flags: 64
    }).catch(() => {});
    const gid = i.guildId;
    const cfg = getCfg(gid);
    const channel = i.options.getChannel("channel");
    const enabled = i.options.getBoolean("enabled");
    const autorole = i.options.getRole("autorole");
    const goodbye = i.options.getBoolean("goodbye");
    const title = i.options.getString("title");
    const caption = i.options.getString("caption");
    if (channel) cfg.channelId = channel.id;
    if (typeof enabled === "boolean") cfg.enabled = enabled;
    if (autorole) cfg.autoRoleId = autorole.id;
    if (typeof goodbye === "boolean") cfg.goodbyeEnabled = goodbye;
    if (title) cfg.cardTitle = title.slice(0, 22);
    if (caption) cfg.cardCaption = caption.slice(0, 120);
    try {
      database.write(database.get());
    } catch {}
    if ((enabled === true || cfg.enabled) && !boundGuilds.has(i.client.user?.id || "default")) bindEvents(i.client);
    const previewCard = await renderWelcomeCard({
      user: i.user,
      guild: i.guild
    }, i.guild?.memberCount || 1, cfg).catch(() => null);
    const embed = (new i.client.ebuilder).setColor("#5865F2").setTitle("Welcome Config").setDescription([ `Status: ${cfg.enabled ? "ON" : "OFF"}`, `Canvas: ${canvas.available ? canvas.fontOk ? "native + font OK" : "native (system font)" : "unavailable"}`, `Channel: ${cfg.channelId ? `<#${cfg.channelId}>` : "not set"}`, `AutoRole: ${cfg.autoRoleId ? `<@&${cfg.autoRoleId}>` : "none"}`, `Goodbye: ${cfg.goodbyeEnabled ? "ON" : "OFF"}`, `Title: \`${cfg.cardTitle}\``, `Caption: \`${cfg.cardCaption}\``, "", "Vars: {user} {server} {count}" ].join("\n"));
    if (previewCard) embed.setImage("attachment://preview.png");
    const payload = {
      embeds: [ embed ]
    };
    if (previewCard) payload.files = [ {
      attachment: previewCard,
      name: "preview.png"
    } ];
    return i.editReply(payload).catch(() => {});
  }
});