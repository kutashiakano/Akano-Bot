const path = require("path");
const fs = require("fs");
const { Innertube } = require("youtubei.js");
const { Store } = require("./aesstore.js");

const DIR = path.join(__dirname, "../../../tmp/ytsession");
const TTL = 5 * 60 * 1000;

const pend = new Map();
const live = new Map();
const music = new Set();

function dir(uid) {
  return path.join(DIR, uid);
}

function mkdir() {
  fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });
}

function find(node, d = 0) {
  if (!node || d > 4) return null;
  if (node.account_name) return node;
  if (Array.isArray(node)) {
    for (const x of node) {
      const r = find(x, d + 1);
      if (r) return r;
    }
    return null;
  }
  if (typeof node === "object") {
    for (const k of Object.keys(node)) {
      const r = find(node[k], d + 1);
      if (r) return r;
    }
  }
  return null;
}

class CacheK extends Store {
  constructor(uid) {
    super(dir(uid));
  }
}

function hasCached(uid) {
  try {
    return fs.readdirSync(dir(uid)).length > 0;
  } catch {
    return false;
  }
}

function withTimeout(promise, ms, tag) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error(tag + " timeout")), ms)),
  ]);
}

function has(uid) {
  return live.has(uid) || hasCached(uid);
}

function getPend(uid) {
  return pend.get(uid) || null;
}

function clearPend(uid) {
  pend.delete(uid);
}

async function login(uid, h = {}) {
  const old = pend.get(uid);
  if (old) return old;
  mkdir();
  const yt = await Innertube.create({
    retrieve_player: false,
    cache: new CacheK(uid),
  });

  let info = null;
  const t = setTimeout(() => {
    if (pend.get(uid) === info) {
      pend.delete(uid);
      live.delete(uid);
      h.onTimeout?.();
    }
  }, TTL);

  yt.session.on("auth-pending", (d) => {
    const base = String(d.verification_url || "https://www.google.com/device");
    const code = d.user_code || "";
    let url = base;
    let directUrl = base;
    if (code) {
      const enc = encodeURIComponent(code);
      if (/google\.com/i.test(base)) {
        url = `https://www.google.com/device?user_code=${enc}`;
        directUrl = `https://accounts.google.com/o/oauth2/device/usercode?user_code=${enc}`;
      } else if (/youtube\.com/i.test(base)) {
        url = `https://www.youtube.com/activate?user_code=${enc}`;
        directUrl = `https://www.youtube.com/activate?code=${enc}&user_code=${enc}`;
      } else {
        const sep = base.includes("?") ? "&" : "?";
        url = `${base}${sep}user_code=${enc}&code=${enc}`;
        directUrl = url;
      }
    }
    info = { url, directUrl, code, at: Date.now() };
    pend.set(uid, info);
    h.onPending?.(info);
  });

  yt.session.on("auth", async () => {
    clearTimeout(t);
    pend.delete(uid);
    live.set(uid, yt);
    music.add(uid);
    try {
      await yt.session.oauth.cacheCredentials();
    } catch {}
    let name = null;
    try {
      name = (await profile(uid))?.name || null;
    } catch {}
    h.onSuccess?.({ name });
  });

  yt.session.on("auth-error", (e) => {
    clearTimeout(t);
    pend.delete(uid);
    live.delete(uid);
    h.onError?.(e);
  });

  yt.session.on("update-credentials", async () => {
    try {
      await yt.session.oauth.cacheCredentials();
    } catch {}
  });

  try {
    await yt.session.signIn();
  } catch (e) {
    clearTimeout(t);
    pend.delete(uid);
    live.delete(uid);
    h.onError?.(e);
  }
  return info;
}

async function getSession(uid) {
  if (!live.has(uid) && hasCached(uid)) {
    const yt = await withTimeout(
      Innertube.create({
        retrieve_player: false,
        cache: new CacheK(uid),
      }),
      10000,
      "session.create"
    );
    yt.session.on("auth", () => {
      live.set(uid, yt);
      music.add(uid);
    });
    await withTimeout(yt.session.signIn(), 10000, "session.signIn");
    if (!live.has(uid)) live.set(uid, yt);
    if (live.has(uid)) music.add(uid);
  } else if (live.has(uid)) {
    music.add(uid);
  }
  return live.get(uid) || null;
}

function findVal(node, key, d = 0) {
  if (!node || d > 6) return null;
  if (node[key] !== undefined) return node[key];
  if (Array.isArray(node)) {
    for (const x of node) {
      const r = findVal(x, key, d + 1);
      if (r !== null && r !== undefined) return r;
    }
    return null;
  }
  if (typeof node === "object") {
    for (const k of Object.keys(node)) {
      const r = findVal(node[k], key, d + 1);
      if (r !== null && r !== undefined) return r;
    }
  }
  return null;
}

async function profile(uid) {
  let yt;
  try {
    yt = await getSession(uid);
  } catch {
    live.delete(uid);
    try {
      fs.rmSync(dir(uid), { recursive: true, force: true });
    } catch {}
    return "__INVALID__";
  }
  if (!yt) return null;
  let info;
  try {
    info = await withTimeout(yt.account.getInfo(), 8000, "profile.info");
  } catch {
    return null;
  }
  const item = find(info?.contents);
  if (!item) return null;
  let subs = null;
  let videos = null;
  try {
    const id = item.endpoint?.payload?.browseId;
    if (id && /^UC/.test(id)) {
      const ch = await withTimeout(yt.getChannel(id), 6000, "profile.channel");
      if (ch?.header?.info?.subscribers?.text) {
        subs = ch.header.info.subscribers.text;
      }
      if (ch?.header?.info?.videos?.text) {
        videos = ch.header.info.videos.text;
      }
    }
  } catch {}

  let likes = null;
  let playlists = null;
  if (music.has(uid)) {
    try {
      const lm = await withTimeout(
        yt.actions.execute("/browse", { browseId: "LM", client: "YTMUSIC" }),
        6000,
        "profile.likes"
      );
      const data = lm?.data || lm;
      const ne = findVal(data, "numEntriesText");
      if (ne?.runs?.[0]?.text) likes = ne.runs[0].text;
      else if (ne?.text) likes = ne.text;
      else {
        const shelf = findVal(data, "musicPlaylistShelfRenderer");
        if (shelf?.contents?.length) likes = String(shelf.contents.length);
      }
    } catch {}
    try {
      const pl = await withTimeout(
        yt.actions.execute("/browse", { browseId: "FEmusic_liked_playlists", client: "YTMUSIC" }),
        6000,
        "profile.playlists"
      );
      const data = pl?.data || pl;
      const grid = findVal(data, "musicGridRenderer");
      const items = grid?.contents || [];
      playlists = items
        .map((i) => i?.gridPlaylistRenderer?.title?.runs?.[0]?.text || i?.musicNavigationButtonRenderer?.buttonText?.runs?.[0]?.text || "")
        .filter(Boolean);
    } catch {}
  }

  return {
    name: item.account_name?.text || "",
    handle: item.channel_handle?.text || "",
    byline: item.account_byline?.text || "",
    photo:
      item.account_photo?.find?.((t) => t?.url)?.url ||
      item.account_photo?.contents?.find?.((t) => t?.url)?.url ||
      "",
    subs,
    videos,
    likes,
    playlists,
  };
}

const TV_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:88.0) Gecko/20100101 Firefox/88.0";

async function tvReq(uid, endpoint, body) {
  const yt = await getSession(uid);
  const oauth2 = yt?.session?.oauth;
  const tok = oauth2?.oauth2_tokens?.access_token;
  if (!oauth2 || !tok) return null;
  const send = async (token) => {
    const res = await fetch("https://www.youtube.com/youtubei/v1/" + endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
        "X-Goog-Request-Time": String(Math.floor(Date.now() / 1000)),
        "User-Agent": TV_UA,
        Origin: "https://www.youtube.com",
      },
      body: JSON.stringify(body),
    });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  };
  let r = await send(tok);
  if (r.status === 401) {
    try {
      await oauth2.refreshAccessToken();
      r = await send(oauth2.oauth2_tokens.access_token);
    } catch (e) {
      try {
        global.logError("ytsession.tvRaw.refresh", e);
      } catch {}
      return null;
    }
  }
  if (r.status !== 200 || r.data?.error) return null;
  return r.data;
}

function tvRaw(uid, body) {
  return tvReq(uid, "browse?alt=json", body);
}

function tvTiles(data) {
  const tiles = [];
  const walk = (o) => {
    if (!o || typeof o !== "object") return;
    if (o.tileRenderer) tiles.push(o.tileRenderer);
    if (Array.isArray(o)) o.forEach(walk);
    else Object.values(o).forEach(walk);
  };
  walk(data?.contents);
  return tiles;
}

function tTitle(t) {
  const m = t?.metadata?.tileMetadataRenderer?.title;
  if (Array.isArray(m?.runs)) return m.runs.map((x) => x.text || "").join("");
  return m?.simpleText || "";
}

function findDeep(o, key) {
  if (!o || typeof o !== "object") return null;
  if (o[key]) return o[key];
  for (const k of Object.keys(o)) {
    const f = findDeep(o[k], key);
    if (f) return f;
  }
  return null;
}

const TV_CTX = {
  client: {
    clientName: "TVHTML5",
    clientVersion: "7.20240801.01.00",
    hl: "en",
    gl: "US",
  },
};

async function likes(uid, limit = 25) {
  const data = await withTimeout(
    tvRaw(uid, { context: TV_CTX, browseId: "FEmusic_liked_videos" }),
    20000,
    "list.liked",
  );
  if (!data) return [];
  const out = [];
  for (const t of tvTiles(data)) {
    const w = findDeep(t, "watchEndpoint");
    if (!w?.videoId) continue;
    out.push({ title: tTitle(t), id: w.videoId });
  }
  return out.slice(0, limit);
}

async function plists(uid, limit = 25) {
  const data = await withTimeout(
    tvRaw(uid, { context: TV_CTX, browseId: "FEmusic_liked_playlists" }),
    20000,
    "list.playlists",
  );
  if (!data) return [];
  const out = [];
  for (const t of tvTiles(data)) {
    const b = findDeep(t, "browseEndpoint");
    const id = b?.browseId || "";
    if (!id.startsWith("VL")) continue;
    out.push({ title: tTitle(t), id: id.slice(2) });
  }
  return out.slice(0, limit);
}

async function plist(uid, playlistId, limit = 25) {
  const id = String(playlistId || "").replace(/^VL/, "") || "LM";
  const data = await withTimeout(
    tvRaw(uid, { context: TV_CTX, browseId: "VL" + id }),
    20000,
    "list.playlist",
  );
  if (!data) return [];
  const out = [];
  for (const t of tvTiles(data)) {
    const w = findDeep(t, "watchEndpoint");
    if (!w?.videoId) continue;
    out.push({ title: tTitle(t), id: w.videoId });
  }
  return out.slice(0, limit);
}

async function like(uid, videoId, liked) {
  const data = await tvReq(uid, "like/like?alt=json", {
    context: TV_CTX,
    target: { videoId },
    params: liked ? "like" : "indifferent",
  });
  return !!data;
}

async function addPl(uid, playlistId, videoId) {
  const data = await tvReq(uid, "browse/edit_playlist?alt=json", {
    context: TV_CTX,
    playlistId: String(playlistId || "").replace(/^VL/, ""),
    actions: [{ action: "ACTION_ADD_VIDEO", addedVideoId: videoId }],
  });
  return !!data;
}

async function newPl(uid, title) {
  const data = await withTimeout(
    tvReq(uid, "playlist/create?alt=json", {
      context: TV_CTX,
      title: String(title || "").slice(0, 60),
      description: "",
      privacyStatus: "PRIVATE",
    }),
    15000,
    "playlist.create",
  ).catch(() => null);
  if (data?.playlistId) return { ok: true, id: data.playlistId };
  return {
    ok: false,
    message:
      "Playlist creation isn't supported with the TV sign-in used by this bot. You can still add songs to existing playlists.",
  };
}

const WEB_KEY = "AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30";
const WEB_CTX = {
  client: { clientName: "WEB_REMIX", clientVersion: "1.20240801.01.00", hl: "en", gl: "US" },
};

async function webBrowse(browseId, params) {
  try {
    const res = await fetch("https://music.youtube.com/youtubei/v1/browse?alt=json&key=" + WEB_KEY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": TV_UA,
        Origin: "https://music.youtube.com",
      },
      body: JSON.stringify({
        context: WEB_CTX,
        browseId,
        ...(params ? { params } : {}),
      }),
    });
    if (res.status !== 200) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function walk(node, fn) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    node.forEach((x) => walk(x, fn));
    return;
  }
  fn(node);
  Object.values(node).forEach((x) => walk(x, fn));
}

function shelfT(r) {
  if (Array.isArray(r?.title?.runs)) return r.title.runs.map((x) => x.text || "").join("");
  if (r?.title?.simpleText) return r.title.simpleText;
  if (Array.isArray(r?.text?.runs)) return r.text.runs.map((x) => x.text || "").join("");
  return "";
}

function idsOf(r, kind = "playlistId") {
  const ids = [];
  walk(r, (n) => {
    if (n[kind]) ids.push(n[kind]);
  });
  return [...new Set(ids)];
}

async function charts(limit = 25) {
  const j = await webBrowse("FEmusic_charts");
  if (!j) return [];
  const out = [];
  walk(j, (n) => {
    const r = n.musicTwoRowItemRenderer || n.musicResponsiveListItemRenderer;
    if (!r) return;
    const title = shelfT(r);
    if (!title) return;
    const id = idsOf(r).find((x) => !x.startsWith("RDAMPL"));
    if (!id) return;
    out.push({ title, id });
  });
  const seen = new Set();
  return out.filter((o) => (seen.has(o.id) ? false : (seen.add(o.id), true))).slice(0, limit);
}

async function moods(limit = 40) {
  const j = await webBrowse("FEmusic_moods_and_genres");
  if (!j) return [];
  const out = [];
  walk(j, (n) => {
    const r = n.musicNavigationButtonRenderer;
    if (!r) return;
    const runs = r?.buttonText?.runs;
    const title = Array.isArray(runs) ? runs.map((x) => x.text || "").join("") : "";
    const b = findDeep(r, "browseEndpoint");
    if (!title || !b?.browseId) return;
    out.push({ title, browseId: b.browseId, params: b.params || "" });
  });
  const seen = new Set();
  return out.filter((o) =>
    seen.has(o.browseId + "|" + o.params) ? false : (seen.add(o.browseId + "|" + o.params), true)
  ).slice(0, limit);
}

async function moodPls(browseId, params = "", limit = 40) {
  const j = await webBrowse(browseId, params);
  if (!j) return [];
  const out = [];
  walk(j, (n) => {
    const r = n.musicTwoRowItemRenderer || n.musicResponsiveListItemRenderer;
    if (!r) return;
    const title = shelfT(r);
    if (!title) return;
    const id = idsOf(r).find((x) => !x.startsWith("RDAMPL"));
    if (!id) return;
    out.push({ title, id });
  });
  const seen = new Set();
  return out.filter((o) => (seen.has(o.id) ? false : (seen.add(o.id), true))).slice(0, limit);
}

async function radio(uid, videoId, limit = 20) {
  const data = await tvReq(uid, "next?alt=json", {
    context: TV_CTX,
    videoId,
    playlistId: "RDAMVM" + videoId,
  });
  if (!data) return [];
  const out = [];
  walk(data, (n) => {
    const t = n.tileRenderer;
    if (!t) return;
    const w = findDeep(t, "watchEndpoint");
    if (!w?.videoId) return;
    const title = tTitle(t);
    if (!title) return;
    out.push({ title, id: w.videoId });
  });
  const seen = new Set();
  return out.filter((o) => (seen.has(o.id) ? false : (seen.add(o.id), true))).slice(0, limit);
}

async function out(uid) {
  const yt = live.get(uid);
  pend.delete(uid);
  try {
    if (yt) await yt.session.signOut();
  } catch {}
  try {
    if (yt) await yt.session.oauth.removeCache();
  } catch {}
  live.delete(uid);
  try {
    fs.rmSync(dir(uid), { recursive: true, force: true });
  } catch {}
}

module.exports = {
  login,
  out,
  getSession,
  profile,
  getPend,
  clearPend,
  has,
  likes,
  plists,
  plist,
  like,
  addPl,
  newPl,
  charts,
  moods,
  moodPls,
  radio,
  clientOf: (uid) => (music.has(uid) ? "WEB" : "TV"),
};