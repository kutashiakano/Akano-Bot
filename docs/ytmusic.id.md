# YouTube Music — Dokumentasi Lengkap (Discord) · Indonesia

Akano Bot membawa pengalaman **YouTube Music lengkap** untuk Discord yang berjalan dengan **akun YouTube milikmu sendiri** — tanpa Google API key, tanpa project Google Cloud Console, tanpa layanan pihak ketiga.

## Cara kerja sign-in (TV OAuth)

1. Pengguna menjalankan `/account login` di Discord. Bot membuat kode pairing menggunakan **alur device TV YouTube** — alur OAuth yang sama dipakai smart TV.
2. Pengguna membuka `youtube.com/pair` dan memasukkan kode pairing.
3. Token OAuth yang dihasilkan disimpan **per-user**, dienkripsi dengan `YT_SESSION_KEY`, di dalam database bot.
4. Bot me-refresh token otomatis saat kedaluwarsa. `refreshAccessToken` (dari youtubei.js) mengambil client id/secret dari `youtube.com/tv` — jadi **tidak perlu setup Google Console sama sekali**.

> [!NOTE]
> Scope TV memberi akses penuh (`youtube` + `youtube-paid-content`). Like, playlist dan radio semuanya jalan dengan token ini. Ini ditemukan dengan memanggil endpoint mentah `youtubei/v1` memakai Bearer token — parser musik resmi youtubei.js mengabaikan renderer TV (`tileRenderer`), makanya API `ytmusic.liked` polos dulu mengembalikan hasil kosong.

## Yang bisa dilakukan pengguna

| Fitur | Command | Catatan |
| --- | --- | --- |
| Masuk / keluar | `/account login`, `/account logout` | Jendela pairing 5 menit |
| Panel library pribadi | `/account` | Ephemeral — hanya terlihat pemiliknya; setiap interaksi di-gate owner |
| Lagu disukai | `/account liked` | Streaming langsung dari video yang disukai di YouTube Music |
| Playlist milikmu | `/account playlists` | Jelajahi → buka → putar atau tambah lagu |
| Like/unlike dari Discord | Tombol Like di panel `/account` dan track `/ym` | endpoint `like/like`, params `like` / `indifferent` |
| Tambah ke playlist | Tombol Add di panel library | `browse/edit_playlist` + `ACTION_ADD_VIDEO` |
| Charts | `/ym charts` | Jelajah guest `FEmusic_charts` (Trending 20, Daily Top Music Videos, Top 100, …) |
| Moods & genre | `/ym moods` | Chill, Energize, Focus, Party, Sad, Sleep, Workout + tile genre → pemilih playlist |
| Radio | `/ym radio` | Radio mulus dari track berjalan atau query apa pun (endpoint `next` + playlist `RDAMVM`) |
| Cari di library | `/lib` | Mengarahkan playlist/liked/charts lewat TV API saat sudah sign-in |

## Implementasi (`system/scrapers/src/ytsession.js`)

- **`tvReq`** — POST mentah `https://www.youtube.com/youtubei/v1/...` dengan `Authorization: Bearer <token>`, konteks klien `TVHTML5` dan UA Firefox. Auto-refresh saat HTTP 401.
- **`tvRaw`** — wrapper `browse` generik (library, playlist, detail playlist `VL<id>`).
- **`walk` / `tileTitle` / `findDeep`** — JSON walker yang mengumpulkan node `tileRenderer` persis seperti render aplikasi TV asli.
- **`likes`, `plists`, `plist`** — lagu disukai, daftar playlist (ID dikembalikan tanpa prefix `VL`), dan track satu playlist.
- **`like`, `addPl`** — like/unlike lagu, tambah video ke playlist milikmu.
- **`moods`, `moodPls`** — jelajah guest `WEB_REMIX` dengan key ytmusicapi publik; tile mood memakai `musicNavigationButtonRenderer` (judul ada di `buttonText`, dan semua mood berbagi satu `browseId` — **params**-nya yang jadi selector sebenarnya).
- **`radio`** — endpoint `next` dengan `playlistId: RDAMVM<videoId>`; track seed difilter sebelum masuk antrean.
- **`newPl`** — pembuatan playlist **sengaja diblokir** Google untuk perangkat TV (`400 Precondition check failed`), jadi dikembalikan penjelasan ramah.

## Environment variables

| Variable | Tujuan |
| --- | --- |
| `YT_SESSION_KEY` | hex 32-char untuk mengenkripsi token OAuth per-user (`openssl rand -hex 16`) |

## Pemutaran musik dengan akun

- `/p <query|url>` diputar dengan resolusi link Spotify pintar; token akun YTM dipakai otomatis saat hasil membutuhkannya.
- Keluarga `/ym` (charts, moods, radio, search) diputar langsung lewat engine (`system/bot/discord/plugins/music/engine.js`).
- State playback, antrean, volume, loop, shuffle dan autoplay disimpan ke disk dan dipulihkan setelah restart.

## Troubleshooting

| Gejala | Perbaikan |
| --- | --- |
| `/ym` bilang "sign in first" | Jalankan `/account login` sekali; charts dan moods jalan tanpa login, radio butuh akun |
| Kode pairing kedaluwarsa | Jalankan ulang `/account login` (jendela 5 menit) |
| "400 Precondition check failed" | Ini Google yang memblokir *pembuatan* playlist untuk perangkat TV — by design |
| Token invalid setelah idle lama | Jalankan ulang `/account login`; auto-refresh menangani expiry normal |
| Like tidak muncul | Pastikan sign-in dengan akun pemilik video yang di-like |

Related: [cookies.md](cookies.md) · [adding-a-plugin.md](adding-a-plugin.md) · `README` → "YouTube Music — Deep Dive"
