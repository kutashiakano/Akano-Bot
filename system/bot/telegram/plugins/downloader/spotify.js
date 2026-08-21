const fs = require("fs/promises");

function isSpotifyUrl(url) {
  return /open\.spotify\.com\/(track|album|playlist)|spotify\.link\//i.test(String(url || ""));
}

function buildCaption(track) {
  const lines = [`<b>Spotify Track</b>`, `${track.title}`];
  if (track.uploader !== "Unknown") lines.push(`By: ${track.uploader}`);
  if (track.album) lines.push(`Album: ${track.album}`);
  if (track.durationLabel) lines.push(`Duration: ${track.durationLabel}`);
  return lines.join("\n");
}

async function downloadSpotify(ctx, query, isAudio = true) {
  try {
    const spotify = global.scraper.spotify;
    if (!spotify) throw new Error("Spotify module not available");
    const downloader = global.scraper.ytdpl;
    if (!downloader) throw new Error("Downloader not available");

    await ctx.reply("🕒 Searching Spotify, please wait...");

    let track;
    if (isSpotifyUrl(query)) {
      if (/open\.spotify\.com\/(album|playlist)/i.test(query)) {
        const tracks = await spotify.getPlaylist(query);
        if (!tracks.length) throw new Error("No tracks found in this Spotify link");
        track = tracks[0];
        const mediaGroup = [];
        for (const t of tracks.slice(0, 10)) {
          const res = await spotify.download(t.url);
          const file = res.files[0];
          const stat = await fs.stat(file);
          const maxSize = (global.settings.max_uploud || 50) * 1024 * 1024;
          if (stat.size > maxSize) {
            await spotify.cleanup(res.directory);
            continue;
          }
          if (mediaGroup.length === 0) {
            mediaGroup.push({
              type: "audio",
              media: { source: file },
              title: t.title,
              performer: t.uploader,
              caption: buildCaption(t),
              parse_mode: "HTML",
            });
          } else {
            mediaGroup.push({
              type: "audio",
              media: { source: file },
              title: t.title,
              performer: t.uploader,
            });
          }
          await spotify.cleanup(res.directory);
        }
        if (!mediaGroup.length) throw new Error("All tracks exceed the max upload size");
        if (mediaGroup.length === 1) {
          await ctx.replyWithAudio(mediaGroup[0].media, {
            title: mediaGroup[0].title,
            performer: mediaGroup[0].performer,
            caption: mediaGroup[0].caption,
            parse_mode: "HTML",
          });
        } else {
          await ctx.replyWithMediaGroup(mediaGroup).catch(async () => {
            for (const item of mediaGroup) {
              await ctx
                .replyWithAudio(item.media, {
                  title: item.title,
                  performer: item.performer,
                  caption: item.caption,
                  parse_mode: "HTML",
                })
                .catch(() => {});
            }
          });
        }
        return;
      }
      const res = await spotify.download(query);
      track = res.metadata;
      const file = res.files[0];
      const stat = await fs.stat(file);
      const maxSize = (global.settings.max_uploud || 50) * 1024 * 1024;
      if (stat.size > maxSize) {
        await spotify.cleanup(res.directory);
        throw new Error("File size exceeds the maximum limit");
      }
      await ctx.replyWithAudio(
        { source: file },
        {
          title: track.title,
          performer: track.uploader,
          caption: buildCaption(track),
          parse_mode: "HTML",
        },
      );
      await spotify.cleanup(res.directory);
      return;
    }

    const results = await spotify.search(query, 1);
    if (!results.length) throw new Error("No results found on Spotify");
    track = results[0];
    const res = await spotify.download(track.url);
    const file = res.files[0];
    const stat = await fs.stat(file);
    const maxSize = (global.settings.max_uploud || 50) * 1024 * 1024;
    if (stat.size > maxSize) {
      await spotify.cleanup(res.directory);
      throw new Error("File size exceeds the maximum limit");
    }
    await ctx.replyWithAudio(
      { source: file },
      {
        title: track.title,
        performer: track.uploader,
        caption: buildCaption(track),
        parse_mode: "HTML",
      },
    );
    await spotify.cleanup(res.directory);
  } catch (error) {
    await ctx.reply(`Error: ${error.message}`);
  }
}



module.exports.isSpotifyUrl = isSpotifyUrl;
const { define } = require("../../../plugin");

module.exports = define({
  name: ["spotify", "spdl"],
  category: "downloader",
  help: "Search or download Spotify (track, album, playlist)",

  run: async (ctx) => {

    if (!args) {
      return ctx.reply(
        "Usage:\n" +
          "/spotify <link or song title>\n" +
          "/spotify https://open.spotify.com/track/xxxxx\n" +
          "/spotify never gonna give you up",
      );
    }
    const url = args.trim();
    await downloadSpotify(ctx, url, true);
  
  },
});
