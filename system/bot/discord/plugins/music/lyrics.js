const cheerio = require("cheerio");

const lyricsCache = new Map();

function cleanLyricsText(text) {
  if (!text) return null;
  return (
    text
      .replace(/\d+\s+Contributors.*?Lyrics(<[^>]+>)*\s*/is, "")
      .replace(/<[^>]*>/g, "")
      .replace(/^[^\[]+?\.{3}\s*Read More\s*/im, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim() || null
  );
}

async function fetchLyrics(title) {
  const cacheKey = (title || "")
    .toLowerCase()
    .replace(/[()[\]]/g, "")
    .replace(/official.*$/i, "")
    .trim();
  if (lyricsCache.has(cacheKey)) return lyricsCache.get(cacheKey);

  try {
    const fetch = require("node-fetch");
    const query = encodeURIComponent(cacheKey);
    const res = await fetch(`https://lrclib.net/api/search?q=${query}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36" },
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.length > 0) {
        const match = data.find((l) => l.syncedLyrics) || data[0];
        const result = {
          plain: match.plainLyrics || null,
          synced: match.syncedLyrics || null,
          source: "LRCLIB",
        };
        lyricsCache.set(cacheKey, result);
        setTimeout(() => lyricsCache.delete(cacheKey), 3600000);
        return result;
      }
    }
  } catch (e) {}
  lyricsCache.set(cacheKey, null);
  return null;
}

async function fetchGeniusLyrics(title) {
  const cacheKey = "genius_" + (title || "").toLowerCase().trim();
  if (lyricsCache.has(cacheKey)) return lyricsCache.get(cacheKey);

  try {
    const fetch = require("node-fetch");
    const cleanTitle = title
      .replace(/\(.*?\)/g, "")
      .replace(/\[.*?\]/g, "")
      .replace(/official.*$/i, "")
      .trim();
    const searchRes = await fetch(
      `https://genius.com/api/search?q=${encodeURIComponent(cleanTitle)}`,
      {
        headers: { "User-Agent": "Mozilla/5.0" },
      },
    );
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    const hit = searchData?.response?.hits?.[0];
    if (!hit) return null;

    const songUrl = hit.result?.url;
    if (!songUrl) return null;

    const pageRes = await fetch(songUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!pageRes.ok) return null;
    const html = await pageRes.text();
    const $ = cheerio.load(html);
    const lyricsDiv = $("[data-lyrics-container='true']");
    if (!lyricsDiv.length) return null;

    let lyrics = "";
    lyricsDiv.each((_, el) => {
      lyrics += $(el).html() + "\n";
    });
    lyrics = lyrics
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]*>/g, "")
      .trim();
    lyrics = cleanLyricsText(lyrics);

    if (lyrics) {
      const result = { plain: lyrics, synced: null, source: "Genius" };
      lyricsCache.set(cacheKey, result);
      setTimeout(() => lyricsCache.delete(cacheKey), 3600000);
      return result;
    }
  } catch (e) {}
  return null;
}

async function lyrAny(title) {
  const genius = await fetchGeniusLyrics(title);
  if (genius?.plain) return genius;
  return await fetchLyrics(title);
}

module.exports = {
  lyricsCache,
  fetchLyrics,
  fetchGeniusLyrics,
  lyrAny,
  cleanLyricsText,
};
