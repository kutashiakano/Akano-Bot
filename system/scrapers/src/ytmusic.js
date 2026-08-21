let _yt = null;
let _connecting = null;

function _requireInnertube() {
  return require("youtubei.js").Innertube;
}

async function _getClient(session) {
  if (session) return session;
  if (_yt) return _yt;
  if (_connecting) return _connecting;
  _connecting = _requireInnertube()
    .create({ retrieve_player: false })
    .then((yt) => {
      _yt = yt;
      return yt;
    })
    .finally(() => {
      _connecting = null;
    });
  return _connecting;
}

function _toSong(item) {
  if (!item) return null;
  const thumb = item.thumbnail?.contents?.find((t) => t?.url)?.url || "";
  return {
    id: item.id || "",
    title: item.title?.text || item.title || "Unknown",
    artist: item.artists?.[0]?.name || item.author?.name || "Unknown",
    artists: (item.artists || []).map((a) => a.name),
    album: item.album?.name || "",
    duration: item.duration?.seconds || 0,
    year: item.year || null,
    thumbnail: thumb,
    url: item.id ? `https://music.youtube.com/watch?v=${item.id}` : "",
  };
}

async function sSongs(query, limit = 10, session = null) {
  const q = String(query || "").trim();
  if (!q) return [];
  const attempts = session ? [session, null] : [null];
  for (const client of attempts) {
    try {
      const yt = await _getClient(client);
      const search = await yt.music.search(q, { type: "song" });
      const shelves = Object.values(search.contents || {}).filter(
        (x) => x?.type === "MusicShelf",
      );
      const items = [];
      for (const shelf of shelves) {
        for (const song of shelf.contents || []) {
          if (song?.type !== "MusicResponsiveListItem") continue;
          const mapped = _toSong(song);
          if (mapped && mapped.id) items.push(mapped);
          if (items.length >= limit) return items;
        }
      }
      return items;
    } catch (e) {
      if (!client || !session) throw e;
    }
  }
  return [];
}

async function getRelated(videoId, limit = 10, session = null, enrich = true) {
  const yt = await _getClient(session);
  const related = await yt.music.getRelated(videoId);
  const sections = Array.isArray(related?.contents)
    ? related.contents
    : Object.values(related?.contents || {});
  const items = [];
  for (const sec of sections) {
    if (sec?.type !== "MusicCarouselShelf") continue;
    for (const item of Object.values(sec.contents || {})) {
      if (item?.type !== "MusicResponsiveListItem") continue;
      const mapped = _toSong(item);
      if (mapped && mapped.id) items.push(mapped);
      if (items.length >= limit) break;
    }
    if (items.length >= limit) break;
  }
  if (!enrich) return items.slice(0, limit);

  const enriched = await Promise.all(
    items.map(async (song) => {
      try {
        const info = await yt.getBasicInfo(song.id);
        const basic = info?.basic_info || {};
        if (basic.is_live) return null;
        return { ...song, duration: basic.duration || song.duration };
      } catch (e) {
        return song;
      }
    }),
  );

  return enriched.filter(Boolean).slice(0, limit);
}

async function getTrack(id) {
  const yt = await _getClient();
  const info = await yt.music.getInfo(id);
  const basic = info?.basic_info || {};
  const thumb = basic.thumbnail?.[0]?.url || "";
  return {
    id: basic.id || id,
    title: basic.title || "Unknown",
    artist: basic.author || "Unknown",
    album: basic.album || "",
    duration: basic.duration || 0,
    year: basic.year || null,
    thumbnail: thumb,
    url: basic.id ? `https://music.youtube.com/watch?v=${basic.id}` : "",
  };
}

async function searchSuggestions(query, limit = 8) {
  try {
    const yt = await _getClient();
    const suggestions = await yt.music.getSearchSuggestions(query);
    const items = suggestions?.contents || suggestions?.suggestions || [];
    const list = Array.isArray(items) ? items : Object.values(items);
    return list
      .filter((s) => s?.text || s?.title?.text)
      .map((s) => s.text || s.title.text)
      .slice(0, limit);
  } catch (e) {
    return [];
  }
}

function _map(node) {
  if (!node) return null;
  const id =
    node.id ||
    node.playlistId ||
    node.browseId ||
    node.endpoint?.payload?.browseId ||
    node.endpoint?.payload?.playlistId ||
    "";
  if (!id) return null;
  const item_type = node.item_type || "song";
  const title = node.title?.text || node.title || "";
  const artist =
    node.artist?.name ||
    node.artists?.[0]?.name ||
    node.subtitle?.text ||
    "Unknown";
  return {
    id,
    type: item_type,
    name: title,
    title,
    artist,
    duration: node.duration?.seconds || 0,
    url: `https://music.youtube.com/watch?v=${id}`,
    thumbnail:
      node.thumbnails?.[0]?.url ||
      node.thumbnail?.contents?.find((t) => t?.url)?.url ||
      "",
  };
}

function _items(res) {
  return Array.isArray(res?.contents) ? res.contents : Object.values(res?.contents || {});
}

function _walk(node, cb, d = 0) {
  if (!node || d > 3) return;
  if (Array.isArray(node)) {
    for (const x of node) _walk(x, cb, d + 1);
    return;
  }
  if (typeof node === "object") {
    cb(node);
    for (const v of Object.values(node)) _walk(v, cb, d + 1);
  }
}

function _walkRaw(node, cb) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const x of node) _walkRaw(x, cb);
    return;
  }
  cb(node);
  for (const v of Object.values(node)) _walkRaw(v, cb);
}

function _cols(r) {
  return (r.flexColumns || [])
    .map((c) =>
      (c.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [])
        .map((x) => x.text || "")
        .join(""),
    )
    .filter(Boolean);
}

function _meta(cols) {
  const title = cols[0] || "";
  const artist = (cols[1] || "").split("•")[0].trim();
  const dur = cols.join(" ").match(/(\d+):(\d{2})/);
  return {
    title,
    artist,
    duration: dur ? Number(dur[1]) * 60 + Number(dur[2]) : 0,
  };
}

function _fromRaw(node) {
  const r = node.musicResponsiveListItemRenderer;
  if (!r) return null;
  const ep = r.navigationEndpoint || {};
  const cols = _cols(r);
  const { title, artist, duration } = _meta(cols);
  const thumbs = r.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
  let type = "song";
  if (ep.browseEndpoint) {
    const id = ep.browseEndpoint.browseId || "";
    if (id.startsWith("MPRE")) type = "album";
    else if (id.startsWith("VL")) type = "playlist";
    else if (id.startsWith("UC")) type = "artist";
  }
  const id =
    r.playlistItemData?.videoId ||
    ep.watchEndpoint?.videoId ||
    ep.browseEndpoint?.browseId ||
    ep.playlistEditEndpoint?.playlistId ||
    "";
  if (!id || !title) return null;
  const badges = (r.badges || [])
    .map((b) => b.musicInlineBadgeRenderer?.label?.runs?.[0]?.text || "")
    .join(" ");
  if (/podcast|🎙/i.test(badges + " " + title + " " + artist)) return null;
  return {
    id,
    type,
    name: title,
    title,
    artist,
    duration,
    url: `https://music.youtube.com/watch?v=${id}`,
    thumbnail: thumbs.length ? thumbs[thumbs.length - 1].url || "" : "",
  };
}

const paramsCache = new Map();

async function typeParams(session) {
  const key = session ? "s" : "a";
  if (paramsCache.has(key)) return paramsCache.get(key);
  const yt = await _getClient(session);
  const res = await yt.actions.execute("/search", {
    query: "akano test",
    client: "YTMUSIC",
    parse: false,
  });
  const map = {};
  _walkRaw(res?.data, (node) => {
    const chip = node.chipCloudChipRenderer;
    if (!chip) return;
    const label = (chip.text?.runs || [])
      .map((x) => x.text || "")
      .join("")
      .toLowerCase()
      .replace(/s$/, "");
    const params = chip.navigationEndpoint?.searchEndpoint?.params;
    if (!params) return;
    if (label === "song" || label === "video" || label === "album") map[label] = params;
    else if (label === "profile" || label === "profiles" || label === "artist") map.artist = params;
    else if (label === "community playlist" || label === "playlist") map.playlist = params;
  });
  paramsCache.set(key, map);
  return map;
}

async function rawSearch(query, limit = 20, session = null, type = null) {
  const q = String(query || "").trim();
  if (!q) return [];
  const attempts = session ? [session, null] : [null];
  for (const client of attempts) {
    try {
      const yt = await _getClient(client);
      let params = null;
      if (type) {
        const map = await typeParams(client);
        params = map[type];
      }
      const res = await yt.actions.execute("/search", {
        query: q,
        client: "YTMUSIC",
        params,
        parse: false,
      });
      const out = [];
      _walkRaw(res?.data, (node) => {
        if (out.length >= limit) return;
        const m = _fromRaw(node);
        if (m) out.push(m);
      });
      return out;
    } catch (e) {
      if (!client || !session) throw e;
    }
  }
  return [];
}

async function searchType(query, type = "song", limit = 10, session = null) {
  const want = type === "video" ? "video" : type;
  let list = await rawSearch(query, limit, session, want);
  if (!list.length && type === "song") {
    list = await rawSearch(query, 150, session);
    const out = [];
    for (const m of list) {
      if (m.type !== "song") continue;
      out.push(m);
      if (out.length >= limit) break;
    }
    return out;
  }
  return list;
}

function _plistRow(r) {
  const vid =
    r.playlistItemData?.videoId ||
    r.navigationEndpoint?.watchEndpoint?.videoId ||
    "";
  if (!vid) return null;
  const { title, artist, duration } = _meta(_cols(r));
  if (!title) return null;
  const thumbs = r.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
  return {
    id: vid,
    title,
    artist,
    duration,
    url: `https://music.youtube.com/watch?v=${vid}`,
    thumbnail: thumbs.length ? thumbs[thumbs.length - 1].url || "" : "",
  };
}

async function plist(id, limit = 20, session = null) {
  const attempts = session ? [session, null] : [null];
  for (const client of attempts) {
    try {
      const yt = await _getClient(client);
      const res = await yt.actions.execute("/browse", {
        browseId: "VL" + String(id || "").replace(/^VL/, ""),
        client: "YTMUSIC",
        parse: false,
      });
      let shelf = null;
      _walkRaw(res?.data, (node) => {
        if (!shelf && node.musicPlaylistShelfRenderer) shelf = node.musicPlaylistShelfRenderer;
      });
      if (!shelf) return [];
      const out = [];
      for (const c of shelf.contents || []) {
        const r = c.musicResponsiveListItemRenderer;
        if (!r) continue;
        const m = _plistRow(r);
        if (!m) continue;
        out.push(m);
        if (out.length >= limit) break;
      }
      return out;
    } catch (e) {
      if (!client || !session) throw e;
    }
  }
  return [];
}

async function liked(limit = 10, session) {
  if (!session) return [];
  return plist("LM", limit, session);
}

async function picks(limit = 10, session) {
  if (!session) return [];
  try {
    const yt = await _getClient(session);
    const home = await yt.music.getHomeFeed();
    const out = [];
    for (const shelf of _items(home.contents)) {
      if (shelf?.type !== "MusicCarouselShelf") continue;
      for (const node of _items(shelf.contents)) {
        if (node?.type !== "MusicTwoRowItem" || !node.id) continue;
        out.push({
          id: node.id,
          title: node.title?.text || "",
          artist: node.subtitle?.text || node.artists?.[0]?.name || "",
          duration: 0,
          url: `https://music.youtube.com/watch?v=${node.id}`,
          thumbnail:
            node.thumbnail?.contents?.find((t) => t?.url)?.url ||
            node.thumbnails?.[0]?.url ||
            "",
        });
        if (out.length >= limit) return out;
      }
    }
    return out;
  } catch (e) {
    return [];
  }
}

async function libs(limit = 10, session) {
  if (!session) return [];
  try {
    const yt = await _getClient(session);
    const lib = await yt.music.getLibrary();
    const out = [];
    _walk(lib.contents, (node) => {
      const pid = node.playlistId || node.endpoint?.payload?.playlistId;
      const name = node.title?.text || "";
      if (!pid || !name) return;
      out.push({ id: pid, name, thumbnail: "" });
    });
    if (out.length > limit) return out.slice(0, limit);
    return out;
  } catch (e) {
    return [];
  }
}

async function like(session, videoId, like, client = "TV") {
  if (!session) throw new Error("No authenticated session.");
  if (!session.session?.logged_in) {
    throw new Error("Your login is no longer valid. Use /account logout then /account login again.");
  }
  const action = like ? "like" : "removelike";
  const r = await session.actions.execute("/like/" + action, {
    target: { videoId },
    client,
    parse: false,
  });
  if (!r || r.status_code !== 200) {
    throw new Error(
      "YouTube rejected the request. Your login may be invalid - use /account logout then /account login again.",
    );
  }
}

async function radio(videoId, session = null) {
  const yt = await _getClient(session);
  const r = await yt.actions.execute("/next", {
    videoId,
    playlistId: "RDAMVM" + videoId,
    client: "YTMUSIC",
    parse: false,
  });
  const panel =
    r?.data?.contents?.singleColumnMusicWatchNextResultsRenderer?.tabbedRenderer
      ?.watchNextTabbedResultsRenderer?.tabs?.[0]?.tabRenderer?.content
      ?.musicQueueRenderer?.content?.playlistPanelRenderer;
  const items = [];
  const seen = new Set();
  for (const c of panel?.contents || []) {
    const v = c?.playlistPanelVideoRenderer;
    if (!v?.videoId || seen.has(v.videoId) || v.videoId === videoId) continue;
    seen.add(v.videoId);
    const title = v?.title?.runs?.[0]?.text || v?.title?.simpleText || "";
    if (!title) continue;
    const artist = (v?.longBylineText?.runs || [])
      .map((x) => x.text || "")
      .join("")
      .split("•")[0]
      .trim();
    const lenTxt = String(v?.lengthText?.runs?.[0]?.text || v?.lengthText?.simpleText || "");
    const len = lenTxt.match(/(\d+):(\d{1,2})/) || lenTxt.match(/(\d+)\.(\d{1,2})/);
    items.push({
      id: v.videoId,
      title,
      artist,
      duration: len ? Number(len[1]) * 60 + Number(len[2]) : 0,
      thumbnail:
        v?.thumbnail?.thumbnails?.[(v?.thumbnail?.thumbnails?.length || 1) - 1]?.url || "",
      url: "https://music.youtube.com/watch?v=" + v.videoId,
    });
  }
  return items;
}

module.exports = {
  sSongs,
  getRelated,
  getTrack,
  searchSuggestions,
  rawSearch,
  searchType,
  plist,
  liked,
  picks,
  libs,
  like,
  radio,
};
