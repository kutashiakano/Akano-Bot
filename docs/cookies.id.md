# Cookies.txt — Downloading Protected Media (English)

Some sources require a login session to download. Akano Bot reads a `cookies.txt` from the project root using the standard **Netscape HTTP Cookie File** format (the same format yt-dlp and gallery-dl accept natively).

## Which sites need it

| Source | Cookies required | Notes |
| --- | --- | --- |
| Instagram | yes | Reels, posts, stories of private/age-gated accounts |
| Facebook | yes | Most videos |
| X / Twitter | yes | Most media |
| TikTok | optional | Native fallback exists; cookies help with some regions |
| Pinterest | usually | Public pins work without |
| YouTube / YT Music | no | Uses yt-dlp + yt-dlp-ejs; no cookies needed for public media |

## File location — important

**The only location the bot reads is the project root:**

```
Akano-Bot/
├── index.js
├── package.json
├── cookies.txt          ← put it here (next to index.js)
├── system/
│   └── bot/
│       ├── discord/plugins/tools/downloader.js      → ../../../../../cookies.txt
│       ├── telegram/plugins/downloader/index.js     → ../../../../../cookies.txt
│       └── whatsapp/plugins/downloader/
│           ├── Instagram.js  → ../../../../../cookies.txt
│           ├── tiktok.js     → ../../../../../cookies.txt
│           └── youtube.js    → ../../../../../cookies.txt
└── docs/cookies.id.md
```

Code paths (all resolve to `Akano-Bot/cookies.txt`):

| Code file | Line | Path in code |
| --- | --- | --- |
| `system/bot/discord/plugins/tools/downloader.js` | ~221 | `path.join(__dirname, "../../../../../cookies.txt")` |
| `system/bot/telegram/plugins/downloader/index.js` | ~132 | `path.join(__dirname, "../../../../../cookies.txt")` |
| `system/bot/whatsapp/plugins/downloader/Instagram.js` | 5 | `path.join(__dirname, "../../../../../cookies.txt")` |
| `system/bot/whatsapp/plugins/downloader/tiktok.js` | 5 | `path.join(__dirname, "../../../../../cookies.txt")` |
| `system/bot/whatsapp/plugins/downloader/youtube.js` | 5 | `path.join(__dirname, "../../../../../cookies.txt")` |

> `__dirname` = folder of that file. `../../../../../` goes up 5 levels to the project root. If the file is missing, the bot falls back to anonymous downloads (public media only).

**Do not put it in `system/cookies.txt` or `system/bot/cookies.txt`** — those legacy locations are no longer read after path unification.

---

## Obtaining `cookies.txt`

1. Install a browser extension that exports cookies in the Netscape format — e.g. [Get cookies.txt LOCALLY](https://github.com/kairi003/Get-cookies.txt-LOCALLY) (Firefox/Chrome).
2. Log in to the site (Instagram / Facebook / X).
3. Export and save as `cookies.txt` in the **project root** (next to `index.js`).
4. Restart the bot — no other configuration required.

## Format

```text
# Netscape HTTP Cookie File
# https://curl.se/rfc/cookie_spec.html
# This is a generated file!  Do not edit.
.domain.com	TRUE	/	FALSE	1699999999	NAME	VALUE
```

- One cookie per line, fields separated by tabs: domain, include-subdomains flag, path, secure flag, expiry (unix), name, value.
- The bot passes this file directly to yt-dlp/gallery-dl, so **order and exact fields matter** — always export, never hand-write.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Download fails with "login required" | Refresh `cookies.txt` — cookies expire after **~30 days** |
| "HTTP Error 403" on Instagram/Facebook | Re-export right after logging in on a fresh browser session |
| "Invalid cookies" | Update your browser extension and re-export; check the file starts with the `# Netscape HTTP Cookie File` header |
| File not found | Verify `Akano-Bot/cookies.txt` exists (`ls -l cookies.txt` at root), readable permissions |
| Copyright/embargo errors | The bot will not bypass legal blocks; use a different source |

## Security

- `cookies.txt` contains your session tokens — **do not commit it**. It is gitignored.
- If the file is missing or empty, Akano Bot simply skips it and falls back to anonymous downloads (public media only).

Related: [cookies.md](cookies.md) — Indonesian version · [docs/ytmusic.id.md](ytmusic.id.md) · [docs/adding-a-plugin.id.md](adding-a-plugin.id.md)