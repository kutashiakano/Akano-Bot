const { spawn } = require("child_process");
const fs = require("fs/promises");
const fsSync = require("fs");
const path = require("path");
const crypto = require("crypto");

const AUDIO_CACHE_DIR = path.join(__dirname, "../../../tmp/audio_cache");

class MediaDownloader {
  constructor(config = {}) {
    this.ytDlpBin = config.ytDlpBin || "yt-dlp";
    this.galleryDlBin = config.galleryDlBin || "gallery-dl";
    this.baseDir = config.baseDir || path.join(__dirname, "../../../tmp");
    this._initialized = false;
    this._cacheDir = AUDIO_CACHE_DIR;
  }

  async ensureDeps() {
    if (this._initialized) return;
    const checkBin = (bin) =>
      new Promise((resolve) => {
        const env = { ...process.env };
        if (process.platform === "linux" && env.HOME) {
          const localBin = path.join(env.HOME, ".local", "bin");
          env.PATH = `${localBin}:${env.PATH}`;
        }
        const proc = spawn(bin, ["--version"], { env, shell: false, stdio: "ignore" });
        proc.on("error", () => resolve(false));
        proc.on("close", (code) => resolve(code === 0));
      });

    const ytdlpExists = await checkBin(this.ytDlpBin);
    const galleryDlExists = await checkBin(this.galleryDlBin);

    if (!ytdlpExists || !galleryDlExists) {
      const pipCmd = process.platform === "win32" ? "pip" : "pip3";
      const args = ["install", "--break-system-packages", "-U", "yt-dlp", "gallery-dl", "yt-dlp-ejs"];
      try {
        await this._execute(pipCmd, args, process.cwd());
      } catch {}
      try {
        await this._execute("pip", args, process.cwd());
      } catch {}
    }

    if (!fsSync.existsSync(this._cacheDir)) {
      fsSync.mkdirSync(this._cacheDir, { recursive: true });
    }

    this._initialized = true;
  }

  async _ensureDir(dir) {
    await fs.mkdir(dir, { recursive: true });
  }

  async _fetchWithRetry(url, options = {}, retries = 3) {
    const fetch = (await import("node-fetch")).default;
    let lastErr;
    for (let attempt = 1; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timeoutMs = options.timeout || 30000;
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        return res;
      } catch (e) {
        lastErr = e;
        if (attempt < retries) {
          const delay = 1500 * attempt;
          console.log(`[fetch] retry ${attempt}/${retries} in ${delay}ms — ${e.message}`);
          await new Promise((r) => setTimeout(r, delay));
        }
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastErr;
  }

  async _fetchBuf(url, headers = {}, retries = 3) {
    let lastErr;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const res = await this._fetchWithRetry(url, { headers }, 1);
        if (!res.ok) {
          lastErr = new Error(`HTTP ${res.status} from ${url}`);
        } else {
          return await res.buffer();
        }
      } catch (e) {
        lastErr = e;
      }
      if (attempt < retries) {
        const delay = 2000 * attempt;
        console.log(`[download] retry ${attempt}/${retries} in ${delay}ms — ${lastErr.message}`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw lastErr;
  }

  _isGalleryUrl(url) {
    const pinterestRegex = /pinterest\.[a-z.]+\/pin\//i;
    const tiktokSlideRegex = /tiktok\.com.*\/photo\//i;
    return pinterestRegex.test(url) || tiktokSlideRegex.test(url);
  }

  _isSpotifyUrl(url) {
    return /open\.spotify\.com\/(track|album|playlist)/i.test(url) || /spotify\.link\//i.test(url);
  }

  isSCUrl(url) {
    return /soundcloud\.com/i.test(url);
  }

  isDlUrl(url) {
    return /^https?:\/\/.+\.(mp3|wav|ogg|flac|m4a|aac|opus)(\?|$)/i.test(url);
  }

  _getCachePath(url) {
    const hash = crypto.createHash("md5").update(url).digest("hex");
    return path.join(this._cacheDir, `track_${hash}.opus`);
  }

  async getCachedFile(url) {
    const cachePath = this._getCachePath(url);
    if (fsSync.existsSync(cachePath)) {
      const stats = await fs.stat(cachePath);
      if (stats.size > 0) return cachePath;
    }
    return null;
  }

  async cacheFile(url, sourcePath) {
    try {
      const cachePath = this._getCachePath(url);
      await fs.copyFile(sourcePath, cachePath);
      return cachePath;
    } catch (e) {
      return null;
    }
  }

  async _execute(bin, args, cwd) {
    try {
      const { code, stdout, stderr } = await require("../../core/heavy").heavyExec(bin, args, cwd);
      if (code === 0) return { stdout, stderr };
      if (stderr && stderr.includes("[DRM]")) {
        throw new Error("This content is protected by DRM and cannot be downloaded.");
      }
      throw new Error(stderr || `Process exited with code ${code}`);
    } catch (e) {
      if (e && /worker|worker_threads|ERR_WORKER/i.test(String(e.message))) {
        return this._executeInline(bin, args, cwd);
      }
      throw e;
    }
  }

  _executeInline(bin, args, cwd) {
    return new Promise((resolve, reject) => {
      const env = { ...process.env };
      if (process.platform === "linux" && env.HOME) {
        const localBin = path.join(env.HOME, ".local", "bin");
        env.PATH = `${localBin}:${env.PATH}`;
      }
      const proc = spawn(bin, args, { cwd, env, shell: false });
      let stdout = "";
      let stderr = "";
      proc.stdout.on("data", (data) => {
        stdout += data.toString();
      });
      proc.stderr.on("data", (data) => {
        stderr += data.toString();
      });
      proc.on("error", reject);
      proc.on("close", (code) => {
        if (code === 0) resolve({ stdout, stderr });
        else {
          if (stderr && stderr.includes("[DRM]")) {
            reject(new Error("This content is protected by DRM and cannot be downloaded."));
          } else {
            reject(new Error(stderr || `Process exited with code ${code}`));
          }
        }
      });
    });
  }

  async ttNative(url) {
    try {
      const apiUrl = `https://tikwm.com/api/?url=${encodeURIComponent(url)}`;
      const res = await this._fetchWithRetry(apiUrl, { timeout: 30000 });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data || data.code !== 0 || !data.data) return null;

      if (data.data.images && data.data.images.length > 0) {
        return {
          type: "carousel",
          images: data.data.images,
          description: data.data.title || "",
          author: data.data.author?.nickname || "Unknown",
          webpage_url: url,
        };
      }

      if (data.data.play) {
        return {
          type: "video",
          url: data.data.play,
          description: data.data.title || "",
          author: data.data.author?.nickname || "Unknown",
          webpage_url: url,
        };
      }

      return null;
    } catch (e) {
      console.error("[TikTok Native] Error:", e.message);
      return null;
    }
  }

  async search(query, options = {}) {
    await this.ensureDeps();
    const limit = options.limit || 1;
    const q = `ytsearch${limit}:${query}`;
    const args = [
      "-j",
      "--no-warnings",
      "--skip-download",
      "--js-runtimes",
      "node",
      "--remote-components",
      "ejs:github",
    ];

    if (options.cookies) args.push("--cookies", options.cookies);
    if (options.cookiesFromBrowser) args.push("--cookies-from-browser", options.cookiesFromBrowser);
    args.push(q);

    const { stdout } = await this._execute(this.ytDlpBin, args, this.baseDir);
    const lines = stdout.split("\n").filter((l) => l.trim());
    const results = [];

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.id) {
          results.push({
            id: parsed.id,
            title: parsed.title || "Unknown",
            url: parsed.webpage_url || parsed.url || `https://www.youtube.com/watch?v=${parsed.id}`,
            thumbnail:
              parsed.thumbnail || parsed.thumbnails?.[parsed.thumbnails.length - 1]?.url || "",
            duration: parsed.duration || 0,
            uploader: parsed.uploader || parsed.channel || "Unknown",
            platform: "youtube",
          });
        }
      } catch {}
    }

    return results;
  }

  async getMetadata(url, options = {}) {
    await this.ensureDeps();

    const isInstagram = /instagram.com/i.test(url);
    const isTiktokPhoto = /tiktok\.com.*\/photo\//i.test(url);
    const isTiktok = /tiktok.com|vt.tiktok.com/i.test(url);
    const isGallery = this._isGalleryUrl(url);
    const isSpotify = this._isSpotifyUrl(url);
    const isSoundCloud = this.isSCUrl(url);
    const isDirect = this.isDlUrl(url);
    const isYoutubeSingle = /(?:youtube.com\/(?:watch\?v=|shorts\/)|youtu.be\/)/i.test(url);
    const isYoutube =
      /youtube|youtu.be|^:(ytfav|ythis|ytrec|ytnotif|ytsubs|ytwatchlater)$/i.test(url) ||
      url.startsWith("ytsearch") ||
      url.startsWith("ytuser");

    if (isSoundCloud) {
      return this._scMeta(url, options);
    }

    if (isDirect) {
      return [
        {
          id: "direct_" + Date.now(),
          webpage_url: url,
          url: url,
          title: path.basename(new URL(url).pathname) || "Direct Audio",
          uploader: "Direct Link",
          duration: 0,
          platform: "direct",
        },
      ];
    }

    let bin, args;
    if (isTiktokPhoto || isGallery || isInstagram) {
      bin = this.galleryDlBin;
      args = ["-j"];
    } else if (isSpotify) {
      bin = this.ytDlpBin;
      args = ["-j", "--no-warnings", "--skip-download"];
    } else if (isTiktok && !isTiktokPhoto) {
      bin = this.ytDlpBin;
      args = [
        "-j",
        "--no-warnings",
        "--skip-download",
        "--no-check-certificates",
        "--user-agent",
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
        "--extractor-args",
        "tiktok:api_hostname=api-h2.tiktokweb",
        "--js-runtimes",
        "node",
      ];
    } else {
      bin = this.ytDlpBin;
      args = [
        "-j",
        "--no-warnings",
        "--skip-download",
        "--js-runtimes",
        "node",
        "--remote-components",
        "ejs:github",
        "--retries",
        "3",
        "--extractor-args",
        "youtube:player_client=web_embedded,default,android,ios,tv",
      ];
      if (isYoutube && !isYoutubeSingle) {
        args.push("--playlist-items", "1");
      }
    }

    if (options.cookies) args.push("--cookies", options.cookies);
    if (options.cookiesFromBrowser) args.push("--cookies-from-browser", options.cookiesFromBrowser);
    args.push(url);

    let stdout, stderr;
    try {
      const result = await this._execute(bin, args, this.baseDir);
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (err) {
      if (isTiktok && bin === this.ytDlpBin) {
        console.log("[TikTok] yt-dlp failed, trying Node.js fallback...");
        if (typeof this.ttNative !== "function") {
          throw new Error("TikTok fallback not available: ttNative is not a function");
        }
        const fallback = await this.ttNative(url);
        if (fallback) {
          if (fallback.type === "carousel" && fallback.images && fallback.images.length > 0) {
            return fallback.images.map((img, i) => ({
              id: `tiktok_slide_${i}`,
              webpage_url: fallback.webpage_url || url,
              url: img,
              title: fallback.description || "TikTok Slide",
              uploader: fallback.author || "Unknown",
              description: fallback.description || "",
              _type: "photo",
              _fallback: true,
            }));
          }
          if (fallback.url) {
            return [
              {
                id: "tiktok_fallback",
                webpage_url: fallback.webpage_url || url,
                url: fallback.url,
                title: fallback.description || "TikTok Video",
                uploader: fallback.author || "Unknown",
                description: fallback.description || "",
                _type: "video",
                _fallback: true,
              },
            ];
          }
        }
        throw new Error(`TikTok metadata failed: ${err.message.substring(0, 100)}`);
      } else {
        throw err;
      }
    }

    if (bin === this.galleryDlBin || isGallery) {
      const raw = stdout || stderr;
      try {
        const parsed = JSON.parse(raw.trim());
        const items = Array.isArray(parsed) ? parsed : [parsed];
        return items.map((item) => ({
          id: item.id || item.post_id || item._filename || `gallery_${Date.now()}`,
          webpage_url: item.url || item.webpage_url || url,
          url: item.url || item._filename || "",
          title: item.description || item.title || item.text || "Gallery Media",
          uploader: item.uploader || item.author || item.creator || item.owner || "Unknown",
          description: item.description || item.text || item.caption || "",
          _type: item._type || "photo",
          _gallery: true,
        }));
      } catch {
        try {
          const lines = raw.split("\n").filter((l) => l.trim());
          const entries = [];
          for (const line of lines) {
            try {
              const item = JSON.parse(line);
              entries.push({
                id: item.id || item.post_id || `gallery_${entries.length}`,
                webpage_url: item.url || url,
                url: item.url || "",
                title: item.description || item.title || "Gallery Media",
                uploader: item.uploader || item.author || "Unknown",
                description: item.description || item.text || "",
                _type: item._type || "photo",
                _gallery: true,
              });
            } catch {}
          }
          if (entries.length > 0) return entries;
        } catch {}
      }
      throw new Error("Metadata not valid.");
    }

    try {
      const parsed = JSON.parse(stdout.trim());
      if (!parsed) throw new Error("Empty response from yt-dlp");
      if (parsed._type === "playlist" && Array.isArray(parsed.entries)) return parsed.entries;
      if (parsed.id) return parsed;
      if (Array.isArray(parsed)) return parsed.length > 0 ? parsed : [parsed];
      return [parsed];
    } catch (error) {
      const lines = stdout.split("\n").filter((l) => l.trim());
      const entries = [];
      for (const line of lines) {
        try {
          const p = JSON.parse(line);
          if (p.id) entries.push(p);
        } catch {}
      }
      if (entries.length > 0) return entries;
      throw new Error(`Failed to get video metadata: ${error.message}`);
    }
  }

  async _scMeta(url, options = {}) {
    const args = [
      "-j",
      "--no-warnings",
      "--skip-download",
      "--js-runtimes",
      "node",
      "--remote-components",
      "ejs:github",
    ];
    if (options.cookies) args.push("--cookies", options.cookies);
    if (options.cookiesFromBrowser) args.push("--cookies-from-browser", options.cookiesFromBrowser);
    args.push(url);

    try {
      const { stdout } = await this._execute(this.ytDlpBin, args, this.baseDir);
      const parsed = JSON.parse(stdout.trim());
      return [
        {
          id: parsed.id || "sc_" + Date.now(),
          webpage_url: parsed.webpage_url || url,
          url: parsed.url || url,
          title: parsed.title || "Unknown",
          thumbnail: parsed.thumbnail || parsed.artwork_url || "",
          duration: parsed.duration || 0,
          uploader: parsed.uploader || parsed.artist || "Unknown",
          platform: "soundcloud",
        },
      ];
    } catch (e) {
      const slugQuery = String(url)
        .replace(/^https?:\/\/([^/]+\.)?soundcloud\.com\//i, "")
        .replace(/[/?#].*$/, "")
        .replace(/[-_]+/g, " ")
        .trim();
      if (slugQuery) {
        try {
          const { stdout } = await this._execute(
            this.ytDlpBin,
            [
              "-j",
              "--no-warnings",
              "--skip-download",
              "--js-runtimes",
              "node",
              "--remote-components",
              "ejs:github",
              `scsearch1:${slugQuery}`,
            ],
            this.baseDir,
          );
          const parsed = JSON.parse(stdout.trim());
          return [
            {
              id: parsed.id || "sc_" + Date.now(),
              webpage_url: parsed.webpage_url || url,
              url: parsed.url || url,
              title: parsed.title || "Unknown",
              thumbnail: parsed.thumbnail || parsed.artwork_url || "",
              duration: parsed.duration || 0,
              uploader: parsed.uploader || parsed.artist || "Unknown",
              platform: "soundcloud",
            },
          ];
        } catch (e2) {}
      }
      throw new Error(`SoundCloud metadata failed: ${e.message}`);
    }
  }

  async searchTracks(query, limit = 20) {
    await this.ensureDeps();
    const searchQuery = String(query || "").startsWith("ytsearch")
      ? String(query)
      : `ytsearch${Math.min(limit, 30)}:${query}`;
    const args = [
      "--flat-playlist",
      "--dump-single-json",
      "--no-warnings",
      "--skip-download",
      "--js-runtimes",
      "node",
      "--remote-components",
      "ejs:github",
      searchQuery,
    ];
    try {
      const { stdout } = await this._execute(this.ytDlpBin, args, this.baseDir);
      const parsed = JSON.parse(stdout.trim());
      const entries =
        parsed && Array.isArray(parsed.entries) ? parsed.entries : parsed ? [parsed] : [];
      return entries
        .filter((e) => e && e.id)
        .slice(0, limit)
        .map((e) => ({
          id: e.id,
          title: e.title || "Unknown",
          url: e.webpage_url || (e.id ? `https://www.youtube.com/watch?v=${e.id}` : ""),
          webpage_url: e.webpage_url || (e.id ? `https://www.youtube.com/watch?v=${e.id}` : ""),
          thumbnail: e.thumbnail || "",
          duration: e.duration || 0,
          uploader: e.uploader || e.channel || "Unknown",
          channel: e.uploader || e.channel || "Unknown",
          platform: "youtube",
        }));
    } catch (e) {
      process.stderr.write("[ytdpl] searchTracks error: " + e.message + "\n");
      return [];
    }
  }

  async download(url, options = {}) {
    await this.ensureDeps();

    const isGallery = this._isGalleryUrl(url);
    const isTiktok = /tiktok.com|vt.tiktok.com/i.test(url);
    const isTiktokPhoto = /tiktok\.com.*\/photo\//i.test(url);
    const isInstagram = /instagram.com/i.test(url);
    const isSpotify = this._isSpotifyUrl(url);
    const isSoundCloud = this.isSCUrl(url);
    const isDirect = this.isDlUrl(url);
    let bin = isGallery || isTiktokPhoto || isInstagram ? this.galleryDlBin : this.ytDlpBin;

    if (isTiktokPhoto || isInstagram) {
      bin = this.galleryDlBin;
    }

    if (isDirect) {
      try {
        const outputDir =
          options.outputDir ||
          path.join(this.baseDir, `dl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
        await this._ensureDir(outputDir);
        const buffer = await this._fetchBuf(url, { "User-Agent": "Mozilla/5.0" });
        const ext = path.extname(new URL(url).pathname) || ".mp3";
        const filePath = path.join(outputDir, `direct_audio${ext}`);
        require("fs").writeFileSync(filePath, buffer);
        return { directory: outputDir, files: [filePath] };
      } catch (e) {
        throw new Error(`Direct download failed: ${e.message}`);
      }
    }

    const outputDir =
      options.outputDir ||
      path.join(this.baseDir, `dl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    await this._ensureDir(outputDir);

    const buildArgs = (targetBin) => {
      const args = [];
      if (options.cookies) args.push("--cookies", options.cookies);
      if (options.cookiesFromBrowser)
        args.push("--cookies-from-browser", options.cookiesFromBrowser);
      if (options.audioFilter && options.audioFilter !== "none") {
        const { AUDIO_FILTERS } = require("../../bot/discord/plugins/music/utils");
        const f = AUDIO_FILTERS[options.audioFilter];
        if (f && f.args) args.push("--postprocessor-args", `ffmpeg:${f.args}`);
      }
      if (targetBin === this.galleryDlBin) {
        args.push("--directory", outputDir, "--quiet");
        if (options.filenameFormat) args.push("-f", options.filenameFormat);
        if (options.limitRate) args.push("-r", options.limitRate);
        if (options.maxFilesize) args.push("--filesize-max", options.maxFilesize);
        if (options.sleepRequest) args.push("--sleep-request", options.sleepRequest.toString());
        if (options.writeInfoJson) args.push("--write-info-json");
      } else {
        const format = options.format || "bv*+ba/b";
        args.push("-f", format);
        args.push("-o", path.join(outputDir, options.filenameFormat || "%(title).50s.%(ext)s"));
        args.push("--no-playlist");
        args.push("--merge-output-format", "mp4");
        args.push("--js-runtimes", "node", "--remote-components", "ejs:github");
        args.push("--retries", "3");
        args.push("--force-ipv4");
        args.push("--extractor-args", "youtube:player_client=web_embedded,default,android,ios,tv");
        if (isInstagram) args.push("--ignore-no-formats-error");
        if (options.limitRate) args.push("--limit-rate", options.limitRate);
        if (options.maxFilesize) args.push("--max-filesize", options.maxFilesize);
        if (options.sleepRequest) args.push("--sleep-requests", options.sleepRequest.toString());
        if (options.writeInfoJson) args.push("--write-info-json");
        if (options.audioOnly) args.push("-x", "--audio-format", options.audioFormat || "mp3");
      }
      args.push(url);
      return args;
    };

    let args = buildArgs(bin);
    try {
      await this._execute(bin, args, this.baseDir);
    } catch (err) {
      if (isTiktok && bin === this.ytDlpBin) {
        console.log("[TikTok] yt-dlp download failed, trying Node.js fallback...");
        if (typeof this.ttNative !== "function") {
          throw new Error("TikTok fallback not available: ttNative is not a function");
        }
        const fallback = await this.ttNative(url);
        if (fallback) {
          if (fallback.type === "carousel" && fallback.images && fallback.images.length > 0) {
            const filePaths = [];
            for (let i = 0; i < fallback.images.length; i++) {
              const buffer = await this._fetchBuf(fallback.images[i], {
                "User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36",
              });
              const isPng =
                buffer &&
                buffer.length > 8 &&
                buffer[1] === 0x50 &&
                buffer[2] === 0x4e &&
                buffer[3] === 0x47;
              const ext = isPng ? ".png" : ".jpg";
              const filePath = path.join(outputDir, `tiktok_slide_${i}${ext}`);
              require("fs").writeFileSync(filePath, buffer);
              filePaths.push(filePath);
            }
            return { directory: outputDir, files: filePaths };
          }
          if (fallback.url) {
            const buffer = await this._fetchBuf(fallback.url, {
              "User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36",
            });
            const filePath = path.join(outputDir, "tiktok_video.mp4");
            require("fs").writeFileSync(filePath, buffer);
            return { directory: outputDir, files: [filePath] };
          }
        }
        throw new Error(`TikTok download failed: ${err.message.substring(0, 100)}`);
      } else if (isInstagram && err.message.includes("No video formats found")) {
        const files = await this._readDir(outputDir);
        if (files.length > 0) return { directory: outputDir, files };
        throw new Error(
          "Instagram carousel contains only images without downloadable video formats.",
        );
      } else if (isSpotify && bin === this.ytDlpBin) {
        throw new Error(`Spotify download failed: ${err.message}`);
      } else {
        throw err;
      }
    }

    const files = await this._readDir(outputDir);
    return { directory: outputDir, files };
  }

  async _readDir(dir) {
    try {
      const dirents = await fs.readdir(dir, { withFileTypes: true });
      const files = await Promise.all(
        dirents.map(async (dirent) => {
          const res = path.resolve(dir, dirent.name);
          return dirent.isDirectory() ? this._readDir(res) : res;
        }),
      );
      return files.flat();
    } catch {
      return [];
    }
  }

  async cleanup(dir) {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

module.exports = new MediaDownloader();
