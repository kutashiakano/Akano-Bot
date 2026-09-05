const { spawn } = require("child_process");
const fs = require("fs/promises");
const fsSync = require("fs");
const path = require("path");
const crypto = require("crypto");

const AUDIO_CACHE_DIR = path.join(__dirname, "../../../tmp/audio_cache");


function toKebab(str) {
  return str.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/_/g, "-").toLowerCase();
}


const OPT_FLAG_MAP = {

  proxy: "--proxy",
  socketTimeout: "--socket-timeout",
  sourceAddress: "--source-address",
  impersonate: "--impersonate",
  listImpersonateTargets: "--list-impersonate-targets",
  forceIpv4: "--force-ipv4",
  forceIpv6: "--force-ipv6",
  enableFileUrls: "--enable-file-urls",

  geoVerificationProxy: "--geo-verification-proxy",
  xff: "--xff",

  playlistItems: "--playlist-items",
  minFilesize: "--min-filesize",
  maxFilesize: "--max-filesize",
  date: "--date",
  dateBefore: "--datebefore",
  dateAfter: "--dateafter",
  ageLimit: "--age-limit",
  downloadArchive: "--download-archive",
  maxDownloads: "--max-downloads",
  breakOnExisting: "--break-on-existing",
  breakPerInput: "--break-per-input",
  noBreakPerInput: "--no-break-per-input",
  skipPlaylistAfterErrors: "--skip-playlist-after-errors",

  concurrentFragments: "--concurrent-fragments",
  limitRate: "--limit-rate",
  throttledRate: "--throttled-rate",
  retries: "--retries",
  fileAccessRetries: "--file-access-retries",
  fragmentRetries: "--fragment-retries",
  retrySleep: "--retry-sleep",
  keepFragments: "--keep-fragments",
  noKeepFragments: "--no-keep-fragments",
  bufferSize: "--buffer-size",
  resizeBuffer: "--resize-buffer",
  noResizeBuffer: "--no-resize-buffer",
  httpChunkSize: "--http-chunk-size",
  playlistRandom: "--playlist-random",
  lazyPlaylist: "--lazy-playlist",
  noLazyPlaylist: "--no-lazy-playlist",
  hlsUseMpegts: "--hls-use-mpegts",
  noHlsUseMpegts: "--no-hls-use-mpegts",
  downloadSections: "--download-sections",
  downloader: "--downloader",
  downloaderArgs: "--downloader-args",

  batchFile: "--batch-file",
  paths: "--paths",
  output: "--output",
  outputNaPlaceholder: "--output-na-placeholder",
  restrictFilenames: "--restrict-filenames",
  noRestrictFilenames: "--no-restrict-filenames",
  windowsFilenames: "--windows-filenames",
  noWindowsFilenames: "--no-windows-filenames",
  trimFilenames: "--trim-filenames",
  noOverwrites: "--no-overwrites",
  forceOverwrites: "--force-overwrites",
  noForceOverwrites: "--no-force-overwrites",
  continue: "--continue",
  noContinue: "--no-continue",
  part: "--part",
  noPart: "--no-part",
  mtime: "--mtime",
  noMtime: "--no-mtime",
  writeDescription: "--write-description",
  noWriteDescription: "--no-write-description",
  writeInfoJson: "--write-info-json",
  noWriteInfoJson: "--no-write-info-json",
  writePlaylistMetafiles: "--write-playlist-metafiles",
  noWritePlaylistMetafiles: "--no-write-playlist-metafiles",
  cleanInfoJson: "--clean-info-json",
  noCleanInfoJson: "--no-clean-info-json",
  writeComments: "--write-comments",
  noWriteComments: "--no-write-comments",
  loadInfoJson: "--load-info-json",
  cacheDir: "--cache-dir",
  noCacheDir: "--no-cache-dir",
  rmCacheDir: "--rm-cache-dir",

  writeThumbnail: "--write-thumbnail",
  noWriteThumbnail: "--no-write-thumbnail",
  writeAllThumbnails: "--write-all-thumbnails",
  listThumbnails: "--list-thumbnails",

  writeLink: "--write-link",
  writeUrlLink: "--write-url-link",
  writeWeblocLink: "--write-webloc-link",
  writeDesktopLink: "--write-desktop-link",

  quiet: "--quiet",
  noQuiet: "--no-quiet",
  noWarnings: "--no-warnings",
  simulate: "--simulate",
  noSimulate: "--no-simulate",
  ignoreNoFormatsError: "--ignore-no-formats-error",
  noIgnoreNoFormatsError: "--no-ignore-no-formats-error",
  skipDownload: "--skip-download",
  forceWriteArchive: "--force-write-archive",
  newline: "--newline",
  noProgress: "--no-progress",
  progress: "--progress",
  consoleTitle: "--console-title",
  progressTemplate: "--progress-template",
  progressDelta: "--progress-delta",
  verbose: "--verbose",
  dumpPages: "--dump-pages",
  writePages: "--write-pages",
  printTraffic: "--print-traffic",

  encoding: "--encoding",
  legacyServerConnect: "--legacy-server-connect",
  noCheckCertificates: "--no-check-certificates",
  preferInsecure: "--prefer-insecure",
  addHeaders: "--add-headers",
  bidiWorkaround: "--bidi-workaround",
  sleepRequests: "--sleep-requests",
  sleepInterval: "--sleep-interval",
  maxSleepInterval: "--max-sleep-interval",
  sleepSubtitles: "--sleep-subtitles",

  format: "--format",
  formatSort: "--format-sort",
  formatSortForce: "--format-sort-force",
  noFormatSortForce: "--no-format-sort-force",
  formatSortReset: "--format-sort-reset",
  videoMultistreams: "--video-multistreams",
  noVideoMultistreams: "--no-video-multistreams",
  audioMultistreams: "--audio-multistreams",
  noAudioMultistreams: "--no-audio-multistreams",
  preferFreeFormats: "--prefer-free-formats",
  noPreferFreeFormats: "--no-prefer-free-formats",
  checkFormats: "--check-formats",
  checkAllFormats: "--check-all-formats",
  noCheckFormats: "--no-check-formats",
  listFormats: "--list-formats",
  mergeOutputFormat: "--merge-output-format",

  writeSubs: "--write-subs",
  noWriteSubs: "--no-write-subs",
  writeAutoSubs: "--write-auto-subs",
  noWriteAutoSubs: "--no-write-auto-subs",
  listSubs: "--list-subs",
  subFormat: "--sub-format",
  subLangs: "--sub-langs",

  username: "--username",
  password: "--password",
  twofactor: "--twofactor",
  netrc: "--netrc",
  netrcLocation: "--netrc-location",
  netrcCmd: "--netrc-cmd",
  videoPassword: "--video-password",
  apMso: "--ap-mso",
  apUsername: "--ap-username",
  apPassword: "--ap-password",
  apListMso: "--ap-list-mso",
  clientCertificate: "--client-certificate",
  clientCertificateKey: "--client-certificate-key",
  clientCertificatePassword: "--client-certificate-password",

  extractAudio: "--extract-audio",
  audioFormat: "--audio-format",
  audioQuality: "--audio-quality",
  remuxVideo: "--remux-video",
  recodeVideo: "--recode-video",
  postprocessorArgs: "--postprocessor-args",
  keepVideo: "--keep-video",
  noKeepVideo: "--no-keep-video",
  postOverwrites: "--post-overwrites",
  noPostOverwrites: "--no-post-overwrites",
  embedSubs: "--embed-subs",
  noEmbedSubs: "--no-embed-subs",
  embedThumbnail: "--embed-thumbnail",
  noEmbedThumbnail: "--no-embed-thumbnail",
  embedMetadata: "--embed-metadata",
  noEmbedMetadata: "--no-embed-metadata",
  embedChapters: "--embed-chapters",
  noEmbedChapters: "--no-embed-chapters",
  embedInfoJson: "--embed-info-json",
  noEmbedInfoJson: "--no-embed-info-json",
  parseMetadata: "--parse-metadata",
  replaceInMetadata: "--replace-in-metadata",
  xattrs: "--xattrs",
  concatPlaylist: "--concat-playlist",
  fixup: "--fixup",
  ffmpegLocation: "--ffmpeg-location",
  exec: "--exec",
  noExec: "--no-exec",
  convertSubs: "--convert-subs",
  convertThumbnails: "--convert-thumbnails",
  splitChapters: "--split-chapters",
  noSplitChapters: "--no-split-chapters",
  removeChapters: "--remove-chapters",
  noRemoveChapters: "--no-remove-chapters",
  forceKeyframesAtCuts: "--force-keyframes-at-cuts",
  noForceKeyframesAtCuts: "--no-force-keyframes-at-cuts",
  usePostprocessor: "--use-postprocessor",

  sponsorblockMark: "--sponsorblock-mark",
  sponsorblockRemove: "--sponsorblock-remove",
  sponsorblockChapterTitle: "--sponsorblock-chapter-title",
  noSponsorblock: "--no-sponsorblock",
  sponsorblockApi: "--sponsorblock-api",

  extractorRetries: "--extractor-retries",
  allowDynamicMpd: "--allow-dynamic-mpd",
  ignoreDynamicMpd: "--ignore-dynamic-mpd",
  hlsSplitDiscontinuity: "--hls-split-discontinuity",
  noHlsSplitDiscontinuity: "--no-hls-split-discontinuity",
  extractorArgs: "--extractor-args",

  jsRuntimes: "--js-runtimes",
  noJsRuntimes: "--no-js-runtimes",
  remoteComponents: "--remote-components",
  noRemoteComponents: "--no-remote-components",
  flatPlaylist: "--flat-playlist",
  noFlatPlaylist: "--no-flat-playlist",
  liveFromStart: "--live-from-start",
  noLiveFromStart: "--no-live-from-start",
  waitForVideo: "--wait-for-video",
  noWaitForVideo: "--no-wait-for-video",
  markWatched: "--mark-watched",
  noMarkWatched: "--no-mark-watched",
  color: "--color",
  compatOptions: "--compat-options",
  alias: "--alias",
  presetAlias: "--preset-alias",
  defaultSearch: "--default-search",
  ignoreConfig: "--ignore-config",
  configLocations: "--config-locations",
  pluginDirs: "--plugin-dirs",
  noPluginDirs: "--no-plugin-dirs",

  yesPlaylist: "--yes-playlist",
  noPlaylist: "--no-playlist",
  matchFilters: "--match-filters",
  breakMatchFilters: "--break-match-filters",

  convertThumbnails_format: "--convert-thumbnails"
};

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
    const checkBin = bin => new Promise(resolve => {
      const env = { ...process.env };
      if (process.platform === "linux" && env.HOME) {
        const localBin = path.join(env.HOME, ".local", "bin");
        env.PATH = `${localBin}:${env.PATH}`;
      }
      const proc = spawn(bin, ["--version"], { env, shell: false, stdio: "ignore" });
      proc.on("error", () => resolve(false));
      proc.on("close", code => resolve(code === 0));
    });
    const ytdlpExists = await checkBin(this.ytDlpBin);
    const galleryDlExists = await checkBin(this.galleryDlBin);
    if (!ytdlpExists || !galleryDlExists) {
      const pipCmd = process.platform === "win32" ? "pip" : "pip3";
      const args = ["install", "--break-system-packages", "-U", "yt-dlp", "gallery-dl", "yt-dlp-ejs", "curl_cffi"];
      try { await this._execute(pipCmd, args, process.cwd()); } catch {}
      try { await this._execute("pip", args, process.cwd()); } catch {}
    }
    if (ytdlpExists) {
      const pipCmd = process.platform === "win32" ? "pip" : "pip3";
      let hasCurlCffi = true;
      try { await this._execute(pipCmd, ["show", "-q", "curl_cffi"], process.cwd()); } catch { hasCurlCffi = false; }
      if (!hasCurlCffi) {
        try {
          await this._execute(pipCmd, ["install", "--break-system-packages", "curl_cffi"], process.cwd());
          console.log("[ytdpl] curl_cffi installed (yt-dlp impersonation enabled)");
        } catch { console.log("[ytdpl] curl_cffi not available — TikTok may require Node.js fallback"); }
      }
    }
    if (!fsSync.existsSync(this._cacheDir)) fsSync.mkdirSync(this._cacheDir, { recursive: true });
    this._initialized = true;
  }
  async _ensureDir(dir) { await fs.mkdir(dir, { recursive: true }); }
  async _fetchWithRetry(url, options = {}, retries = 3) {
    let fetch = globalThis.fetch;
    if (!fetch) { try { fetch = (await import("node-fetch")).default; } catch {} }
    if (!fetch) throw new Error("No fetch implementation available");
    let lastErr;
    for (let attempt = 1; attempt <= retries; attempt++) {
      const controller = new AbortController;
      const timeoutMs = options.timeout || 30000;
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try { const res = await fetch(url, { ...options, signal: controller.signal }); return res; }
      catch (e) {
        lastErr = e;
        if (attempt < retries) { const delay = 1500 * attempt; console.log(`[fetch] retry ${attempt}/${retries} in ${delay}ms — ${e.message}`); await new Promise(r => setTimeout(r, delay)); }
      } finally { clearTimeout(timer); }
    }
    throw lastErr;
  }
  async _fetchBuf(url, headers = {}, retries = 3) {
    let lastErr;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const res = await this._fetchWithRetry(url, { headers }, 1);
        if (!res.ok) lastErr = new Error(`HTTP ${res.status} from ${url}`);
        else if (typeof res.buffer === "function") return await res.buffer();
        else return Buffer.from(await res.arrayBuffer());
      } catch (e) { lastErr = e; }
      if (attempt < retries) { const delay = 2000 * attempt; console.log(`[download] retry ${attempt}/${retries} in ${delay}ms — ${lastErr.message}`); await new Promise(r => setTimeout(r, delay)); }
    }
    throw lastErr;
  }
  _isGalleryUrl(url) {
    const pinterestRegex = /pinterest\.[a-z.]+\/pin\//i;
    const tiktokSlideRegex = /tiktok\.com.*\/photo\//i;
    return pinterestRegex.test(url) || tiktokSlideRegex.test(url);
  }
  _isSpotifyUrl(url) { return /open\.spotify\.com\/(track|album|playlist)/i.test(url) || /spotify\.link\//i.test(url); }
  isSCUrl(url) { return /soundcloud\.com/i.test(url); }
  isDlUrl(url) { return /^https?:\/\/.+\.(mp3|wav|ogg|flac|m4a|aac|opus)(\?|$)/i.test(url); }
  _getCachePath(url) { const hash = crypto.createHash("md5").update(url).digest("hex"); return path.join(this._cacheDir, `track_${hash}.opus`); }
  async getCachedFile(url) {
    const cachePath = this._getCachePath(url);
    if (fsSync.existsSync(cachePath)) { const stats = await fs.stat(cachePath); if (stats.size > 0) return cachePath; }
    return null;
  }
  async cacheFile(url, sourcePath) {
    try { const cachePath = this._getCachePath(url); await fs.copyFile(sourcePath, cachePath); return cachePath; } catch { return null; }
  }
  async _execute(bin, args, cwd) {
    try {
      const { code, stdout, stderr } = await require("../../core/heavy").heavyExec(bin, args, cwd);
      if (code === 0) return { stdout, stderr };
      if (stderr && stderr.includes("[DRM]")) throw new Error("This content is protected by DRM and cannot be downloaded.");
      throw new Error(stderr || `Process exited with code ${code}`);
    } catch (e) {
      if (e && /worker|worker_threads|ERR_WORKER/i.test(String(e.message))) return this._executeInline(bin, args, cwd);
      throw e;
    }
  }
  _executeInline(bin, args, cwd) {
    return new Promise((resolve, reject) => {
      const env = { ...process.env };
      if (process.platform === "linux" && env.HOME) { const localBin = path.join(env.HOME, ".local", "bin"); env.PATH = `${localBin}:${env.PATH}`; }
      const proc = spawn(bin, args, { cwd, env, shell: false });
      let stdout = ""; let stderr = "";
      proc.stdout.on("data", data => { stdout += data.toString(); });
      proc.stderr.on("data", data => { stderr += data.toString(); });
      proc.on("error", reject);
      proc.on("close", code => {
        if (code === 0) resolve({ stdout, stderr });
        else { if (stderr && stderr.includes("[DRM]")) reject(new Error("This content is protected by DRM and cannot be downloaded.")); else reject(new Error(stderr || `Process exited with code ${code}`)); }
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
        return { type: "carousel", images: data.data.images, description: data.data.title || "", author: data.data.author?.nickname || "Unknown", webpage_url: url };
      }
      if (data.data.play) return { type: "video", url: data.data.play, description: data.data.title || "", author: data.data.author?.nickname || "Unknown", webpage_url: url };
      return null;
    } catch (e) { console.error("[TikTok Native] Error:", e.message); return null; }
  }
  async search(query, options = {}) {
    await this.ensureDeps();
    const limit = options.limit || 1;
    const q = `ytsearch${limit}:${query}`;
    const args = ["-j", "--no-warnings", "--skip-download", "--js-runtimes", "node", "--remote-components", "ejs:github"];
    if (options.cookies) args.push("--cookies", options.cookies);
    if (options.cookiesFromBrowser) args.push("--cookies-from-browser", options.cookiesFromBrowser);
    if (options.extractorArgs) {
      const v = typeof options.extractorArgs === "string" ? options.extractorArgs : Object.entries(options.extractorArgs).map(([k,v])=>`${k}:${v}`).join(" ");
      if(v) args.push("--extractor-args", v);
    }
    args.push(q);
    const { stdout } = await this._execute(this.ytDlpBin, args, this.baseDir);
    const lines = stdout.split("\n").filter(l => l.trim());
    const results = [];
    for (const line of lines) {
      try { const parsed = JSON.parse(line); if (parsed.id) results.push({ id: parsed.id, title: parsed.title || "Unknown", url: parsed.webpage_url || parsed.url || `https://www.youtube.com/watch?v=${parsed.id}`, thumbnail: parsed.thumbnail || parsed.thumbnails?.[parsed.thumbnails.length - 1]?.url || "", duration: parsed.duration || 0, uploader: parsed.uploader || parsed.channel || "Unknown", platform: "youtube" }); } catch {}
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
    const isYoutube = /youtube|youtu.be|^:(ytfav|ythis|ytrec|ytnotif|ytsubs|ytwatchlater)$/i.test(url) || url.startsWith("ytsearch") || url.startsWith("ytuser");
    if (isSoundCloud) return this._scMeta(url, options);
    if (isDirect) return [{ id: "direct_" + Date.now(), webpage_url: url, url, title: path.basename(new URL(url).pathname) || "Direct Audio", uploader: "Direct Link", duration: 0, platform: "direct" }];
    let bin, args;
    if (isTiktokPhoto || isGallery || isInstagram) { bin = this.galleryDlBin; args = ["-j"]; }
    else if (isSpotify) { bin = this.ytDlpBin; args = ["-j", "--no-warnings", "--skip-download"]; }
    else if (isTiktok && !isTiktokPhoto) { bin = this.ytDlpBin; args = ["-j", "--no-warnings", "--skip-download", "--no-check-certificates", "--user-agent", "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36", "--extractor-args", "tiktok:api_hostname=api-h2.tiktokweb", "--js-runtimes", "node"]; }
    else { bin = this.ytDlpBin; args = ["-j", "--no-warnings", "--skip-download", "--js-runtimes", "node", "--remote-components", "ejs:github", "--retries", "3", "--extractor-args", "youtube:player_client=web_embedded,default,android,ios,tv"]; if (isYoutube && !isYoutubeSingle) args.push("--playlist-items", "1"); }

    if (options.cookies) args.push("--cookies", options.cookies);
    if (options.cookiesFromBrowser) args.push("--cookies-from-browser", options.cookiesFromBrowser);
    if (options.extractorArgs && !(isTiktok && !isTiktokPhoto)) {
      const ea = typeof options.extractorArgs === "string" ? options.extractorArgs : Object.entries(options.extractorArgs).map(([k,v])=>`${k}:${v}`).join(" ");
      if (ea) args.push("--extractor-args", ea);
    }
    if (options.proxy) args.push("--proxy", options.proxy);
    if (options.impersonate) args.push("--impersonate", options.impersonate);
    if (options.forceIpv4) args.push("--force-ipv4");
    if (options.forceIpv6) args.push("--force-ipv6");
    if (options.noCheckCertificates) args.push("--no-check-certificates");
    if (options.addHeaders) { const arr = Array.isArray(options.addHeaders)? options.addHeaders : [options.addHeaders]; arr.forEach(h=>args.push("--add-headers", h)); }
    if (options.sleepRequests) args.push("--sleep-requests", String(options.sleepRequests));
    if (options.extractorRetries) args.push("--extractor-retries", String(options.extractorRetries));
    if (options.useExtractors) args.push("--use-extractors", options.useExtractors);
    if (options.flatPlaylist) args.push("--flat-playlist");
    if (options.noPlaylist) args.push("--no-playlist");
    if (options.yesPlaylist) args.push("--yes-playlist");
    args.push(url);
    let stdout, stderr;
    try { const result = await this._execute(bin, args, this.baseDir); stdout = result.stdout; stderr = result.stderr; }
    catch (err) {
      if (isTiktok && bin === this.ytDlpBin) {
        console.log("[TikTok] yt-dlp failed, trying Node.js fallback...");
        if (typeof this.ttNative !== "function") throw new Error("TikTok fallback not available: ttNative is not a function");
        const fallback = await this.ttNative(url);
        if (fallback) {
          if (fallback.type === "carousel" && fallback.images && fallback.images.length > 0) return fallback.images.map((img,i)=>({ id:`tiktok_slide_${i}`, webpage_url: fallback.webpage_url||url, url: img, title: fallback.description||"TikTok Slide", uploader: fallback.author||"Unknown", description: fallback.description||"", _type:"photo", _fallback:true }));
          if (fallback.url) return [{ id:"tiktok_fallback", webpage_url: fallback.webpage_url||url, url: fallback.url, title: fallback.description||"TikTok Video", uploader: fallback.author||"Unknown", description: fallback.description||"", _type:"video", _fallback:true }];
        }
        throw new Error(`TikTok metadata failed: ${err.message.substring(0,100)}`);
      } else throw err;
    }
    if (bin === this.galleryDlBin || isGallery) {
      const raw = stdout || stderr;
      try { const parsed = JSON.parse(raw.trim()); const items = Array.isArray(parsed) ? parsed : [parsed]; return items.map(item=>({ id:item.id||item.post_id||item._filename||`gallery_${Date.now()}`, webpage_url:item.url||item.webpage_url||url, url:item.url||item._filename||"", title:item.description||item.title||item.text||"Gallery Media", uploader:item.uploader||item.author||item.creator||item.owner||"Unknown", description:item.description||item.text||item.caption||"", _type:item._type||"photo", _gallery:true })); } catch {
        try { const lines = raw.split("\n").filter(l=>l.trim()); const entries=[]; for(const line of lines){ try{ const item=JSON.parse(line); entries.push({ id:item.id||item.post_id||`gallery_${entries.length}`, webpage_url:item.url||url, url:item.url||"", title:item.description||item.title||"Gallery Media", uploader:item.uploader||item.author||"Unknown", description:item.description||item.text||"", _type:item._type||"photo", _gallery:true }); }catch{} } if(entries.length>0) return entries; }catch{}
      }
      throw new Error("Metadata not valid.");
    }
    try { const parsed=JSON.parse(stdout.trim()); if(!parsed) throw new Error("Empty response from yt-dlp"); if(parsed._type==="playlist" && Array.isArray(parsed.entries)) return parsed.entries; if(parsed.id) return parsed; if(Array.isArray(parsed)) return parsed.length>0?parsed:[parsed]; return [parsed]; }
    catch (error) { const lines=stdout.split("\n").filter(l=>l.trim()); const entries=[]; for(const line of lines){ try{ const p=JSON.parse(line); if(p.id) entries.push(p);}catch{} } if(entries.length>0) return entries; throw new Error(`Failed to get video metadata: ${error.message}`); }
  }
  async _scMeta(url, options = {}) {
    const args = ["-j", "--no-warnings", "--skip-download", "--js-runtimes", "node", "--remote-components", "ejs:github"];
    if (options.cookies) args.push("--cookies", options.cookies);
    if (options.cookiesFromBrowser) args.push("--cookies-from-browser", options.cookiesFromBrowser);
    if (options.proxy) args.push("--proxy", options.proxy);
    args.push(url);
    try {
      const { stdout } = await this._execute(this.ytDlpBin, args, this.baseDir);
      const parsed = JSON.parse(stdout.trim());
      return [{ id: parsed.id||"sc_"+Date.now(), webpage_url: parsed.webpage_url||url, url: parsed.url||url, title: parsed.title||"Unknown", thumbnail: parsed.thumbnail||parsed.artwork_url||"", duration: parsed.duration||0, uploader: parsed.uploader||parsed.artist||"Unknown", platform:"soundcloud" }];
    } catch (e) {
      const slugQuery = String(url).replace(/^https?:\/\/([^/]+\.)?soundcloud\.com\//i,"").replace(/[/?#].*$/,"").replace(/[-_]+/g," ").trim();
      if (slugQuery) {
        try { const {stdout} = await this._execute(this.ytDlpBin, ["-j","--no-warnings","--skip-download","--js-runtimes","node","--remote-components","ejs:github", `scsearch1:${slugQuery}`], this.baseDir); const parsed=JSON.parse(stdout.trim()); return [{ id: parsed.id||"sc_"+Date.now(), webpage_url: parsed.webpage_url||url, url: parsed.url||url, title: parsed.title||"Unknown", thumbnail: parsed.thumbnail||parsed.artwork_url||"", duration: parsed.duration||0, uploader: parsed.uploader||parsed.artist||"Unknown", platform:"soundcloud" }]; } catch(e2){}
      }
      throw new Error(`SoundCloud metadata failed: ${e.message}`);
    }
  }
  async searchTracks(query, limit=20) {
    await this.ensureDeps();
    const searchQuery = String(query||"").startsWith("ytsearch")? String(query) : `ytsearch${Math.min(limit,30)}:${query}`;
    const args = ["--flat-playlist","--dump-single-json","--no-warnings","--skip-download","--js-runtimes","node","--remote-components","ejs:github", searchQuery];
    try { const {stdout}=await this._execute(this.ytDlpBin, args, this.baseDir); const parsed=JSON.parse(stdout.trim()); const entries = parsed && Array.isArray(parsed.entries)? parsed.entries : parsed? [parsed]:[]; return entries.filter(e=>e&&e.id).slice(0,limit).map(e=>({ id:e.id, title:e.title||"Unknown", url:e.webpage_url||(e.id?`https://www.youtube.com/watch?v=${e.id}`:""), webpage_url:e.webpage_url||(e.id?`https://www.youtube.com/watch?v=${e.id}`:""), thumbnail:e.thumbnail||"", duration:e.duration||0, uploader:e.uploader||e.channel||"Unknown", channel:e.uploader||e.channel||"Unknown", platform:"youtube"})); }
    catch(e){ process.stderr.write("[ytdpl] searchTracks error: "+e.message+"\n"); return []; }
  }


  async listExtractors(options={}) {
    await this.ensureDeps();
    const args=["--list-extractors"];
    if(options.useExtractors) args.push("--use-extractors", options.useExtractors);
    const {stdout} = await this._execute(this.ytDlpBin, args, this.baseDir);
    return stdout.split("\n").map(s=>s.trim()).filter(Boolean);
  }
  async extractorDescriptions(options={}) {
    await this.ensureDeps();
    const args=["--extractor-descriptions"];
    const {stdout} = await this._execute(this.ytDlpBin, args, this.baseDir);

    const lines = stdout.split("\n").filter(l=>l.trim());
    const map={};
    for(const l of lines){
      const m=l.match(/^([^:]+):\s*(.*)$/);
      if(m) map[m[1].trim()] = m[2].trim();
      else {
        const k=l.split(/\s+/)[0];
        if(k) map[k]=l;
      }
    }
    return map;
  }
  async listFormats(url, options={}) {
    await this.ensureDeps();
    const args=["--list-formats", "--no-warnings"];
    this._appendCommonDownloadOpts(args, options, null, false);
    args.push(url);
    const {stdout} = await this._execute(this.ytDlpBin, args, this.baseDir);
    return stdout;
  }
  async listSubs(url, options={}) {
    await this.ensureDeps();
    const args=["--list-subs", "--no-warnings"];
    this._appendCommonDownloadOpts(args, options, null, false);
    args.push(url);
    const {stdout} = await this._execute(this.ytDlpBin, args, this.baseDir);
    return stdout;
  }
  async listThumbnails(url, options={}) {
    await this.ensureDeps();
    const args=["--list-thumbnails", "--no-warnings"];
    this._appendCommonDownloadOpts(args, options, null, false);
    args.push(url);
    const {stdout} = await this._execute(this.ytDlpBin, args, this.baseDir);
    return stdout;
  }
  async getHelp() {
    await this.ensureDeps();
    const {stdout} = await this._execute(this.ytDlpBin, ["--help"], this.baseDir);
    return stdout;
  }


  _appendCommonDownloadOpts(args, options, outputDir, isInstagram=false, isGallery=false) {
    if(!options || typeof options !== "object") return;
    const handled = new Set();

    if(args.includes("--cookies")) handled.add("cookies");
    if(args.includes("--cookies-from-browser")) { handled.add("cookiesFromBrowser"); handled.add("cookies_from_browser"); }
    if(args.includes("-f") || args.includes("--format")) handled.add("format");
    if(args.includes("--merge-output-format")) { handled.add("mergeOutputFormat"); handled.add("merge_output_format"); }
    if(args.includes("--extractor-args")) { handled.add("extractorArgs"); handled.add("extractor_args"); }
    if(args.includes("-o") || args.includes("--output")) { handled.add("output"); handled.add("outputTemplate"); handled.add("filenameFormat"); }
    if(args.includes("--limit-rate")) { handled.add("limitRate"); handled.add("limit_rate"); }
    if(args.includes("--max-filesize")) { handled.add("maxFilesize"); handled.add("max_filesize"); }
    if(args.includes("--sleep-requests")) { handled.add("sleepRequests"); handled.add("sleepRequest"); }

    const pushBool = (key, flag) => { if(handled.has(key)) return; if(options[key]) { args.push(flag); handled.add(key); } };
    const pushVal = (key, flag, aliasKeys=[]) => {
      if(handled.has(key) || aliasKeys.some(k=>handled.has(k))) return;
      const v = options[key] ?? (aliasKeys.length ? aliasKeys.map(k=>options[k]).find(v=>v!==undefined) : undefined);
      if(v!==undefined && v!==null && v!=="") { args.push(flag, String(v)); handled.add(key); aliasKeys.forEach(k=>handled.add(k)); }
    };
    const pushArray = (key, flag, aliasKeys=[]) => {
      if(handled.has(key) || aliasKeys.some(k=>handled.has(k))) return;
      const v = options[key] ?? (aliasKeys.length ? aliasKeys.map(k=>options[k]).find(v=>v!==undefined) : undefined);
      if(v!==undefined && v!==null){
        if(Array.isArray(v)) v.forEach(e=>{ if(e) args.push(flag, String(e)); });
        else if(String(v)) args.push(flag, String(v));
        handled.add(key); aliasKeys.forEach(k=>handled.add(k));
      }
    };


    pushVal("proxy", "--proxy");
    pushVal("socketTimeout", "--socket-timeout", ["socket_timeout"]);
    pushVal("sourceAddress", "--source-address", ["source_address"]);
    if(options.impersonate!==undefined && options.impersonate!==null && options.impersonate!=="") { args.push("--impersonate", String(options.impersonate)); handled.add("impersonate"); }
    pushBool("listImpersonateTargets", "--list-impersonate-targets");
    pushBool("forceIpv4", "--force-ipv4");
    pushBool("forceIpv6", "--force-ipv6");
    pushBool("enableFileUrls", "--enable-file-urls");

    pushVal("geoVerificationProxy", "--geo-verification-proxy", ["geo_verification_proxy"]);
    pushVal("xff", "--xff");

    pushVal("playlistItems", "--playlist-items", ["playlist_items","playlist-items"]);
    pushVal("minFilesize", "--min-filesize", ["min_filesize","min-filesize"]);
    pushVal("maxFilesize", "--max-filesize", ["max_filesize","max-filesize"]);
    pushVal("date", "--date");
    pushVal("dateBefore", "--datebefore", ["datebefore","date_before"]);
    pushVal("dateAfter", "--dateafter", ["dateafter","date_after"]);
    pushArray("matchFilters", "--match-filters", ["match_filter","match_filters"]);
    pushArray("matchFilters", "--match-filters", ["matchFilters"]);

    pushArray("breakMatchFilters", "--break-match-filters", ["break_match_filters","break-match-filters"]);
    pushBool("noPlaylist", "--no-playlist"); handled.add("noPlaylist"); handled.add("no_playlist");
    pushBool("yesPlaylist", "--yes-playlist"); handled.add("yesPlaylist"); handled.add("yes_playlist");
    pushVal("ageLimit", "--age-limit", ["age_limit","age-limit"]);
    pushVal("downloadArchive", "--download-archive", ["download_archive","download-archive"]);
    pushVal("maxDownloads", "--max-downloads", ["max_downloads","max-downloads"]);
    pushBool("breakOnExisting", "--break-on-existing"); handled.add("breakOnExisting"); handled.add("break_on_existing");
    pushBool("breakPerInput", "--break-per-input"); handled.add("breakPerInput"); handled.add("break_per_input");
    pushBool("noBreakPerInput", "--no-break-per-input");
    pushVal("skipPlaylistAfterErrors", "--skip-playlist-after-errors", ["skip_playlist_after_errors"]);

    pushVal("concurrentFragments", "--concurrent-fragments", ["concurrent_fragments","concurrent-fragments"]);

    if(options.limitRate || options.limit_rate || options.limit_rate) { const v=options.limitRate||options.limit_rate; args.push("--limit-rate", String(v)); handled.add("limitRate"); handled.add("limit_rate"); }
    pushVal("throttledRate", "--throttled-rate", ["throttled_rate"]);
    pushVal("retries", "--retries", ["retries"]);
    pushVal("fileAccessRetries", "--file-access-retries", ["file_access_retries"]);
    pushVal("fragmentRetries", "--fragment-retries", ["fragment_retries"]);
    pushVal("retrySleep", "--retry-sleep", ["retry_sleep"]);
    pushBool("keepFragments", "--keep-fragments"); handled.add("keepFragments"); handled.add("keep_fragments");
    pushBool("noKeepFragments", "--no-keep-fragments");
    pushVal("bufferSize", "--buffer-size", ["buffer_size"]);
    if(options.resizeBuffer) { args.push("--resize-buffer"); handled.add("resizeBuffer"); }
    if(options.noResizeBuffer) { args.push("--no-resize-buffer"); handled.add("noResizeBuffer"); }
    pushVal("httpChunkSize", "--http-chunk-size", ["http_chunk_size"]);
    pushBool("playlistRandom", "--playlist-random"); handled.add("playlistRandom"); handled.add("playlist_random");
    pushBool("lazyPlaylist", "--lazy-playlist");
    pushBool("noLazyPlaylist", "--no-lazy-playlist");
    pushBool("hlsUseMpegts", "--hls-use-mpegts"); handled.add("hlsUseMpegts");
    pushBool("noHlsUseMpegts", "--no-hls-use-mpegts");

    pushArray("downloadSections", "--download-sections", ["download_sections","download-sections"]);

    pushArray("downloader", "--downloader");
    pushArray("downloaderArgs", "--downloader-args", ["downloader_args","downloader-args"]);

    pushVal("batchFile", "--batch-file", ["batch_file"]);

    if(options.paths){
      if(typeof options.paths==="string") { args.push("--paths", options.paths); handled.add("paths"); }
      else if(typeof options.paths==="object"){ for(const [k,v] of Object.entries(options.paths)){ args.push("--paths", `${k}:${v}`); } handled.add("paths"); }
    }
    pushVal("outputNaPlaceholder", "--output-na-placeholder", ["output_na_placeholder"]);
    pushBool("restrictFilenames", "--restrict-filenames"); handled.add("restrictFilenames"); handled.add("restrict_filenames");
    pushBool("noRestrictFilenames", "--no-restrict-filenames");
    pushBool("windowsFilenames", "--windows-filenames"); handled.add("windowsFilenames"); handled.add("windows_filenames");
    pushBool("noWindowsFilenames", "--no-windows-filenames");
    pushVal("trimFilenames", "--trim-filenames", ["trim_filenames"]);
    pushBool("noOverwrites", "--no-overwrites"); handled.add("noOverwrites"); handled.add("no_overwrites");
    pushBool("forceOverwrites", "--force-overwrites"); handled.add("forceOverwrites"); handled.add("force_overwrites");
    pushBool("noForceOverwrites", "--no-force-overwrites");

    if(options.continue===true) { args.push("--continue"); handled.add("continue"); }
    else if(options.continue===false || options.noContinue) { args.push("--no-continue"); handled.add("continue"); handled.add("noContinue"); }
    pushBool("part", "--part");
    pushBool("noPart", "--no-part");
    pushBool("mtime", "--mtime");
    pushBool("noMtime", "--no-mtime");
    pushVal("writeDescription", null);

    if(options.writeDescription) { args.push("--write-description"); handled.add("writeDescription"); handled.add("write_description"); }
    if(options.noWriteDescription) { args.push("--no-write-description"); handled.add("noWriteDescription"); }
    if(options.writeInfoJson) { args.push("--write-info-json"); handled.add("writeInfoJson"); handled.add("write_info_json"); }
    if(options.noWriteInfoJson) { args.push("--no-write-info-json"); handled.add("noWriteInfoJson"); }
    pushBool("writePlaylistMetafiles", "--write-playlist-metafiles"); handled.add("writePlaylistMetafiles"); handled.add("write_playlist_metafiles");
    pushBool("noWritePlaylistMetafiles", "--no-write-playlist-metafiles");
    if(options.cleanInfoJson!==undefined){ if(options.cleanInfoJson) args.push("--clean-info-json"); else args.push("--no-clean-info-json"); handled.add("cleanInfoJson"); handled.add("clean_info_json"); }

    if(options.writeComments) { args.push("--write-comments"); handled.add("writeComments"); handled.add("write_comments"); }
    if(options.noWriteComments) { args.push("--no-write-comments"); handled.add("noWriteComments"); }
    pushVal("loadInfoJson", "--load-info-json", ["load_info_json"]);


    if(options.cookies && !handled.has("cookies")) { args.push("--cookies", String(options.cookies)); handled.add("cookies"); }
    if(options.cookiesFromBrowser) { args.push("--cookies-from-browser", String(options.cookiesFromBrowser)); handled.add("cookiesFromBrowser"); handled.add("cookies_from_browser"); }

    pushVal("cacheDir", "--cache-dir", ["cache_dir"]);
    pushBool("noCacheDir", "--no-cache-dir"); handled.add("noCacheDir"); handled.add("no_cache_dir");
    pushBool("rmCacheDir", "--rm-cache-dir"); handled.add("rmCacheDir"); handled.add("rm_cache_dir");

    pushBool("writeThumbnail", "--write-thumbnail"); handled.add("writeThumbnail"); handled.add("write_thumbnail");
    pushBool("noWriteThumbnail", "--no-write-thumbnail");
    pushBool("writeAllThumbnails", "--write-all-thumbnails"); handled.add("writeAllThumbnails"); handled.add("write_all_thumbnails");
    pushBool("listThumbnails", "--list-thumbnails");

    pushBool("writeLink", "--write-link"); handled.add("writeLink"); handled.add("write_link");
    pushBool("writeUrlLink", "--write-url-link");
    pushBool("writeWeblocLink", "--write-webloc-link");
    pushBool("writeDesktopLink", "--write-desktop-link");

    pushBool("quiet", "--quiet");
    pushBool("noQuiet", "--no-quiet");
    pushBool("noWarnings", "--no-warnings"); handled.add("noWarnings"); handled.add("no_warnings");
    pushBool("simulate", "--simulate");
    pushBool("noSimulate", "--no-simulate");
    pushBool("ignoreNoFormatsError", "--ignore-no-formats-error"); handled.add("ignoreNoFormatsError"); handled.add("ignore_no_formats_error");
    pushBool("noIgnoreNoFormatsError", "--no-ignore-no-formats-error");
    pushBool("skipDownload", "--skip-download"); handled.add("skipDownload"); handled.add("skip_download");
    pushBool("forceWriteArchive", "--force-write-archive");
    pushBool("newline", "--newline");
    pushBool("noProgress", "--no-progress"); handled.add("noProgress"); handled.add("no_progress");
    pushBool("progress", "--progress");
    pushBool("consoleTitle", "--console-title"); handled.add("consoleTitle"); handled.add("console_title");
    pushVal("progressTemplate", "--progress-template", ["progress_template"]);
    pushVal("progressDelta", "--progress-delta", ["progress_delta"]);
    pushBool("verbose", "--verbose");
    pushBool("dumpPages", "--dump-pages"); handled.add("dumpPages"); handled.add("dump_pages");
    pushBool("writePages", "--write-pages"); handled.add("writePages"); handled.add("write_pages");
    pushBool("printTraffic", "--print-traffic"); handled.add("printTraffic"); handled.add("print_traffic");

    pushVal("encoding", "--encoding");
    pushBool("legacyServerConnect", "--legacy-server-connect"); handled.add("legacyServerConnect"); handled.add("legacy_server_connect");
    pushBool("noCheckCertificates", "--no-check-certificates"); handled.add("noCheckCertificates"); handled.add("no_check_certificates");
    pushBool("preferInsecure", "--prefer-insecure"); handled.add("preferInsecure"); handled.add("prefer_insecure");
    pushArray("addHeaders", "--add-headers", ["add_headers","add-headers"]);
    pushBool("bidiWorkaround", "--bidi-workaround"); handled.add("bidiWorkaround"); handled.add("bidi_workaround");
    pushVal("sleepRequests", "--sleep-requests", ["sleep_requests","sleepRequests"]);

    if(options.sleepRequest && !options.sleepRequests) { args.push("--sleep-requests", String(options.sleepRequest)); handled.add("sleepRequest"); }
    pushVal("sleepInterval", "--sleep-interval", ["sleep_interval"]);
    pushVal("maxSleepInterval", "--max-sleep-interval", ["max_sleep_interval"]);
    pushVal("sleepSubtitles", "--sleep-subtitles", ["sleep_subtitles"]);


    if(options.format && !handled.has("format")) { args.push("-f", String(options.format)); handled.add("format"); }
    pushVal("formatSort", "--format-sort", ["format_sort","format-sort","formatSort"]);
    pushBool("formatSortForce", "--format-sort-force"); handled.add("formatSortForce"); handled.add("format_sort_force");
    pushBool("noFormatSortForce", "--no-format-sort-force");
    pushBool("formatSortReset", "--format-sort-reset"); handled.add("formatSortReset"); handled.add("format_sort_reset");
    pushBool("videoMultistreams", "--video-multistreams"); handled.add("videoMultistreams"); handled.add("video_multistreams");
    pushBool("noVideoMultistreams", "--no-video-multistreams");
    pushBool("audioMultistreams", "--audio-multistreams"); handled.add("audioMultistreams"); handled.add("audio_multistreams");
    pushBool("noAudioMultistreams", "--no-audio-multistreams");
    pushBool("preferFreeFormats", "--prefer-free-formats"); handled.add("preferFreeFormats"); handled.add("prefer_free_formats");
    pushBool("noPreferFreeFormats", "--no-prefer-free-formats");
    pushBool("checkFormats", "--check-formats"); handled.add("checkFormats"); handled.add("check_formats");
    pushBool("checkAllFormats", "--check-all-formats"); handled.add("checkAllFormats"); handled.add("check_all_formats");
    pushBool("noCheckFormats", "--no-check-formats");
    pushBool("listFormats", "--list-formats"); handled.add("listFormats"); handled.add("list_formats");
    pushVal("mergeOutputFormat", "--merge-output-format", ["merge_output_format","mergeOutputFormat"]);

    pushBool("writeSubs", "--write-subs"); handled.add("writeSubs"); handled.add("write_subs");
    pushBool("noWriteSubs", "--no-write-subs");
    pushBool("writeAutoSubs", "--write-auto-subs"); handled.add("writeAutoSubs"); handled.add("write_auto_subs"); handled.add("writeAutomaticSubs"); handled.add("write_automatic_subs");
    if(options.writeAutomaticSubs && !options.writeAutoSubs) { args.push("--write-auto-subs"); handled.add("writeAutomaticSubs"); }
    pushBool("noWriteAutoSubs", "--no-write-auto-subs"); handled.add("noWriteAutoSubs");
    pushBool("listSubs", "--list-subs"); handled.add("listSubs"); handled.add("list_subs");
    pushVal("subFormat", "--sub-format", ["sub_format","subFormat"]);
    pushVal("subLangs", "--sub-langs", ["sub_langs","subLangs","sub-langs"]);

    pushVal("username", "--username");
    pushVal("password", "--password");
    pushVal("twofactor", "--twofactor");
    pushBool("netrc", "--netrc");
    pushVal("netrcLocation", "--netrc-location", ["netrc_location"]);
    pushVal("netrcCmd", "--netrc-cmd", ["netrc_cmd"]);
    pushVal("videoPassword", "--video-password", ["video_password"]);
    pushVal("apMso", "--ap-mso", ["ap_mso"]);
    pushVal("apUsername", "--ap-username", ["ap_username"]);
    pushVal("apPassword", "--ap-password", ["ap_password"]);
    pushBool("apListMso", "--ap-list-mso"); handled.add("apListMso");
    pushVal("clientCertificate", "--client-certificate", ["client_certificate"]);
    pushVal("clientCertificateKey", "--client-certificate-key", ["client_certificate_key"]);
    pushVal("clientCertificatePassword", "--client-certificate-password", ["client_certificate_password"]);


    if(options.extractAudio || options.extract_audio) { args.push("--extract-audio"); handled.add("extractAudio"); handled.add("extract_audio"); }
    if(options.audioOnly) {  if(!options.extractAudio && !options.extract_audio) { args.push("-x"); handled.add("audioOnly"); handled.add("audio_only"); } else handled.add("audioOnly"); }
    else handled.add("audioOnly");

    if(options.audioOnly && !options.audioFormat && !options.audio_format) {
      args.push("--audio-format", "mp3");
      handled.add("audioFormat"); handled.add("audio_format");
    }
    pushVal("audioFormat", "--audio-format", ["audio_format","audioFormat"]);
    pushVal("audioQuality", "--audio-quality", ["audio_quality","audioQuality"]);
    pushVal("remuxVideo", "--remux-video", ["remux_video","remuxVideo"]);
    pushVal("recodeVideo", "--recode-video", ["recode_video","recodeVideo"]);
    pushArray("postprocessorArgs", "--postprocessor-args", ["postprocessor_args","postprocessorArgs","ppa"]);

    if(options.keepVideo) { args.push("--keep-video"); handled.add("keepVideo"); handled.add("keep_video"); }
    if(options.noKeepVideo) { args.push("--no-keep-video"); handled.add("noKeepVideo"); }
    pushBool("postOverwrites", "--post-overwrites"); handled.add("postOverwrites"); handled.add("post_overwrites");
    pushBool("noPostOverwrites", "--no-post-overwrites");
    pushBool("embedSubs", "--embed-subs"); handled.add("embedSubs"); handled.add("embed_subs");
    pushBool("noEmbedSubs", "--no-embed-subs");
    pushBool("embedThumbnail", "--embed-thumbnail"); handled.add("embedThumbnail"); handled.add("embed_thumbnail");
    pushBool("noEmbedThumbnail", "--no-embed-thumbnail");
    pushBool("embedMetadata", "--embed-metadata"); handled.add("embedMetadata"); handled.add("embed_metadata");
    pushBool("noEmbedMetadata", "--no-embed-metadata");
    pushBool("embedChapters", "--embed-chapters"); handled.add("embedChapters"); handled.add("embed_chapters");
    pushBool("noEmbedChapters", "--no-embed-chapters");
    pushBool("embedInfoJson", "--embed-info-json"); handled.add("embedInfoJson"); handled.add("embed_info_json");
    pushBool("noEmbedInfoJson", "--no-embed-info-json");
    pushArray("parseMetadata", "--parse-metadata", ["parse_metadata"]);
    pushArray("replaceInMetadata", "--replace-in-metadata", ["replace_in_metadata"]);
    pushBool("xattrs", "--xattrs");
    pushVal("concatPlaylist", "--concat-playlist", ["concat_playlist"]);
    pushVal("fixup", "--fixup");
    pushVal("ffmpegLocation", "--ffmpeg-location", ["ffmpeg_location"]);
    pushArray("exec", "--exec");
    pushBool("noExec", "--no-exec"); handled.add("noExec");
    pushVal("convertSubs", "--convert-subs", ["convert_subs","convertSubs","convert-subs"]);
    pushVal("convertThumbnails", "--convert-thumbnails", ["convert_thumbnails","convertThumbnails","convert-thumbnails"]);
    pushBool("splitChapters", "--split-chapters"); handled.add("splitChapters"); handled.add("split_chapters");
    pushBool("noSplitChapters", "--no-split-chapters");
    pushArray("removeChapters", "--remove-chapters", ["remove_chapters","removeChapters"]);
    pushBool("noRemoveChapters", "--no-remove-chapters");
    pushBool("forceKeyframesAtCuts", "--force-keyframes-at-cuts"); handled.add("forceKeyframesAtCuts"); handled.add("force_keyframes_at_cuts");
    pushBool("noForceKeyframesAtCuts", "--no-force-keyframes-at-cuts");
    pushArray("usePostprocessor", "--use-postprocessor", ["use_postprocessor"]);

    pushVal("sponsorblockMark", "--sponsorblock-mark", ["sponsorblock_mark","sponsorblockMark"]);
    pushVal("sponsorblockRemove", "--sponsorblock-remove", ["sponsorblock_remove","sponsorblockRemove"]);
    pushVal("sponsorblockChapterTitle", "--sponsorblock-chapter-title", ["sponsorblock_chapter_title"]);
    pushBool("noSponsorblock", "--no-sponsorblock"); handled.add("noSponsorblock"); handled.add("no_sponsorblock");
    pushVal("sponsorblockApi", "--sponsorblock-api", ["sponsorblock_api"]);

    pushVal("extractorRetries", "--extractor-retries", ["extractor_retries"]);
    pushBool("allowDynamicMpd", "--allow-dynamic-mpd"); handled.add("allowDynamicMpd"); handled.add("allow_dynamic_mpd");
    pushBool("ignoreDynamicMpd", "--ignore-dynamic-mpd"); handled.add("ignoreDynamicMpd");
    pushBool("hlsSplitDiscontinuity", "--hls-split-discontinuity"); handled.add("hlsSplitDiscontinuity"); handled.add("hls_split_discontinuity");
    pushBool("noHlsSplitDiscontinuity", "--no-hls-split-discontinuity");

    if(options.extractorArgs || options.extractor_args){
      const ea = options.extractorArgs || options.extractor_args;
      if(typeof ea==="string" && ea.trim()) { args.push("--extractor-args", ea.trim()); handled.add("extractorArgs"); handled.add("extractor_args"); }
      else if(typeof ea==="object" && !Array.isArray(ea)){ for(const [k,v] of Object.entries(ea)){ if(v!==undefined) args.push("--extractor-args", `${k}:${v}`);} handled.add("extractorArgs"); handled.add("extractor_args"); }
      else if(Array.isArray(ea)){ ea.forEach(v=>{ if(v) args.push("--extractor-args", String(v));}); handled.add("extractorArgs"); handled.add("extractor_args"); }
    }

    pushVal("jsRuntimes", "--js-runtimes", ["js_runtimes","jsRuntimes"]);
    pushBool("noJsRuntimes", "--no-js-runtimes");

    if(options.remoteComponents || options.remote_components){
      const rc = options.remoteComponents || options.remote_components;
      if(Array.isArray(rc)) rc.forEach(v=> args.push("--remote-components", String(v)));
      else if(rc) args.push("--remote-components", String(rc));
      handled.add("remoteComponents"); handled.add("remote_components");
    }
    pushBool("noRemoteComponents", "--no-remote-components");
    pushBool("flatPlaylist", "--flat-playlist"); handled.add("flatPlaylist"); handled.add("flat_playlist");
    pushBool("noFlatPlaylist", "--no-flat-playlist");
    pushBool("liveFromStart", "--live-from-start"); handled.add("liveFromStart"); handled.add("live_from_start");
    pushBool("noLiveFromStart", "--no-live-from-start");
    pushVal("waitForVideo", "--wait-for-video", ["wait_for_video"]);
    pushBool("noWaitForVideo", "--no-wait-for-video");
    pushBool("markWatched", "--mark-watched"); handled.add("markWatched"); handled.add("mark_watched");
    pushBool("noMarkWatched", "--no-mark-watched");
    pushVal("color", "--color");
    pushVal("compatOptions", "--compat-options", ["compat_options"]);
    pushArray("alias", "--alias");
    pushVal("presetAlias", "--preset-alias", ["preset_alias","presetAlias"]);
    pushVal("defaultSearch", "--default-search", ["default_search"]);
    pushBool("ignoreConfig", "--ignore-config"); handled.add("ignoreConfig"); handled.add("ignore_config");
    pushVal("configLocations", "--config-locations", ["config_locations"]);
    pushVal("pluginDirs", "--plugin-dirs", ["plugin_dirs"]);
    pushBool("noPluginDirs", "--no-plugin-dirs");
    pushBool("yesPlaylist", "--yes-playlist");
    pushBool("noPlaylist", "--no-playlist");
    pushArray("matchFilters", "--match-filters");
    pushArray("breakMatchFilters", "--break-match-filters");


    if(options.output || options.outputTemplate || options.output_template || options.filenameFormat){
      const tmpl = options.output || options.outputTemplate || options.output_template || options.filenameFormat;


      const hasOutput = args.includes("-o") || args.includes("--output");
      if(!hasOutput && outputDir){

        handled.add("output"); handled.add("outputTemplate"); handled.add("output_template"); handled.add("filenameFormat");
      } else if(!hasOutput){
        args.push("-o", String(tmpl));
        handled.add("output"); handled.add("outputTemplate"); handled.add("output_template"); handled.add("filenameFormat");
      }
    }

    if(Array.isArray(options.extraArgs)) { options.extraArgs.forEach(a=>{ if(a) args.push(String(a)); }); handled.add("extraArgs"); handled.add("extra_args"); }
    if(Array.isArray(options.ytDlpArgs)) { options.ytDlpArgs.forEach(a=>{ if(a) args.push(String(a)); }); handled.add("ytDlpArgs"); handled.add("yt_dlp_args"); }
    if(Array.isArray(options.rawArgs)) { options.rawArgs.forEach(a=>{ if(a) args.push(String(a)); }); handled.add("rawArgs"); handled.add("raw_args"); }
    if(typeof options.extraArgs==="string" && options.extraArgs.trim()){ args.push(...options.extraArgs.trim().split(/\s+/)); handled.add("extraArgs"); }

    for(const key of Object.keys(options)){
      if(handled.has(key)) continue;

      const skip = new Set(["outputDir","filenameFormat","outputTemplate","output_template","audioFilter","maxDurationSec","cookies","cookiesFromBrowser","limitRate","sleepRequest","writeInfoJson","audioOnly","format","mergeOutputFormat","extractorArgs","extractor_args","extraArgs","ytDlpArgs","rawArgs","paths","downloadSections","download_sections","audioFormat","audioQuality","embedThumbnail","embedMetadata","embedChapters","embedSubs","writeSubs","writeAutoSubs","subLangs","convertSubs","writeThumbnail","convertThumbnails","formatSort","format_sort","cookies","listExtractors","extractorDescriptions"]);

      if(skip.has(key)) continue;
      const kebab = toKebab(key);

      const v = options[key];
      if(v===true){ args.push("--"+kebab); }
      else if(v===false){  }
      else if(typeof v==="string" && v.trim()){ args.push("--"+kebab, v); }
      else if(typeof v==="number"){ args.push("--"+kebab, String(v)); }
      else if(Array.isArray(v)){ v.forEach(e=>{ if(e!==undefined && e!==null && String(e).trim()) args.push("--"+kebab, String(e)); }); }
      else if(v && typeof v==="object"){  }

    }
  }

  async download(url, options = {}) {
    await this.ensureDeps();
    const isGallery = this._isGalleryUrl(url);
    const isTiktok = /tiktok.com|vt.tiktok.com/i.test(url);
    const isTiktokPhoto = /tiktok\.com.*\/photo\//i.test(url);
    const isInstagram = /instagram.com/i.test(url);
    const isSpotify = this._isSpotifyUrl(url);
    const isDirect = this.isDlUrl(url);
    let bin = isGallery || isTiktokPhoto || isInstagram ? this.galleryDlBin : this.ytDlpBin;
    if (isTiktokPhoto || isInstagram) bin = this.galleryDlBin;
    if (isDirect) {
      try {
        const outputDir = options.outputDir || path.join(this.baseDir, `dl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
        await this._ensureDir(outputDir);
        const buffer = await this._fetchBuf(url, { "User-Agent": "Mozilla/5.0" });
        const ext = path.extname(new URL(url).pathname) || ".mp3";
        const filePath = path.join(outputDir, `direct_audio${ext}`);
        require("fs").writeFileSync(filePath, buffer);
        return { directory: outputDir, files: [filePath] };
      } catch (e) { throw new Error(`Direct download failed: ${e.message}`); }
    }
    const outputDir = options.outputDir || path.join(this.baseDir, `dl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    await this._ensureDir(outputDir);

    const buildArgs = targetBin => {
      const args = [];

      if (options.cookies) args.push("--cookies", options.cookies);
      if (options.cookiesFromBrowser) args.push("--cookies-from-browser", options.cookiesFromBrowser);
      if (options.audioFilter && options.audioFilter !== "none") {
        const { AUDIO_FILTERS } = require("../../bot/discord/plugins/music/utils");
        const f = AUDIO_FILTERS[options.audioFilter];
        if (f && f.args) args.push("--postprocessor-args", `ffmpeg:${f.args}`);
      }
      if (targetBin === this.galleryDlBin) {
        args.push("--directory", outputDir, "--quiet");
        if (options.filenameFormat || options.outputTemplate || options.output) args.push("-f", options.filenameFormat || options.outputTemplate || options.output);
        if (options.limitRate) args.push("-r", options.limitRate);
        if (options.maxFilesize) args.push("--filesize-max", options.maxFilesize);
        if (options.sleepRequest) args.push("--sleep-request", options.sleepRequest.toString());
        if (options.writeInfoJson) args.push("--write-info-json");

        if (options.cookies) args.push("--cookies", options.cookies);

        if (options.galleryDlArgs && typeof options.galleryDlArgs==="object"){
          for(const [k,v] of Object.entries(options.galleryDlArgs)){
            if(v===true) args.push(`--${toKebab(k)}`);
            else if(v) args.push(`--${toKebab(k)}`, String(v));
          }
        }
        if (Array.isArray(options.extraArgs)) options.extraArgs.forEach(a=>{ if(a) args.push(String(a)); });
      } else {

        const format = options.format || "bv*+ba/b";
        args.push("-f", format);
        args.push("-o", path.join(outputDir, options.filenameFormat || options.outputTemplate || options.output || "%(title).50s.%(ext)s"));
        args.push("--no-playlist");

        const hasMerge = options.mergeOutputFormat || options.merge_output_format || options.mergeOutputFormat;
        if (hasMerge) args.push("--merge-output-format", String(hasMerge));
        else args.push("--merge-output-format", "mp4");
        args.push("--js-runtimes", "node", "--remote-components", "ejs:github");
        args.push("--retries", String(options.retries || 3));

        if (options.forceIpv4===false) {  } else if (options.forceIpv4) args.push("--force-ipv4"); else args.push("--force-ipv4");
        if (options.forceIpv6) args.push("--force-ipv6");

        const hasExtractorArgs = options.extractorArgs || options.extractor_args;
        if (!hasExtractorArgs) args.push("--extractor-args", "youtube:player_client=web_embedded,default,android,ios,tv");

        if (options.maxDurationSec) {
          const total = Math.max(30, Math.floor(options.maxDurationSec));
          const h = String(Math.floor(total / 3600)).padStart(2, "0");
          const m = String(Math.floor(total % 3600 / 60)).padStart(2, "0");
          const sec = String(total % 60).padStart(2, "0");
          args.push("--download-sections", `*00:00:00-${h}:${m}:${sec}`);
        }
        if (!options.maxFilesize && options.audioOnly) args.push("--max-filesize", "120M");
        if (isInstagram && !options.ignoreNoFormatsError) args.push("--ignore-no-formats-error");

        this._appendCommonDownloadOpts(args, options, outputDir, isInstagram, false);


      }
      args.push(url);
      return args;
    };

    let args = buildArgs(bin);

    try { await this._execute(bin, args, this.baseDir); }
    catch (err) {
      if (isTiktok && bin === this.ytDlpBin) {
        console.log("[TikTok] yt-dlp download failed, trying Node.js fallback...");
        if (typeof this.ttNative !== "function") throw new Error("TikTok fallback not available: ttNative is not a function");
        const fallback = await this.ttNative(url);
        if (fallback) {
          if (fallback.type === "carousel" && fallback.images && fallback.images.length > 0) {
            const filePaths = [];
            for (let i = 0; i < fallback.images.length; i++) {
              const buffer = await this._fetchBuf(fallback.images[i], { "User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36" });
              const isPng = buffer && buffer.length > 8 && buffer[1] === 80 && buffer[2] === 78 && buffer[3] === 71;
              const ext = isPng ? ".png" : ".jpg";
              const filePath = path.join(outputDir, `tiktok_slide_${i}${ext}`);
              require("fs").writeFileSync(filePath, buffer);
              filePaths.push(filePath);
            }
            return { directory: outputDir, files: filePaths };
          }
          if (fallback.url) {
            const buffer = await this._fetchBuf(fallback.url, { "User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36" });
            const filePath = path.join(outputDir, "tiktok_video.mp4");
            require("fs").writeFileSync(filePath, buffer);
            return { directory: outputDir, files: [filePath] };
          }
        }
        throw new Error(`TikTok download failed: ${err.message.substring(0, 100)}`);
      } else if (isInstagram && err.message.includes("No video formats found")) {
        const files = await this._readDir(outputDir);
        if (files.length > 0) return { directory: outputDir, files };
        throw new Error("Instagram carousel contains only images without downloadable video formats.");
      } else if (isSpotify && bin === this.ytDlpBin) { throw new Error(`Spotify download failed: ${err.message}`); }
      else throw err;
    }
    const files = await this._readDir(outputDir);
    return { directory: outputDir, files };
  }
  async _readDir(dir) {
    try {
      const dirents = await fs.readdir(dir, { withFileTypes: true });
      const files = await Promise.all(dirents.map(async dirent => {
        const res = path.resolve(dir, dirent.name);
        return dirent.isDirectory() ? this._readDir(res) : res;
      }));
      return files.flat();
    } catch { return []; }
  }
  async cleanup(dir) { await fs.rm(dir, { recursive: true, force: true }); }
}

module.exports = new MediaDownloader;
module.exports.MediaDownloader = MediaDownloader;
module.exports.OPT_FLAG_MAP = OPT_FLAG_MAP;
