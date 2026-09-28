import { discord as dcNs } from "@kutashiakanocanzy/sdk";
import { card, button, actionRow } from "@kutashiakanocanzy/sdk";
import { formatDuration, createVolumeBar, bar, AUDIO_FILTERS } from "./utils.js";

const { ButtonStyle } = dcNs.engine();

function currentVid(q) {
  const s = q?.currentSong;
  const m = String(s?.url || "").match(/[?&]v=([\w-]{6,})/);
  return s?.id || (m ? m[1] : null);
}

function icon(queue, key) {
  if (queue?.emotes) return queue.emotes.get(key);
  return "";
}

function icBtn(queue, key, label) {
  const e = icon(queue, key);
  const b = button("tmp", label || key);
  if (e) {
    try { b.setEmoji(e); } catch {}
  }
  return b;
}

function loopLabel(queue) {
  return queue.loop === "track" ? "Track" : queue.loop === "queue" ? "Queue" : "Off";
}

function controlButtons(queue) {
  const toggling = queue.paused;
  const toggle = icBtn(queue, toggling ? "play" : "pause", toggling ? "Play" : "Pause").setCustomId("music_pause").setStyle(toggling ? ButtonStyle.Success : ButtonStyle.Primary);
  const skip = icBtn(queue, "skip", "Skip").setCustomId("music_skip").setStyle(ButtonStyle.Secondary);
  const stop = icBtn(queue, "stop", "Stop").setCustomId("music_stop").setStyle(ButtonStyle.Danger);
  const loop = icBtn(queue, "loop", "Loop: " + loopLabel(queue)).setCustomId("music_loop").setStyle(queue.loop && queue.loop !== "off" ? ButtonStyle.Success : ButtonStyle.Secondary);
  const shuffle = icBtn(queue, "shuffle", "Shuffle: " + (queue.shuffle ? "On" : "Off")).setCustomId("music_shuffle").setStyle(queue.shuffle ? ButtonStyle.Success : ButtonStyle.Secondary);
  const autoBtn = button("music_autoplay", "Autoplay: " + (queue.autoplay ? "On" : "Off"), queue.autoplay ? ButtonStyle.Success : ButtonStyle.Secondary);
  const queueBtn = button("music_queue", "Queue", ButtonStyle.Secondary);
  const dash = button("music_dashboard", "Dashboard", ButtonStyle.Primary);
  return [ actionRow([ toggle, skip, stop, loop, shuffle ]), actionRow([ autoBtn, queueBtn, dash ]) ];
}

function genreButtons(client, genres) {
  const rows = [];
  const genreKeys = Object.keys(genres);
  for (let i = 0; i < genreKeys.length; i += 5) {
    const btns = [];
    for (let j = i; j < Math.min(i + 5, genreKeys.length); j++) {
      const g = genres[genreKeys[j]];
      btns.push(button(`genre_${genreKeys[j]}`, g.label, ButtonStyle.Secondary));
    }
    rows.push(actionRow(btns));
  }
  return rows;
}

function nowPlaying(queue, elapsed) {
  const song = queue.currentSong;
  const progress = bar(elapsed, song.duration);
  const nextList = queue.songs.slice(0, 3).map((s, i) => `\`${i + 1}.\` ${s.title} \`[${formatDuration(s.duration)}]\``).join("\n") || "*Autoplay active - random track queued next*";
  const volumeBar = createVolumeBar(Math.round(queue.volume * 100));
  const filterText = queue.currentFilter && queue.currentFilter !== "none" ? AUDIO_FILTERS[queue.currentFilter]?.label || queue.currentFilter : null;
  const desc = [
    `**Artist:** ${song.uploader || "Unknown"}`,
    `**Album:** ${song.album || "-"}`,
    "",
    `\`${formatDuration(elapsed)}\` ${progress} \`${formatDuration(song.duration)}\``,
    "",
    `**Requested by:** ${song.requester || "Unknown"}`,
    `**Volume:** ${volumeBar} \`${Math.round(queue.volume * 100)}%\``,
    `**Loop:** ${loopLabel(queue)} | **Shuffle:** ${queue.shuffle ? "On" : "Off"} | **Autoplay:** ${queue.autoplay ? "On" : "Off"}${filterText ? " | **Filter:** " + filterText : ""}`
  ].join("\n");
  return card().setColor("#5865F2").setAuthor({
    name: "Now Playing"
  }).setTitle(song.title).setURL(song.url).setThumbnail(song.thumbnail || null).setDescription(desc).addFields({
    name: "Up Next",
    value: nextList,
    inline: false
  }).setFooter({
    text: `${queue.guestMode ? "Guest • " : ""}${queue.songs.length} track(s) in queue`
  });
}

function queued(queue, song, position, formatDurationFn) {
  return card().setColor("#5865F2").setTitle("Added to Queue").setDescription(`[${song.title}](${song.url})`).setThumbnail(song.thumbnail || null).addFields({
    name: "Artist",
    value: `\`${song.uploader || "Unknown"}\``,
    inline: true
  }, {
    name: "Duration",
    value: `\`[${formatDurationFn(song.duration)}]\``,
    inline: true
  }, {
    name: "Source",
    value: `\`${song.source}\``,
    inline: true
  }, {
    name: "Position",
    value: `\`#${position}\``,
    inline: true
  });
}

export {
  controlButtons,
  genreButtons,
  nowPlaying,
  queued
};
