const http = require("http");

let server = null;
const waiters = new Map();
const PORT = Number(process.env.OAUTH_REDIRECT_PORT || 3200);

function origin() {
  return "http://127.0.0.1:" + PORT;
}

function redirectUri() {
  return "http://127.0.0.1:" + PORT + "/callback";
}

function start() {
  if (server) return origin();
  server = http.createServer((req, res) => {
    try {
      const u = new URL(req.url, "http://x");
      if (u.pathname === "/callback") {
        const state = u.searchParams.get("state") || "";
        const code = u.searchParams.get("code") || "";
        const w = waiters.get(state);
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        if (w && code) {
          waiters.delete(state);
          clearTimeout(w.timer);
          w.resolve({ code, state });
          res.end("<h3>Berhasil! Silakan kembali ke Discord.</h3>");
        } else {
          res.end(
            "<h3>Link ini sudah kedaluwarsa atau tidak dikenal. Silakan ulangi /account login.</h3>",
          );
        }
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end("<h3>AkanoBot OAuth callback server is running.</h3>");
    } catch (e) {
      try {
        res.writeHead(500);
        res.end("error");
      } catch {}
    }
  });
  server.on("error", () => {});
  server.listen(PORT, "127.0.0.1");
  return origin();
}

function waitCode(state, ttl) {
  start();
  if (waiters.has(state)) {
    return Promise.reject(new Error("Sign-in already pending."));
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      waiters.delete(state);
      const err = new Error("Sign-in timed out. Run /account login again whenever ready.");
      err.code = "ETIMEOUT";
      reject(err);
    }, ttl);
    waiters.set(state, { resolve, reject, timer });
  });
}

module.exports = { start, origin, redirectUri, waitCode };
