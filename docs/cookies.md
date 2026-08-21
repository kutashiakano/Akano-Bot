# Cookies.txt — Mengunduh Media Terproteksi

Beberapa sumber memerlukan sesi login untuk mengunduh. Akano Bot membaca file `cookies.txt` di **root proyek** menggunakan format standar **Netscape HTTP Cookie File** (format yang sama yang dipakai yt-dlp dan gallery-dl).

> File `cookies.txt` sudah ada di `.gitignore` — jangan di-commit.

---

## Situs yang butuh cookies

| Sumber | Butuh cookies? | Catatan |
| --- | --- | --- |
| Instagram | ya | Reels, post, story akun private / age-gated |
| Facebook | ya | Hampir semua video |
| X / Twitter | ya | Hampir semua media |
| TikTok | opsional | Ada fallback native; cookies membantu di beberapa region |
| Pinterest | biasanya | Pin publik bisa tanpa cookies |
| YouTube / YT Music | tidak | Pakai yt-dlp + yt-dlp-ejs; tidak butuh cookies untuk media publik |

---

## Letak file — penting

**Satu-satunya lokasi yang dibaca bot adalah root proyek:**

```
Akano-Bot/
├── index.js
├── package.json
├── cookies.txt          ← taruh di sini (sejajar index.js)
├── system/
│   └── bot/
│       ├── discord/plugins/tools/downloader.js      → ../../../../../cookies.txt
│       ├── telegram/plugins/downloader/index.js     → ../../../../../cookies.txt
│       └── whatsapp/plugins/downloader/
│           ├── Instagram.js  → ../../../../../cookies.txt
│           ├── tiktok.js     → ../../../../../cookies.txt
│           └── youtube.js    → ../../../../../cookies.txt
└── docs/cookies.md
```

Penjelasan path di kode (semua resolve ke `Akano-Bot/cookies.txt`):

| File kode | Baris | Path di kode |
| --- | --- | --- |
| `system/bot/discord/plugins/tools/downloader.js` | ~221 | `path.join(__dirname, "../../../../../cookies.txt")` |
| `system/bot/telegram/plugins/downloader/index.js` | ~132 | `path.join(__dirname, "../../../../../cookies.txt")` |
| `system/bot/whatsapp/plugins/downloader/Instagram.js` | 5 | `path.join(__dirname, "../../../../../cookies.txt")` |
| `system/bot/whatsapp/plugins/downloader/tiktok.js` | 5 | `path.join(__dirname, "../../../../../cookies.txt")` |
| `system/bot/whatsapp/plugins/downloader/youtube.js` | 5 | `path.join(__dirname, "../../../../../cookies.txt")` |

> `__dirname` = folder file tersebut. `../../../../../` naik 5 level sampai root proyek. Jika file tidak ada, bot otomatis fallback ke unduhan anonim (hanya media publik).

**Jangan taruh di `system/cookies.txt` atau `system/bot/cookies.txt`** — lokasi lama tersebut sudah tidak dibaca lagi sejak unifikasi path.

---

## Cara mendapatkan `cookies.txt`

1. Install ekstensi browser yang export format Netscape — mis. [Get cookies.txt LOCALLY](https://github.com/kairi003/Get-cookies.txt-LOCALLY) (Firefox/Chrome).
2. Login ke situs tujuan (Instagram / Facebook / X) di browser tersebut.
3. Export dan **simpan sebagai `cookies.txt` di root proyek** (sejajar `index.js`).
4. Restart bot — tidak perlu konfigurasi lain.

---

## Format file

```text
# Netscape HTTP Cookie File
# https://curl.se/rfc/cookie_spec.html
# This is a generated file!  Do not edit.
.domain.com	TRUE	/	FALSE	1699999999	NAME	VALUE
```

- Satu cookie per baris, field dipisah tab: domain, flag include-subdomains, path, flag secure, expiry (unix), name, value.
- Bot meneruskan file ini langsung ke yt-dlp/gallery-dl, jadi **urutan dan field harus persis** — selalu export, jangan tulis manual.

---

## Troubleshooting

| Gejala | Solusi |
| --- | --- |
| Gagal dengan "login required" | Refresh `cookies.txt` — cookies kadaluarsa setelah **~30 hari** |
| "HTTP Error 403" di Instagram/Facebook | Re-export tepat setelah login di sesi browser fresh |
| "Invalid cookies" | Update ekstensi browser dan re-export; pastikan file diawali header `# Netscape HTTP Cookie File` |
| Error copyright / embargo | Bot tidak akan bypass blokir legal; gunakan sumber lain |
| File tidak terbaca | Pastikan path `Akano-Bot/cookies.txt` benar (cek `ls -l cookies.txt` di root), permission readable |

---

## Keamanan

- `cookies.txt` berisi token sesi — **jangan share / commit**. Sudah di-ignore git.
- Jika file hilang atau kosong, Akano Bot skip cookies dan fallback ke mode anonim.
- Ganti cookies secara berkala dan jangan pakai akun utama untuk scraping intensif.

---

## Terkait

- [cookies.en.md](cookies.en.md) — versi Bahasa Inggris
- [ytmusic.en.md](ytmusic.en.md) · [adding-a-plugin.md](adding-a-plugin.md)
