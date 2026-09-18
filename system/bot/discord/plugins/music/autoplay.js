const ytmusic = require("../../../../scrapers/src/ytmusic.js");

const AUTOPLAY_GENRES = {
  pop: {
    label: "Pop",
    queries: [ "pop hits 2024", "top pop songs", "pop music official", "viral pop hits" ]
  },
  rock: {
    label: "Rock",
    queries: [ "rock music playlist", "best rock songs", "rock classics", "alternative rock hits" ]
  },
  hiphop: {
    label: "Hip-Hop",
    queries: [ "hip hop mix 2024", "rap hits 2024", "trap music playlist", "best rap songs" ]
  },
  electronic: {
    label: "Electronic",
    queries: [ "edm music mix", "electronic dance music", "house music official", "techno music" ]
  },
  jazz: {
    label: "Jazz",
    queries: [ "jazz cafe music", "smooth jazz playlist", "jazz instrumental", "lofi jazz" ]
  },
  classical: {
    label: "Classical",
    queries: [ "classical music focus", "piano classical music", "orchestra classical", "classical relaxation" ]
  },
  metal: {
    label: "Metal",
    queries: [ "metal music playlist", "heavy metal hits", "metalcore playlist", "death metal music" ]
  },
  country: {
    label: "Country",
    queries: [ "country music hits", "country playlist 2024", "country songs official", "acoustic country" ]
  },
  rnb: {
    label: "R&B",
    queries: [ "r&b soul chill mix", "neo soul playlist", "r&b hits 2024", "r&b slow jams" ]
  },
  indie: {
    label: "Indie",
    queries: [ "indie pop playlist", "alternative indie mix", "indie music 2024", "indie folk music" ]
  },
  latin: {
    label: "Latin",
    queries: [ "latin music hits", "reggaeton playlist", "latin pop songs", "spanish music hits" ]
  },
  kpop: {
    label: "K-Pop",
    queries: [ "kpop playlist 2024", "best kpop hits", "korean music official", "kpop dance music" ]
  },
  anime: {
    label: "Anime",
    queries: [ "anime opening official", "anime songs official", "best anime op", "anime music playlist" ]
  },
  lofi: {
    label: "Lo-Fi",
    queries: [ "lofi hip hop chill", "lofi beats study music", "chill lofi music", "lofi relaxing beats" ]
  },
  blues: {
    label: "Blues",
    queries: [ "blues music playlist", "blues classics", "electric blues music", "blues guitar music" ]
  },
  reggae: {
    label: "Reggae",
    queries: [ "reggae music playlist", "reggae hits", "bob marley style music", "reggae chill music" ]
  },
  disco: {
    label: "Disco",
    queries: [ "disco music hits", "disco classics", "funk disco music", "disco party music" ]
  },
  punk: {
    label: "Punk",
    queries: [ "punk rock music", "punk playlist", "punk hits", "punk classics" ]
  },
  ambient: {
    label: "Ambient",
    queries: [ "ambient music relaxing", "ambient soundscape", "ambient study music", "ambient meditation" ]
  },
  random: {
    label: "Random",
    queries: [ "lofi hip hop chill", "top hits 2024", "edm music mix", "acoustic guitar covers", "kpop playlist 2024", "jazz cafe music", "rock music playlist", "chill vibes music" ]
  }
};

function pickAutoplayQuery(genre) {
  if (genre && AUTOPLAY_GENRES[genre]) {
    const queries = AUTOPLAY_GENRES[genre].queries;
    return queries[Math.floor(Math.random() * queries.length)];
  }
  const genreKeys = Object.keys(AUTOPLAY_GENRES);
  const randomGenre = genreKeys[Math.floor(Math.random() * genreKeys.length)];
  const queries = AUTOPLAY_GENRES[randomGenre].queries;
  return queries[Math.floor(Math.random() * queries.length)];
}

const TAG_GENRE_MAP = [ [ "pop", "pop" ], [ "rnb", "rnb" ], [ "r&b", "rnb" ], [ "hip hop", "hiphop" ], [ "hip-hop", "hiphop" ], [ "rap", "hiphop" ], [ "trap", "hiphop" ], [ "rock", "rock" ], [ "metal", "metal" ], [ "punk", "punk" ], [ "indie", "indie" ], [ "alternative", "indie" ], [ "electronic", "electronic" ], [ "edm", "electronic" ], [ "dance", "electronic" ], [ "house", "electronic" ], [ "techno", "electronic" ], [ "deep house", "electronic" ], [ "lofi", "lofi" ], [ "lo-fi", "lofi" ], [ "chill", "lofi" ], [ "jazz", "jazz" ], [ "blues", "blues" ], [ "folk", "indie" ], [ "classical", "classical" ], [ "piano", "classical" ], [ "orchestra", "classical" ], [ "country", "country" ], [ "latin", "latin" ], [ "reggaeton", "latin" ], [ "reggae", "reggae" ], [ "k-pop", "kpop" ], [ "kpop", "kpop" ], [ "anime", "anime" ], [ "j-pop", "kpop" ], [ "disco", "disco" ], [ "funk", "disco" ], [ "soul", "rnb" ], [ "ambient", "ambient" ], [ "soundtrack", "ambient" ], [ "gospel", "rnb" ], [ "acoustic", "indie" ] ];

function tagsToGenre(tags) {
  const hay = String((tags || []).join(" ")).toLowerCase();
  for (const [key, genre] of TAG_GENRE_MAP) {
    if (hay.includes(key)) return genre;
  }
  return null;
}

function normTitle(t) {
  return String(t || "").toLowerCase().replace(/\[.*?\]|\(.*?\)/g, " ").replace(/\b(official video|official audio|official music video|official lyric video|official lyrics|lyrics|audio|video|hd|4k|live)\b/g, " ").replace(/\s+/g, " ").trim();
}

function vidOf(url) {
  const m = String(url || "").match(/[?&]v=([\w-]{6,})/);
  return m ? m[1] : null;
}

async function smartRec(queue) {
  try {
    const vid = vidOf(queue.currentSong?.url);
    if (!vid) return null;
    let tracks = null;
    for (let attempt = 0; attempt < 2 && !tracks; attempt++) {
      try {
        tracks = await ytmusic.radio(vid, null);
      } catch (e) {
        if (attempt === 0) await new Promise(r => setTimeout(r, 1500));
      }
    }
    if (!tracks || !tracks.length) return null;
    const recentHistory = new Set(queue.history.slice(-12));
    const seenTitles = new Set([ normTitle(queue.currentSong?.title) ]);
    for (const s of queue.songs || []) {
      const t = normTitle(s.title);
      if (t) seenTitles.add(t);
    }
    for (const t of tracks) {
      const url = t.url;
      if (recentHistory.has(url)) continue;
      const nt = normTitle(t.title);
      if (!nt || seenTitles.has(nt)) continue;
      seenTitles.add(nt);
      return {
        title: t.title,
        url: url,
        webpage_url: url,
        thumbnail: t.thumbnail || "",
        duration: t.duration || 0,
        uploader: t.artist || "Unknown",
        channel: t.artist || "Unknown",
        album: "",
        year: null,
        source: "Auto"
      };
    }
    const first = tracks.find(t => t.url && t.title);
    if (first) {
      return {
        title: first.title,
        url: first.url,
        webpage_url: first.url,
        thumbnail: first.thumbnail || "",
        duration: first.duration || 0,
        uploader: first.artist || "Unknown",
        channel: first.artist || "Unknown",
        album: "",
        year: null,
        source: "Auto"
      };
    }
    return null;
  } catch (e) {
    global.logError("dc.music.autoplay.recommend", e);
    return null;
  }
}

async function autoFill(queue) {
  if (queue.autoBusy) return;
  queue.autoBusy = true;
  try {
    let attempts = 0;
    while (queue.songs.length === 0 && attempts < 3) {
      attempts++;
      const info = await smartRec(queue);
      if (info) {
        queue.songs.push({
          title: info.title || "Unknown",
          url: info.webpage_url || info.url || info.original_url,
          thumbnail: info.thumbnail || "",
          duration: info.duration || 0,
          uploader: info.uploader || info.channel || "Unknown",
          requester: "Autoplay",
          source: "Autoplay"
        });
      }
    }
  } catch (e) {
    global.logError("dc.music.autoplay.enqueue", e);
  } finally {
    queue.autoBusy = false;
  }
}

module.exports = {
  AUTOPLAY_GENRES: AUTOPLAY_GENRES,
  pickAutoplayQuery: pickAutoplayQuery,
  tagsToGenre: tagsToGenre,
  smartRec: smartRec,
  autoFill: autoFill
};