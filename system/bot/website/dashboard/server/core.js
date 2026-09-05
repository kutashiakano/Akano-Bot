const http = require("http");
const fs = require("fs");
const path = require("path");
const auth = require("../../../whatsapp/lib/adapter");
const bus = require("./bus");
const store = require("./store");
const api = require("./api");
const crypto = require("crypto");

const CLIENT_DIR = path.join(__dirname, "..", "client");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json"
};

function sendJson(res, code, data) {
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(data));
}

function serveStatic(req, res, urlPath) {
  const rel = urlPath === "/" ? "/index.html" : urlPath;
  const safe = path.normalize(rel).replace(/^(\.\.[\/\\])+/, "");
  const full = path.join(CLIENT_DIR, safe);
  if (!full.startsWith(CLIENT_DIR)) {
    res.writeHead(403);
    return res.end("forbidden");
  }
  fs.readFile(full, (err, data) => {
    if (err) {
      res.writeHead(404, {
        "Content-Type": "text/plain"
      });
      return res.end("not found");
    }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(full)] || "application/octet-stream",
      "Cache-Control": "no-cache"
    });
    res.end(data);
  });
}

function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", c => {
      size += c.length;
      if (size > limit) {
        reject(new Error("payload too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function handleSse(req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-store",
    Connection: "keep-alive"
  });
  res.write(":connected\n\n");
  const onEvent = evt => {
    try {
      res.write(`event: ${evt.type}\ndata: ${JSON.stringify(evt)}\n\n`);
    } catch {}
  };
  bus.bus.on("event", onEvent);
  const ping = setInterval(() => {
    try {
      res.write(":ping\n\n");
    } catch {}
  }, 25e3);
  req.on("close", () => {
    clearInterval(ping);
    bus.bus.off("event", onEvent);
  });
}

async function handler(req, res) {
  const url = new URL(req.url, "http://localhost");
  const p = url.pathname;
  const ip = auth.clientIp(req);
  try {
    if (!auth.rateLimited(ip)) {}
    if (p === "/api/login" && req.method === "POST") {
      let body = {};
      try {
        body = JSON.parse(await readBody(req));
      } catch {}
      if (auth.tooManyLogins(ip)) {
        return sendJson(res, 429, {
          ok: false,
          message: "Too many attempts. Wait a few minutes."
        });
      }
      const ok = store.verifyKey(body.key || "");
      auth.recordLoginResult(ip, ok);
      if (!ok) {
        store.audit("login", "failed", ip);
        return sendJson(res, 401, {
          ok: false,
          message: "Invalid key."
        });
      }
      const token = auth.createSession();
      store.audit("login", "ok", ip);
      res.setHeader("Set-Cookie", `akano_dash=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${12 * 3600}`);
      return sendJson(res, 200, {
        ok: true
      });
    }
    if (p === "/api/logout" && req.method === "POST") {
      auth.destroySession(auth.sessionFromReq(req));
      res.setHeader("Set-Cookie", "akano_dash=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0");
      return sendJson(res, 200, {
        ok: true
      });
    }
    const isApi = p.startsWith("/api/");
    const publicApi = p === "/api/login";
    if (isApi && !publicApi && !auth.isAuthed(req)) {
      return sendJson(res, 401, {
        ok: false,
        message: "unauthorized"
      });
    }
    if (isApi) {
      if (p === "/api/events") return handleSse(req, res);
      if (p === "/api/logs/export" && req.method === "GET") {
        const snap2 = require("./bus").snapshot();
        const lines = snap2.logs.map(l => JSON.stringify(l)).join("\n");
        res.writeHead(200, {
          "Content-Type": "application/x-ndjson",
          "Content-Disposition": "attachment; filename=akano-logs-" + Date.now() + ".ndjson"
        });
        return res.end(lines || "");
      }
      if (p === "/api/terminal") {
        return send(res, 200, require("./features").getLines(parseInt(url.searchParams.get("n") || "100", 10)));
      }
      if (p === "/api/failed/retry" && req.method === "POST") {
        try {
          await require("./features").retryItem(body && body.platform, parseInt(body && body.index, 10));
          return send(res, 200, {
            ok: true
          });
        } catch (e) {
          return send(res, 400, {
            ok: false,
            message: e.message
          });
        }
      }
      if (p === "/api/failed/clear" && req.method === "POST") {
        require("./features").clearFailed(body && body.platform);
        return send(res, 200, {
          ok: true
        });
      }
      const avMatch = p.match(/^\/api\/bots\/(whatsapp|telegram|discord|owner)\/avatar\.png$/);
      if (avMatch && req.method === "GET") {
        try {
          const buf = await api.botAvatar(avMatch[1]);
          if (!buf) {
            res.writeHead(404);
            return res.end();
          }
          res.writeHead(200, {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=300"
          });
          return res.end(buf);
        } catch {
          res.writeHead(500);
          return res.end();
        }
      }
      if (req.method === "GET") {
        const result = await api.handleApi(req, res, url, sendJson);
        if (result !== null) return;
        return sendJson(res, 404, {
          ok: false,
          message: "unknown endpoint"
        });
      }
      if (req.method === "POST") {
        let body = {};
        try {
          body = JSON.parse(await readBody(req));
        } catch {}
        const result = await api.handleAction(req, res, url, body, sendJson);
        if (result !== null) return;
        return sendJson(res, 404, {
          ok: false,
          message: "unknown action"
        });
      }
      return sendJson(res, 405, {
        ok: false,
        message: "method not allowed"
      });
    }
    if (req.method !== "GET") {
      res.writeHead(405);
      return res.end();
    }
    serveStatic(req, res, p);
  } catch (e) {
    try {
      sendJson(res, 500, {
        ok: false,
        message: "internal error"
      });
    } catch {}
  }
}

function handleWsUpgrade(req, socket, head) {
  const cookies = String(req.headers.cookie || "");
  const tokenMatch = cookies.match(/akano_dash=([^;]+)/);
  const token = tokenMatch ? tokenMatch[1] : null;
  if (!token || !auth.isAuthedToken(token)) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }
  const key = req.headers["sec-websocket-key"];
  if (!key) {
    socket.destroy();
    return;
  }
  const accept = crypto.createHash("sha1").update(key + "258EAFA5-E914-47DA-95CA-5AB5DC65C64B").digest("base64");
  socket.write("HTTP/1.1 101 Switching Protocols\r\n" + "Upgrade: websocket\r\n" + "Connection: Upgrade\r\n" + `Sec-WebSocket-Accept: ${accept}\r\n` + "\r\n");
  const ws = createWsWrapper(socket);
  bus.addWsClient(ws);
}

function createWsWrapper(socket) {
  const {EventEmitter: EventEmitter} = require("events");
  const ws = new EventEmitter;
  ws.readyState = 1;
  ws.socket = socket;
  ws.send = function(data) {
    if (ws.readyState !== 1) return;
    const buf = Buffer.from(data);
    const len = buf.length;
    let header;
    if (len < 126) {
      header = Buffer.alloc(2);
      header[0] = 129;
      header[1] = len;
    } else if (len < 65536) {
      header = Buffer.alloc(4);
      header[0] = 129;
      header[1] = 126;
      header.writeUInt16BE(len, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 129;
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(len), 2);
    }
    try {
      socket.write(Buffer.concat([ header, buf ]));
    } catch {
      ws.readyState = 3;
      ws.emit("close");
    }
  };
  let buf = Buffer.alloc(0);
  socket.on("data", chunk => {
    buf = Buffer.concat([ buf, chunk ]);
    while (buf.length >= 2) {
      const firstByte = buf[0];
      const opcode = firstByte & 15;
      const masked = (buf[1] & 128) !== 0;
      let payloadLen = buf[1] & 127;
      let offset = 2;
      if (payloadLen === 126) {
        if (buf.length < 4) return;
        payloadLen = buf.readUInt16BE(2);
        offset = 4;
      } else if (payloadLen === 127) {
        if (buf.length < 10) return;
        payloadLen = Number(buf.readBigUInt64BE(2));
        offset = 10;
      }
      const maskSize = masked ? 4 : 0;
      const totalLen = offset + maskSize + payloadLen;
      if (buf.length < totalLen) return;
      let payload = buf.slice(offset + maskSize, totalLen);
      if (masked) {
        const mask = buf.slice(offset, offset + 4);
        for (let i = 0; i < payload.length; i++) {
          payload[i] ^= mask[i % 4];
        }
      }
      buf = buf.slice(totalLen);
      if (opcode === 8) {
        ws.readyState = 3;
        ws.emit("close");
        try {
          socket.end();
        } catch {}
        return;
      }
      if (opcode === 9) {
        const pong = Buffer.alloc(2);
        pong[0] = 138;
        pong[1] = 0;
        try {
          socket.write(pong);
        } catch {}
        continue;
      }
      if (opcode === 1) {
        try {
          ws.emit("message", payload.toString("utf8"));
        } catch {}
      }
    }
  });
  socket.on("close", () => {
    ws.readyState = 3;
    ws.emit("close");
  });
  socket.on("error", () => {
    ws.readyState = 3;
    ws.emit("error");
  });
  return ws;
}

function createServer(opts = {}) {
  const host = opts.host || "127.0.0.1";
  const port = parseInt(opts.port || process.env.DASHBOARD_PORT || "3001", 10);
  const server = http.createServer(handler);
  server.listen(port, host, () => {
    const chalk = require("chalk");
    console.log(chalk.cyan(`[DB] ✓ Connected http://${host}:${port}`));
  });
  server.on("error", e => {
    if (e.code === "EADDRINUSE") {
      console.log(`[dashboard] port ${port} busy, already running`);
      return;
    }
    console.error("[dashboard] failed:", e.message);
  });
  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/ws") {
      handleWsUpgrade(req, socket, head);
    } else {
      socket.destroy();
    }
  });
  return server;
}

module.exports = {
  createServer: createServer
};