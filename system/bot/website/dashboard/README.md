# Akano Bot — Owner Dashboard

Web-based owner control center. Dark editorial UI, zero new npm dependencies (Node built-in `http` only), SSE realtime.

## Start

Dashboard starts automatically with the bot when enabled (`website.enabled !== false` in overlay):

```bash
bash akano-bot.sh            # dashboard on http://127.0.0.1:3001
```

Standalone (from anywhere):

```bash
node system/bot/website/index.js
```

First boot prints a one-time **access key** to console. Set `DASHBOARD_KEY` in `~/.akano-env` to use your own key instead. The key is stored only as SHA-256 hash in `system/database/dashboard-auth.json`.

## Modes

- **local** (default): binds `127.0.0.1` — safe, no exposure.
- **online**: binds `0.0.0.0` for LAN/reverse proxy. Authentication stays mandatory. Change via Settings page → save → restart dashboard process.

## Tunnel

No tunnel provider ships with the bot. If `cloudflared` is installed:

```bash
cloudflared tunnel --url http://127.0.0.1:3001
```

The Tunnel page shows honest status; start/stop buttons return "unavailable" until a provider binary exists (provider abstraction ready in `/api/tunnel/*`).

## Settings editor

Edits are a validated overlay stored at `system/database/dashboard-settings.json`, deep-merged over `settings.js` globals at runtime and reapplied after every reload. Each save auto-backups the previous overlay (last 10 kept) and appends to the audit log. Restore is one click from Settings → Backups.

Never store tokens/API keys here — secrets belong in `~/.akano-env`.

## Maintenance mode

Settings → maintenance ON blocks normal command processing on Discord + Telegram for non-owners. WhatsApp enforcement is not wired yet (documented limitation).

## Security model

- Session cookie `HttpOnly SameSite=Strict`, 12h TTL, server-side session map
- Login rate limiting per IP with fail-streak lockout
- All state-changing endpoints POST-only behind auth
- Static file serving blocked from path traversal
- Logs/messages pass through secret redaction before display
- No arbitrary command execution endpoint exists by design

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `[dashboard] failed: listen EADDRINUSE` | Another instance holds the port; change `ws_port` or kill old process |
| Forgot access key | Delete `system/database/dashboard-auth.json`, restart, read new key from console |
| Page 401 loop | Cookie expired — login again |
| Dashboard down but bot alive | By design: init failures never crash the bot |
