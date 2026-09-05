const fs = require("fs/promises");
const path = require("path");
const {downloadStatus: downloadStatus} = require("../../lib/utils");

const cookiePath = path.join(__dirname, "../../../../../cookies.txt");

let _udl = null;
try { _udl = require("../../../../scrapers/src/unified-downloader"); } catch {}
const __orig = {
  reg: true,
  help: [ "youtube", "ytdl", "yt", "play", "ytsearch", "ytmusic" ],
  command: [ "youtube", "ytdl", "yt", "play", "ytsearch", "ytmusic" ],
  tags: [ "downloader" ],
  run: async (m, {sock: sock, text: text}) => {
    if (!text) {
      throw new Error("Please provide a YouTube/Spotify URL, search query, or special feed.");
    }
    const status = await downloadStatus(m, sock);
    try {
      let fullText = text.trim();

      let _parsedOpts = {};
      let _queryFromFlags = null;
      if (_udl && typeof _udl.parseCliFlags === "function") {
        const urlMatch = fullText.match(/\bhttps?:\/\/[^\s]+/i);
        if (urlMatch) {
          const urlStr = urlMatch[0];
          const after = fullText.slice(fullText.indexOf(urlStr) + urlStr.length).trim();
          if (after) _parsedOpts = _udl.parseCliFlags(after);
          _queryFromFlags = urlStr;
        } else {
          const flagIdx = fullText.search(/\s--/);
          if (flagIdx !== -1) {
            const qPart = fullText.slice(0, flagIdx).trim();
            const fPart = fullText.slice(flagIdx).trim();
            _parsedOpts = _udl.parseCliFlags(fPart);
            _queryFromFlags = qPart;
          }
        }
      }
      const isAudio = /--audio|--mp3|--music/.test(fullText) || !!_parsedOpts.audioOnly;
      const query = (_queryFromFlags !== null ? _queryFromFlags : fullText.replace(/\s*(?:--audio|--mp3|--music)\s*/i, "").trim());
      const isSpecialFeed = /^:(ytfav|ythis|ytrec|ytnotif|ytsubs|ytwatchlater)$/i.test(query);
      const isSpotify = /open\.spotify\.com\/(track|album|playlist)|spotify\.link\//i.test(query);
      const isUrl = /^https?:\/\//i.test(query);
      if (isSpotify) {
        const spotify = global.scraper.spotify;
        if (!spotify) throw new Error("Spotify module not available");
        await status.processing();
        const track = await spotify.getTrack(query);
        const res = await spotify.download(track.url);
        const file = res.files[0];
        const stat = await fs.stat(file);
        const maxSize = (global.settings.max_uploud || 50) * 1024 * 1024;
        if (stat.size > maxSize) {
          await spotify.cleanup(res.directory);
          throw new Error("File size exceeds the maximum limit.");
        }
        const dot = global.settings.dot || "•";
        const caption = `*Spotify Audio Download*\n${dot} Title: ${track.title}\n${dot} Author: ${track.uploader}\n${dot} Album: ${track.album || "-"}\n${dot} Duration: ${track.durationLabel || track.duration + "s"}`;
        await sock.sendFile(m.chat, file, path.basename(file), caption, m);
        await spotify.cleanup(res.directory);
        await status.success();
        return;
      }
      let targetQuery = query;
      if (!isUrl && !isSpecialFeed) {
        targetQuery = `ytsearch1:${query}`;
      }
      await status.processing();
      const downloader = global.scraper.ytdpl;
      if (!downloader) throw new Error("Downloader not available");
      const metaOpts = { cookies: cookiePath };
      if (_udl && _parsedOpts && typeof _parsedOpts === "object") Object.assign(metaOpts, _udl.normalizeOpts(_parsedOpts));
      const metadata = await downloader.getMetadata(targetQuery, metaOpts);
      if (!metadata) throw new Error("Failed to get video metadata");
      let info = metadata;
      if (Array.isArray(metadata)) {
        if (metadata.length === 0) throw new Error("No results found.");
        info = metadata[0];
      }
      if (!info || !info.id) throw new Error("Invalid video data received");
      const realUrl = info.webpage_url || info.url || info.original_url;
      if (!realUrl) throw new Error("Could not resolve video URL.");
      const source = isSpotify ? "Spotify" : isUrl ? "URL" : "YouTube";
      const payload = {
        title: info.title || "Unknown",
        uploader: info.uploader || info.channel || "Unknown",
        duration: info.duration || 0,
        views: info.view_count || 0
      };
      const dot = global.settings.dot || "•";
      const type = isAudio ? "Audio" : "Video";
      const caption = `*${source} ${type} Download*\n${dot} Title: ${payload.title}\n${dot} Author: ${payload.uploader}\n${dot} Duration: ${Math.floor(payload.duration)}s\n${dot} Views: ${payload.views.toLocaleString()}`;
      const downloadOptions = {
        cookies: cookiePath
      };
      if (isAudio) downloadOptions.audioOnly = true;

      if (_udl && _parsedOpts && typeof _parsedOpts === "object") {
        const norm = _udl.normalizeOpts(_parsedOpts);

        Object.assign(downloadOptions, norm);
        if (isAudio) downloadOptions.audioOnly = true;
      }
      const result = await downloader.download(realUrl, downloadOptions);
      if (!result || !result.files || result.files.length === 0) {
        throw new Error(`Failed to download YouTube ${type.toLowerCase()}.`);
      }
      const file = result.files[0];
      const stat = await fs.stat(file);
      const maxSize = (global.settings.max_uploud || 50) * 1024 * 1024;
      if (stat.size > maxSize) {
        await downloader.cleanup(result.directory);
        throw new Error("File size exceeds the maximum limit.");
      }
      await sock.sendFile(m.chat, file, path.basename(file), caption, m);
      await downloader.cleanup(result.directory);
      await status.success();
    } catch (e) {
      await status.failed(e);
    }
  },
  example: "%cmd https://www.youtube.com/watch?v=example\n%cmd https://open.spotify.com/track/example\n%cmd play <query>\n%cmd <url> --audio\n%cmd <query> --mp3\n%cmd <url> --audio-format mp3 --embed-thumbnail --write-subs --sub-langs en\n%cmd <url> --format \"bv*+ba/b\" --download-sections \"*0:30-1:00\" --extractor-args \"youtube:player_client=android\""
};

const {define: define} = require("../../../plugin");

module.exports = define({
  name: [ "youtube", "ytdl", "yt", "play", "ytsearch", "ytmusic" ],
  category: "downloader",
  help: [ "youtube", "ytdl", "yt", "play", "ytsearch", "ytmusic" ][0] || "",
  reg: true,
  example: "%cmd https://www.youtube.com/watch?v=example\n%cmd https://open.spotify.com/track/example\n%cmd play <query>\n%cmd <url> --audio\n%cmd <query> --mp3\n%cmd <url> --audio-format mp3 --embed-thumbnail --write-subs --sub-langs en\n%cmd <url> --format \"bv*+ba/b\" --download-sections \"*0:30-1:00\" --extractor-args \"youtube:player_client=android\"",
  run: async function(c) {
    return __orig.run.call(__orig, c.m, c.props);
  }
});