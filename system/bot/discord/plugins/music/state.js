const fs = require("fs");
const path = require("path");

const STATE_FILE = path.join(__dirname, "../../../database/playerState.json");

function svState(guildId, queue) {
  try {
    let db = { players: {} };
    if (fs.existsSync(STATE_FILE)) {
      db = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    }
    db.players[guildId] = {
      songs: queue.songs.map((s) => ({
        title: s.title,
        url: s.url,
        duration: s.duration,
        source: s.source,
        requester: s.requester,
        thumbnail: s.thumbnail,
        uploader: s.uploader,
        album: s.album,
      })),
      currentSong: queue.currentSong
        ? {
            title: queue.currentSong.title,
            url: queue.currentSong.url,
            duration: queue.currentSong.duration,
            source: queue.currentSong.source,
            requester: queue.currentSong.requester,
            thumbnail: queue.currentSong.thumbnail,
            uploader: queue.currentSong.uploader,
            album: queue.currentSong.album,
          }
        : null,
      loop: queue.loop,
      shuffle: queue.shuffle,
      autoplay: queue.autoplay,
      autoplayGenre: queue.autoplayGenre,
      volume: queue.volume,
      filter: queue.currentFilter || "none",
      voiceChannelId: queue.voiceChannel?.id || null,
      textChannelId: queue.textChannel?.id || null,
      updatedAt: Date.now(),
    };
    fs.writeFileSync(STATE_FILE, JSON.stringify(db, null, 2));
  } catch (e) {}
}

function ldState(guildId) {
  try {
    if (!fs.existsSync(STATE_FILE)) return null;
    const db = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    return db.players?.[guildId] || null;
  } catch (e) {
    return null;
  }
}

function ldAllState() {
  try {
    if (!fs.existsSync(STATE_FILE)) return {};
    const db = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    return db.players || {};
  } catch (e) {
    return {};
  }
}

function clrState(guildId) {
  try {
    if (!fs.existsSync(STATE_FILE)) return;
    const db = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    delete db.players?.[guildId];
    fs.writeFileSync(STATE_FILE, JSON.stringify(db, null, 2));
  } catch (e) {}
}

module.exports = {
  STATE_FILE,
  svState,
  ldState,
  ldAllState,
  clrState,
};
