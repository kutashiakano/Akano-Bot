const axios = require("axios");
const fs = require("fs/promises");
const path = require("path");

const BASE_URL = "https://spotidown.app";

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const SEARCH_CACHE_TTL = 3e4;

function isSpotifyUrl(url) {
  return /open\.spotify\.com\/(track|album|playlist)|spotify\.link\//i.test(String(url || ""));
}

function parseSeconds(value) {
  if (typeof value === "number") return value;
  const s = String(value || "").trim();
  if (!s) return 0;
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  const parts = s.split(":").map(p => parseInt(p, 10) || 0);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

function decodeMetadata(data) {
  try {
    return JSON.parse(Buffer.from(data, "base64").toString("utf8"));
  } catch (e) {
    return {};
  }
}

class SpotifyScraper {
  constructor(config = {}) {
    this.baseDir = config.baseDir || path.join(__dirname, "../../../tmp");
    this.session = null;
    this.sessionAt = 0;
    this.searchCache = new Map;
    this.pending = new Map;
  }
  async getSession(force = false) {
    if (!force && this.session && Date.now() - this.sessionAt < 5 * 60 * 1e3) {
      return this.session;
    }
    const response = await axios.get(`${BASE_URL}/en3`, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9"
      },
      timeout: 3e4
    });
    const cookies = response.headers["set-cookie"] || [];
    if (!cookies.length) {
      throw new Error("spotidown.app did not send session cookies");
    }
    const sessionCookie = cookies.map(c => c.split(";")[0]).join("; ");
    const cheerio = require("cheerio");
    const $ = cheerio.load(response.data);
    const form = $('form[name="spotifyurl"]');
    if (!form.length) {
      throw new Error("spotidown.app form not found (page structure changed)");
    }
    let dynamicName = "";
    let dynamicValue = "";
    form.find('input[type="hidden"]').each((i, elem) => {
      const name = $(elem).attr("name");
      const val = $(elem).attr("value");
      if (name && name !== "g-recaptcha-response") {
        dynamicName = name;
        dynamicValue = val;
      }
    });
    this.session = {
      sessionCookie: sessionCookie,
      dynamicName: dynamicName,
      dynamicValue: dynamicValue
    };
    this.sessionAt = Date.now();
    return this.session;
  }
  _headers(cookie) {
    return {
      "User-Agent": USER_AGENT,
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Origin: BASE_URL,
      Referer: `${BASE_URL}/en3`,
      "X-Requested-With": "XMLHttpRequest",
      Cookie: cookie
    };
  }
  async _resolve(queryOrUrl) {
    const {sessionCookie: sessionCookie, dynamicName: dynamicName, dynamicValue: dynamicValue} = await this.getSession();
    const payload = {
      url: queryOrUrl,
      "g-recaptcha-response": ""
    };
    if (dynamicName) payload[dynamicName] = dynamicValue;
    const response = await axios.post(`${BASE_URL}/action`, new URLSearchParams(payload).toString(), {
      headers: this._headers(sessionCookie),
      timeout: 6e4
    });
    if (response.data.error) {
      throw new Error(response.data.message || "spotidown.app lookup failed");
    }
    const cheerio = require("cheerio");
    const $ = cheerio.load(response.data.data || "");
    const tracks = [];
    $('form[name="submitspurl"]').each((i, formElem) => {
      const form = $(formElem);
      const data = form.find('input[name="data"]').val();
      const base = form.find('input[name="base"]').val();
      const token = form.find('input[name="token"]').val();
      if (data && base && token) {
        tracks.push({
          metadata: decodeMetadata(data),
          form: {
            data: data,
            base: base,
            token: token
          }
        });
      }
    });
    return {
      tracks: tracks,
      sessionCookie: sessionCookie
    };
  }
  async _getLinks(form, sessionCookie) {
    const response = await axios.post(`${BASE_URL}/action/track`, new URLSearchParams(form).toString(), {
      headers: this._headers(sessionCookie),
      timeout: 6e4
    });
    if (response.data.error) {
      throw new Error(response.data.message || "spotidown.app failed to get download links");
    }
    const cheerio = require("cheerio");
    const $ = cheerio.load(response.data.data || "");
    const links = {
      mp3: null,
      cover: null
    };
    $("a").each((i, elem) => {
      const href = $(elem).attr("href");
      if (!href) return;
      const txt = $(elem).text().trim().replace(/\s+/g, " ").toLowerCase();
      if (txt.includes("download mp3")) {
        links.mp3 = href.startsWith("http") ? href : new URL(href, BASE_URL).href;
      } else if (txt.includes("download cover")) {
        links.cover = href.startsWith("http") ? href : new URL(href, BASE_URL).href;
      }
    });
    return links;
  }
  toTrack(metadata, fallbackUrl) {
    const trackId = metadata.tid || "";
    return {
      id: trackId || "spotify_" + Date.now(),
      title: metadata.name || "Unknown",
      url: trackId ? `https://open.spotify.com/track/${trackId}` : fallbackUrl,
      webpage_url: trackId ? `https://open.spotify.com/track/${trackId}` : fallbackUrl,
      thumbnail: metadata.cover || "",
      cover: metadata.cover || "",
      duration: parseSeconds(metadata.duration),
      durationLabel: metadata.duration || "",
      uploader: metadata.artist || "Unknown",
      channel: metadata.artist || "Unknown",
      album: metadata.album || "",
      year: metadata.year || null,
      platform: "spotify"
    };
  }
  async search(query, limit = 10) {
    const normalized = String(query || "").trim();
    if (!normalized) return [];
    const cacheKey = normalized.toLowerCase();
    const cached = this.searchCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.result.slice(0, limit);
    }
    if (this.pending.has(cacheKey)) {
      return (await this.pending.get(cacheKey)).slice(0, limit);
    }
    const promise = (async () => {
      try {
        const {tracks: tracks} = await this._resolve(normalized);
        const results = tracks.map(t => this.toTrack(t.metadata, null)).filter(t => t.id);
        this.searchCache.set(cacheKey, {
          result: results,
          expiresAt: Date.now() + SEARCH_CACHE_TTL
        });
        return results;
      } catch (e) {
        this.searchCache.delete(cacheKey);
        throw e;
      } finally {
        this.pending.delete(cacheKey);
      }
    })();
    this.pending.set(cacheKey, promise);
    return (await promise).slice(0, limit);
  }
  async getTrack(url) {
    const {tracks: tracks} = await this._resolve(url);
    if (!tracks.length) {
      throw new Error("Track not found on Spotify");
    }
    return this.toTrack(tracks[0].metadata, url);
  }
  async getPlaylist(url) {
    const {tracks: tracks} = await this._resolve(url);
    if (!tracks.length) {
      throw new Error("No tracks found for this Spotify link");
    }
    return tracks.map(t => this.toTrack(t.metadata, url));
  }
  async getLinks(url) {
    const {tracks: tracks, sessionCookie: sessionCookie} = await this._resolve(url);
    if (!tracks.length) {
      throw new Error("Track not found on Spotify");
    }
    const links = await this._getLinks(tracks[0].form, sessionCookie);
    return {
      metadata: this.toTrack(tracks[0].metadata, url),
      links: links
    };
  }
  async download(url, options = {}) {
    const outputDir = options.outputDir || path.join(this.baseDir, `spdl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    await fs.mkdir(outputDir, {
      recursive: true
    });
    const {tracks: tracks, sessionCookie: sessionCookie} = await this._resolve(url);
    if (!tracks.length) {
      throw new Error("Track not found on Spotify");
    }
    const track = tracks[0];
    const links = await this._getLinks(track.form, sessionCookie);
    if (!links.mp3) {
      throw new Error("Spotify download link not found");
    }
    const meta = track.metadata || {};
    const safeTitle = String(meta.name || "Spotify").replace(/[\\/:*?"<>|]/g, "_");
    const filePath = path.join(outputDir, `${safeTitle}.mp3`);
    const response = await axios.get(links.mp3, {
      responseType: "arraybuffer",
      headers: {
        "User-Agent": USER_AGENT
      },
      timeout: 12e4
    });
    await fs.writeFile(filePath, Buffer.from(response.data));
    return {
      directory: outputDir,
      files: [ filePath ],
      metadata: this.toTrack(meta, url)
    };
  }
  async cleanup(directory) {
    if (!directory) return;
    try {
      await fs.rm(directory, {
        recursive: true,
        force: true
      });
    } catch (e) {}
  }
}

module.exports = new SpotifyScraper;