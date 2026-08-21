const https = require("https");

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function fetch(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": USER_AGENT, ...headers } }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () =>
        resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString("utf8") }),
      );
    });
    req.on("error", reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });
  });
}

function stripHtml(text) {
  return String(text || "")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function geniusSearch(query) {
  const res = await fetch(
    `https://genius.com/api/search/multi?per_page=5&q=${encodeURIComponent(query)}`,
  );
  if (res.status !== 200) return [];
  let json;
  try {
    json = JSON.parse(res.body);
  } catch (e) {
    return [];
  }
  const section = (json?.response?.sections || []).find((s) => s.type === "song");
  const hits = section?.hits || [];
  return hits
    .map((h) => {
      const r = h?.result;
      if (!r || !r.id) return null;
      const primary = r.primary_artist?.name || r.artist_names || "Unknown";
      return {
        id: r.id,
        title: r.title || "Unknown",
        artist: primary,
        url: r.url || "",
        thumbnail: (r.header_image_thumbnail_url || r.song_art_image_thumbnail_url || "").replace(
          "1000x1000x1",
          "316x316x1",
        ),
        fullTitle: r.full_title || `${primary} - ${r.title || ""}`,
      };
    })
    .filter(Boolean);
}

async function geniusLyrics(songUrl) {
  if (!songUrl) return null;
  const res = await fetch(songUrl);
  if (res.status !== 200) return null;
  const cheerio = require("cheerio"); const $ = cheerio.load(res.body);
  const containers = $('[data-lyrics-container="true"]');
  let text;
  if (containers.length) {
    text = containers
      .map((i, el) => $(el).html())
      .get()
      .join("\n");
    text = text.replace(/<br\s*\/?>/gi, "\n").replace(/\u00a0/g, " ");
  } else {
    text = stripHtml(
      res.body.match(/<div[^>]*class="[^"]*lyrics[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] || "",
    );
  }
  if (!text) return null;
  const decoded = decodeEntities(text);
  return decoded.trim();
}

function decodeEntities(text) {
  return String(text || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));
}

async function lrclibLyrics(query, artist) {
  try {
    if (artist) {
      const res = await fetch(
        `https://lrclib.net/api/get?track_name=${encodeURIComponent(query)}&artist_name=${encodeURIComponent(
          artist,
        )}`,
        { Accept: "application/json" },
      );
      if (res.status === 200) {
        try {
          const j = JSON.parse(res.body);
          if (j.plainLyrics) return j.plainLyrics;
        } catch (e) {}
      }
    }
    const res = await fetch(
      `https://lrclib.net/api/search?q=${encodeURIComponent(
        artist ? `${query} ${artist}` : query,
      )}`,
      { Accept: "application/json" },
    );
    if (res.status !== 200) return null;
    const list = JSON.parse(res.body);
    const hit = (list || []).find((t) => t.plainLyrics && !t.instrumental);
    return hit ? hit.plainLyrics : null;
  } catch (e) {
    return null;
  }
}

async function getLyrics(query) {
  const results = await geniusSearch(query);
  const first = results[0];
  let lyrics = first ? await geniusLyrics(first.url) : null;
  let source = "Genius";
  let match = first || null;
  let artist = first && query ? query.split("-")[0].trim() : first?.artist;

  if (!lyrics) {
    lyrics = await lrclibLyrics(query, first ? first.artist : artist);
    source = "LRCLIB";
  }
  if (!lyrics && match) {
    lyrics = await lrclibLyrics(match.title, match.artist);
    source = "LRCLIB";
  }
  if (!lyrics) return null;

  const clean = normalizeLyrics(lyrics);
  return {
    title: match?.fullTitle || query,
    artist: match?.artist || artist || "Unknown",
    lyrics: clean,
    source,
    thumbnail: match?.thumbnail || "",
    url: match?.url || "",
  };
}

function normalizeLyrics(raw) {
  let lines = String(raw || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim());
  lines = lines.filter((l, i) => {
    if (!l) return true;
    if (/^\d+\s+(Contributors|Translations|Songs)\b/i.test(l)) return false;
    if (i === 0 && /Lyrics$/i.test(l)) return false;
    if (i === 0 && /Lyric$/i.test(l)) return false;
    return true;
  });
  const firstBracket = lines.findIndex((l) => /^\[[^\]]+\]$/.test(l));
  if (firstBracket > 0 && firstBracket < 8) {
    lines = lines.slice(firstBracket);
  }
  const text = lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+|\n+$/g, "");
  return text;
}

module.exports = { getLyrics, geniusSearch, geniusLyrics, lrclibLyrics };
