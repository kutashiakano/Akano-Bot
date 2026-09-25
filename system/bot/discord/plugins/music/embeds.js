import sdkFacade from "../../../sdk/index.js";
import { card, button, actionRow } from "@kutashiakanocanzy/sdk";
import { formatDuration, createVolumeBar, bar, AUDIO_FILTERS } from "./utils.js";

const { ButtonStyle } = sdkFacade.engine();

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

function controlButtons(queue) {
  const toggling = queue.paused;
  const toggle = icBtn(queue, toggling ? "play" : "pause", toggling ? "Play" : "Pause").setCustomId("music_pause").setStyle(toggling ? ButtonStyle.Success : ButtonStyle.Primary);
  const skip = icBtn(queue, "skip", "Skip").setCustomId("music_skip").setStyle(ButtonStyle.Secondary);
  const stop = icBtn(queue, "stop", "Stop").setCustomId("music_stop").setStyle(ButtonStyle.Danger);
  const autoBtn = button("music_autoplay", queue.autoplay ? "Autoplay: On" : "Autoplay: Off", queue.autoplay ? ButtonStyle.Success : ButtonStyle.Secondary);
  const dash = button("music_dashboard", "Dashboard", ButtonStyle.Primary);
  return [ actionRow([ toggle, skip, stop, autoBtn, dash ]) ];
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
  const loopText = queue.loop === "track" ? "Track" : queue.loop === "queue" ? "Queue" : "Off";
  const autoplayText = queue.autoplay ? "On" : "Off";
  const shuffleText = queue.shuffle ? "On" : "Off";
  const filterText = queue.currentFilter && queue.currentFilter !== "none" ? AUDIO_FILTERS[queue.currentFilter]?.label || queue.currentFilter : "None";
  const volumeBar = createVolumeBar(Math.round(queue.volume * 100));
  return card().setColor("#5865F2").setAuthor({
    name: "Now Playing"
  }).setTitle(song.title).setURL(song.url).setThumbnail(song.thumbnail || null).setDescription([ `\`${formatDuration(elapsed)}\` ${progress} \`${formatDuration(song.duration)}\``, song.requester ? `Requested by ${song.requester}` : "" ].filter(Boolean).join("\n")).addFields({
    name: "Artist",
    value: `\`${song.uploader || "Unknown"}\``,
    inline: true
  }, {
    name: "Album",
    value: `\`${song.album || "-"}\``,
    inline: true
  }, {
    name: "Source",
    value: `\`${song.source || "YouTube"}\``,
    inline: true
  }, {
    name: "Volume",
    value: `\`${volumeBar}\``,
    inline: true
  }, {
    name: "Filter",
    value: `\`${filterText}\``,
    inline: true
  }, {
    name: "Loop",
    value: `\`${loopText}\``,
    inline: true
  }, {
    name: "Shuffle",
    value: `\`${shuffleText}\``,
    inline: true
  }, {
    name: "Autoplay",
    value: `\`${autoplayText}\``,
    inline: true
  }, {
    name: "Up Next",
    value: nextList,
    inline: false
  }).setFooter({
    text: `${queue.guestMode ? "Guest • " : ""}${queue.songs.length} track(s) in queue • Session: ${queue.sessionId.slice(0, 6)}`
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
