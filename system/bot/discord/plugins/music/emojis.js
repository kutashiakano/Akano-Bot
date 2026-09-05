const KNOWN = {
  rythmblue: "1274112410201882664",
  search: "1274113077943734394"
};

const DEFS = {
  pause: {
    names: [ "rythmblue", "rpause", "pause", "paused" ],
    id: KNOWN.rythmblue,
    label: "Pause"
  },
  play: {
    names: [ "rplay", "play", "playing" ],
    label: "Play"
  },
  search: {
    names: [ "search" ],
    id: KNOWN.search,
    label: "Search"
  },
  prev: {
    names: [ "prev", "previous", "rprev", "back" ],
    label: "Prev"
  },
  skip: {
    names: [ "skip", "rskip", "forward", "next" ],
    label: "Skip"
  },
  stop: {
    names: [ "stop", "rstop", "trash", "delete" ],
    label: "Stop"
  },
  queue: {
    names: [ "queue", "rqueue", "list" ],
    label: "Queue"
  },
  loop: {
    names: [ "loop", "rloop", "repeat" ],
    label: "Loop"
  },
  shuffle: {
    names: [ "shuffle", "rshuffle" ],
    label: "Shuffle"
  },
  lyrics: {
    names: [ "lyrics", "rlyrics", "note" ],
    label: "Lyrics"
  },
  like: {
    names: [ "like", "liked", "heart", "rlike" ],
    label: "Like"
  },
  volume: {
    names: [ "volume", "rvolume", "vol" ],
    label: "Volume"
  },
  seek: {
    names: [ "seek", "rseek", "timeline" ],
    label: "Seek"
  },
  login: {
    names: [ "login", "signin", "arrow" ],
    label: "Sign In"
  },
  logout: {
    names: [ "logout", "signout", "exit" ],
    label: "Sign Out"
  },
  playlist: {
    names: [ "playlist", "plist", "music" ],
    label: "Playlists"
  },
  refresh: {
    names: [ "refresh", "reload", "sync" ],
    label: "Refresh"
  },
  home: {
    names: [ "home", "house" ],
    label: "Home"
  }
};

function build(guild) {
  const cache = new Map;
  const lookup = new Map;
  try {
    for (const e of guild?.emojis?.cache?.values?.() || []) {
      lookup.set(e.name.toLowerCase(), `<:${e.name}:${e.id}>`);
    }
  } catch {}
  const get = key => {
    if (cache.has(key)) return cache.get(key);
    const d = DEFS[key];
    let out = "";
    if (d) {
      if (d.id) {
        const byId = guild?.emojis?.cache?.find?.(e => e.id === d.id);
        if (byId) out = `<:${byId.name}:${byId.id}>`;
      }
      if (!out) {
        for (const n of d.names || []) {
          const hit = lookup.get(n.toLowerCase());
          if (hit) {
            out = hit;
            break;
          }
        }
      }
    }
    cache.set(key, out);
    return out;
  };
  return {
    get: get,
    label: key => DEFS[key]?.label || ""
  };
}

module.exports = {
  build: build,
  DEFS: DEFS,
  KNOWN: KNOWN
};