const canvas = require("../../scrapers/src/canvas.js");

async function getAvatarBuffer(api, userId) {
  try {
    const res = await api.getUserProfilePhotos(userId, {
      limit: 1
    }).catch(() => null);
    if (!res || !res.photos || !res.photos[0] || !res.photos[0][0]) return null;
    const fileId = res.photos[0][0].file_id;
    const file = await api.getFile(fileId).catch(() => null);
    if (!file || !file.file_path) return null;
    const token = global.settings?.telegram?.token || process.env.TELEGRAM_TOKEN;
    if (!token || token.includes("TELEGRAM_TOKEN")) return null;
    const url = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
    const resp = await fetch(url).catch(() => null);
    if (!resp || !resp.ok) return null;
    const buf = Buffer.from(await resp.arrayBuffer());
    return buf;
  } catch {
    return null;
  }
}

async function renderTelegramWelcome(api, user, chat, cfg = {}) {
  if (!canvas.available) return null;
  const W = 1024, H = 420;
  const cv = canvas.createCanvas(W, H);
  const g = cv.getContext("2d");
  canvas.roundRect(g, 0, 0, W, H, 28);
  g.clip();
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#14141f");
  bg.addColorStop(1, "#1e1b33");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  g.globalAlpha = .06;
  g.fillStyle = "#7c5cff";
  canvas.circle(g, W - 90, 70, 190);
  g.fill();
  g.fillStyle = "#5865f2";
  canvas.circle(g, 70, H - 40, 160);
  g.fill();
  g.globalAlpha = 1;
  const bannerH = 120;
  const grad = g.createLinearGradient(0, 0, W, bannerH);
  grad.addColorStop(0, "#5865F2");
  grad.addColorStop(1, "#8b5cf6");
  g.fillStyle = grad;
  g.fillRect(0, 0, W, bannerH);
  g.fillStyle = "rgba(255,255,255,0.12)";
  canvas.circle(g, W - 60, -20, 90);
  g.fill();
  canvas.circle(g, W - 170, bannerH + 30, 55);
  g.fill();
  const title = String(cfg.welcomeTitle || cfg.cardTitle || global.settings?.telegram?.groupManager?.welcomeTitle || "WELCOME").toUpperCase().slice(0, 22);
  g.font = canvas.font(40, true);
  g.fillStyle = "#ffffff";
  g.fillText(title, 250, 62);
  g.globalAlpha = .75;
  g.font = canvas.font(20);
  const serverName = String(chat?.title || chat?.username || "Group").slice(0, 34);
  g.fillText("— " + serverName, 252, 92);
  g.globalAlpha = 1;
  const size = 200;
  const cx = 60 + size / 2;
  const cy = bannerH + (H - bannerH) / 2;
  try {
    const buf = await getAvatarBuffer(api, user.id);
    let img = null;
    if (buf) img = await canvas.loadImage(buf).catch(() => null);
    g.save();
    g.shadowColor = "rgba(124,92,255,0.65)";
    g.shadowBlur = 34;
    g.fillStyle = "#2a2a3d";
    canvas.circle(g, cx, cy, size / 2 + 6);
    g.fill();
    g.restore();
    if (img) {
      g.save();
      canvas.circle(g, cx, cy, size / 2);
      g.clip();
      g.drawImage(img, cx - size / 2, cy - size / 2, size, size);
      g.restore();
    } else {
      g.fillStyle = "#5865F2";
      g.font = canvas.font(90, true);
      g.textAlign = "center";
      g.fillText(String(user.first_name || "U").charAt(0).toUpperCase(), cx, cy + 30);
      g.textAlign = "left";
    }
    g.strokeStyle = "#8b5cf6";
    g.lineWidth = 6;
    canvas.circle(g, cx, cy, size / 2 + 6);
    g.stroke();
  } catch {}
  let tx = cx + size / 2 + 45;
  if (tx < 250) tx = 250;
  g.fillStyle = "#ffffff";
  g.font = canvas.font(46, true);
  const uname = String(user.first_name || user.username || "Member").slice(0, 16);
  g.fillText(uname, tx, cy - 18);
  const count = cfg.count || "";
  const rawCap = String(cfg.welcomeCaption || cfg.caption || global.settings?.telegram?.groupManager?.welcomeCaption || "Selamat datang di {subject}").replaceAll("{user}", uname).replaceAll("{subject}", serverName).replaceAll("{count}", String(count)).replaceAll("{desc}", String(chat?.description || cfg.desc || "").slice(0, 40)).replaceAll("@user", uname).replaceAll("@subject", serverName);
  g.font = canvas.font(24);
  g.fillStyle = "#a5a3bd";
  const capLines = [];
  let line = "";
  for (const word of rawCap.split(" ")) {
    if (g.measureText(line + " " + word).width > W - tx - 50) {
      capLines.push(line.trim());
      line = word + " ";
    } else line += word + " ";
  }
  if (line.trim()) capLines.push(line.trim());
  capLines.slice(0, 2).forEach((l, i) => g.fillText(l, tx, cy + 26 + i * 32));
  return cv.toBuffer("image/png");
}

module.exports = {
  renderTelegramWelcome: renderTelegramWelcome,
  getAvatarBuffer: getAvatarBuffer
};