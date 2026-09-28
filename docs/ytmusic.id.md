# YouTube Music — Full Documentation (Discord) · English

Akano Bot ships a **complete YouTube Music experience** for Discord that works with **your own YouTube account** — no Google API key, no Google Cloud Console project, no third-party service.

## How sign-in works (TV OAuth)

1. The user runs `/account login` in Discord. The bot generates a pairing code using the **YouTube TV device flow** — the same OAuth flow a smart TV uses.
2. The user visits `youtube.com/pair` and enters the pairing code.
3. The resulting OAuth tokens are stored **per-user**, encrypted with `YT_SESSION_KEY`, inside the bot database.
4. The bot refreshes the token automatically when it expires. `refreshAccessToken` (from youtubei.js) scrapes the client id/secret from `youtube.com/tv` — so **no Google Console setup is needed**.

> [!NOTE]
> The TV scope grants full access (`youtube` + `youtube-paid-content`). Likes, playlists and radio all work with this token. This was found by calling the raw `youtubei/v1` endpoints with a Bearer token — the official youtubei.js music parser ignores TV renderers (`tileRenderer`), which is why the plain `ytmusic.liked` API used to return empty results.

## What the user can do

| Feature | Command | Notes |
| --- | --- | --- |
| Sign in / out | `/account login`, `/account logout` | 5-minute pairing window |
| Private library panel | `/account` | Ephemeral — visible only to the owner; every interaction is owner-gated |
| Liked songs | `/account liked` | Streamed straight from your YouTube Music liked videos |
| Your playlists | `/account playlists` | Browse → open → play or add songs |
| Like/unlike from Discord | Like button on `/account` panel and `/ym` tracks | `like/like` endpoint, params `like` / `indifferent` |
| Add to playlist | Add button in the library panel | `browse/edit_playlist` + `ACTION_ADD_VIDEO` |
| Charts | `/ym charts` | Guest browse of `FEmusic_charts` (Trending 20, Daily Top Music Videos, Top 100, …) |
| Moods & genres | `/ym moods` | Chill, Energize, Focus, Party, Sad, Sleep, Workout + genre tiles → playlist picker |
| Radio | `/ym radio` | Seamless radio built from the current track or any search query (`next` endpoint + `RDAMVM` playlist) |
| Search your library | `/lib` | Routes playlist/liked/charts through the TV API when signed in |

## Implementation (`system/scrapers/src/ytsession.js`)

- **`tvReq`** — raw `https://www.youtube.com/youtubei/v1/...` POST with `Authorization: Bearer <token>`, `TVHTML5` client context and a Firefox UA. Auto-refreshes on HTTP 401.
- **`tvRaw`** — generic `browse` wrapper (library, playlists, `VL<id>` playlist detail).
- **`walk` / `tileTitle` / `findDeep`** — JSON walkers that collect `tileRenderer` nodes the way the real TV app renders them.
- **`likes`, `plists`, `plist`** — liked songs, playlist list (IDs are returned without the `VL` prefix), and a single playlist's tracks.
- **`like`, `addPl`** — like/unlike a song, add a video to one of your playlists.
- **`moods`, `moodPls`** — guest `WEB_REMIX` browse with the public ytmusicapi key; mood tiles use `musicNavigationButtonRenderer` (the title lives in `buttonText`, and every mood shares one `browseId` — the **params** is the actual selector).
- **`radio`** — `next` endpoint with `playlistId: RDAMVM<videoId>`; the seed track is filtered out before enqueueing.
- **`newPl`** — playlist **creation** is deliberately blocked by Google for TV devices (`400 Precondition check failed`), so it returns a friendly explanation instead.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `YT_SESSION_KEY` | 32-char hex used to encrypt per-user OAuth tokens (`openssl rand -hex 16`) |

## Music playback with the account

- `/p <query|url>` plays with smart Spotify-link resolution; the YTM account token is used automatically when the result needs it.
- `/ym` family (charts, moods, radio, search) plays directly through the engine (`system/bot/discord/plugins/music/engine.js`).
- Playback, queue, volume, loop, shuffle and autoplay state are saved to disk and restored after restart.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `/ym` says "sign in first" | Run `/account login` once; charts and moods work without login, radio needs an account |
| Pairing code expired | Re-run `/account login` (5-minute window) |
| "400 Precondition check failed" | This is Google blocking playlist *creation* for TV devices — by design |
| Token invalid after a long idle | Re-run `/account login`; auto-refresh handles normal expiry |
| Likes not appearing | Ensure you signed in with the account that owns the liked videos |

Related: [docs/cookies.id.md](cookies.id.md) · [docs/adding-a-plugin.id.md](adding-a-plugin.id.md) · `README` → "YouTube Music — Deep Dive"