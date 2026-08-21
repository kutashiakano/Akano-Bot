const path = require("path");

const AUDIO_FILTERS = {
  none: { label: "None", args: [] },
  bassboost: { label: "Bass Boost", args: ["-af", "bass=g=10"] },
  nightcore: { label: "Nightcore", args: ["-af", "asetrate=48000*1.25,aresample=48000"] },
  vaporwave: { label: "Vaporwave", args: ["-af", "asetrate=48000*0.8,aresample=48000"] },
  "8d": { label: "8D Audio", args: ["-af", "apulsator=hz=0.09"] },
};

const BLOCKED_KEYWORDS = [
  "tutorial",
  "lesson",
  "course",
  "how-to",
  "guide",
  "podcast",
  "interview",
  "talk",
  "speech",
  "lecture",
  "review",
  "unboxing",
  "reaction",
  "gameplay",
  "full movie",
  "full album",
  "documentary",
  "asmr",
  "audiobook",
  "story",
  "meditation",
  "compilation",
  "mix",
  "dj set",
  "long version",
];

function formatDuration(seconds) {
  if (!seconds || seconds === 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(Math.floor(seconds % 60)).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

function parseSeekTime(input) {
  const parts = input.split(":").map(Number);
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  const n = Number(input);
  return isNaN(n) ? null : n;
}

function createVolumeBar(percent) {
  const barLen = 15;
  const filled = Math.round((percent / 100) * barLen);
  return "▓".repeat(filled) + "░".repeat(barLen - filled) + ` ${percent}%`;
}

function bar(current, total, length = 14) {
  if (!total || total === 0) return "—".repeat(length);
  const progress = Math.min(Math.floor((current / total) * length), length - 1);
  return "═".repeat(progress) + "●" + "═".repeat(length - progress - 1);
}

function isBlocked(title) {
  if (!title) return false;
  const lower = title.toLowerCase();
  return BLOCKED_KEYWORDS.some((kw) => lower.includes(kw));
}

function isValidAutoplayTrack(track) {
  if (!track || !track.title || !track.duration) return false;
  if (track.duration < 30 || track.duration > 600) return false;
  if (isBlocked(track.title)) return false;
  if (track.title.match(/[\u{1F600}-\u{1F64F}]/u)?.length > 3) return false;
  return true;
}

function extractVideoId(url) {
  const m = String(url || "").match(/[?&]v=([\w-]{6,})/);
  return m ? m[1] : null;
}

function isPlaylistUrl(url) {
  return /[?&]list=[\w-]{6,}/i.test(String(url || ""));
}

module.exports = {
  AUDIO_FILTERS,
  BLOCKED_KEYWORDS,
  formatDuration,
  parseSeekTime,
  createVolumeBar,
  bar,
  isBlocked,
  isValidAutoplayTrack,
  extractVideoId,
  isPlaylistUrl,
};
