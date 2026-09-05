const {spawn: spawn, execSync: execSync} = require("child_process");
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const os = require("os");

const TUNNEL_DIR = path.join(process.cwd(), "data", "tunnel");

const TUNNEL_TXT = path.join(TUNNEL_DIR, "tunnel.txt");

const TUNNEL_PID = path.join(TUNNEL_DIR, "tunnel.pid");

let _proc = null;

let _publicUrl = null;

let _starting = false;

function ensureDirs() {
  try {
    fs.mkdirSync(TUNNEL_DIR, {
      recursive: true
    });
  } catch {}
}

function findBinary() {
  const localBin = path.join(TUNNEL_DIR, os.platform() === "win32" ? "cloudflared.exe" : "cloudflared");
  if (fs.existsSync(localBin)) return localBin;
  try {
    const which = os.platform() === "win32" ? "where cloudflared" : "which cloudflared";
    const out = execSync(which, {
      stdio: [ "pipe", "pipe", "ignore" ],
      encoding: "utf8"
    }).trim();
    if (out) return out.split("\n")[0].trim();
  } catch {}
  return null;
}

function getDownloadUrl() {
  const platform = os.platform();
  const arch = os.arch();
  const base = "https://github.com/cloudflare/cloudflared/releases/latest/download";
  if (platform === "linux") {
    if (arch === "x64") return `${base}/cloudflared-linux-amd64`;
    if (arch === "arm64") return `${base}/cloudflared-linux-arm64`;
    if (arch === "arm") return `${base}/cloudflared-linux-arm`;
    if (arch === "ia32") return `${base}/cloudflared-linux-386`;
  }
  if (platform === "darwin") {
    if (arch === "arm64") return `${base}/cloudflared-darwin-arm64`;
    return `${base}/cloudflared-darwin-amd64`;
  }
  if (platform === "win32") {
    return `${base}/cloudflared-windows-amd64.exe`;
  }
  return null;
}

function downloadBinary(url, dest) {
  return new Promise((resolve, reject) => {
    ensureDirs();
    const req = (url.startsWith("https") ? https : http).get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadBinary(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Download failed with status ${res.statusCode}`));
      }
      const ws = fs.createWriteStream(dest);
      res.pipe(ws);
      ws.on("finish", () => {
        try {
          fs.chmodSync(dest, 493);
        } catch {}
        resolve(dest);
      });
      ws.on("error", reject);
      res.on("error", reject);
    });
    req.on("error", reject);
  });
}

async function ensureCloudflared() {
  const existing = findBinary();
  if (existing) return existing;
  const url = getDownloadUrl();
  if (!url) throw new Error(`No cloudflared binary available for ${os.platform()}-${os.arch()}`);
  const dest = path.join(TUNNEL_DIR, os.platform() === "win32" ? "cloudflared.exe" : "cloudflared");
  console.log(`[tunnel] Downloading cloudflared for ${os.platform()}-${os.arch()}...`);
  await downloadBinary(url, dest);
  console.log(`[tunnel] cloudflared downloaded to ${dest}`);
  return dest;
}

function isPidAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function getStaticDomain() {
  try {
    const store = require("./store");
    const overlay = store.getOverlay();
    const ovDomain = overlay?.settings?.website?.domain || overlay?.settings?.website?.tunnel?.domain;
    if (ovDomain) return ovDomain;
  } catch {}
  return global.settings?.website?.domain || process.env.DASHBOARD_DOMAIN || "https://your-domain.sslip.io";
}

function getToken() {
  try {
    const store = require("./store");
    const overlay = store.getOverlay();
    const ovToken = overlay?.settings?.website?.tunnel?.token;
    if (ovToken) return ovToken.trim();
  } catch {}
  return (global.settings?.website?.tunnel?.token || process.env.CLOUDFLARE_TUNNEL_TOKEN || process.env.TUNNEL_TOKEN || "").trim();
}

function readSavedTunnel() {
  try {
    if (fs.existsSync(TUNNEL_TXT) && fs.existsSync(TUNNEL_PID)) {
      const pid = parseInt(fs.readFileSync(TUNNEL_PID, "utf8").trim(), 10);
      const url = fs.readFileSync(TUNNEL_TXT, "utf8").trim();
      if (pid && isPidAlive(pid) && url) {
        _publicUrl = url;
        return {
          pid: pid,
          url: url
        };
      }
    }
  } catch {}
  return null;
}

async function start(port = 3001, options = {}) {
  const token = (options.token || getToken() || "").trim();
  const staticDomain = options.domain || getStaticDomain();
  if (_proc) {
    return {
      ok: true,
      active: true,
      publicUrl: _publicUrl || staticDomain,
      staticUrl: staticDomain,
      provider: "cloudflared"
    };
  }
  const saved = readSavedTunnel();
  if (saved) {
    return {
      ok: true,
      active: true,
      publicUrl: saved.url,
      staticUrl: staticDomain,
      provider: "cloudflared",
      pid: saved.pid
    };
  }
  _starting = true;
  ensureDirs();
  try {
    const bus = require("./bus");
    bus.emitTunnelUpdate({
      status: "starting",
      active: false,
      publicUrl: null,
      staticUrl: staticDomain,
      provider: "cloudflared",
      message: token ? "Cloudflare Named Tunnel is starting..." : "Tunnel is starting..."
    });
  } catch {}
  try {
    const bin = await ensureCloudflared();
    const isNamedTunnel = !!token;
    const args = isNamedTunnel ? [ "tunnel", "run", "--token", token ] : [ "tunnel", "--url", `http://127.0.0.1:${port}` ];
    const child = spawn(bin, args, {
      stdio: [ "ignore", "pipe", "pipe" ]
    });
    _proc = child;
    try {
      fs.writeFileSync(TUNNEL_PID, String(child.pid));
    } catch {}
    if (isNamedTunnel) {
      _publicUrl = staticDomain.startsWith("http") ? staticDomain : `https://${staticDomain}`;
      try {
        fs.writeFileSync(TUNNEL_TXT, _publicUrl);
      } catch {}
      console.log(`[32m[dashboard] ✓ Permanent Static Cloudflare Tunnel: ${_publicUrl}[0m`);
      try {
        const bus = require("./bus");
        bus.emitTunnelUpdate({
          status: "connected",
          active: true,
          publicUrl: _publicUrl,
          staticUrl: staticDomain,
          provider: "cloudflared",
          hasToken: true,
          message: `Permanent tunnel active at ${_publicUrl}`
        });
      } catch {}
    }
    const onData = chunk => {
      const text = chunk.toString();
      const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (match) {
        _publicUrl = match[0];
        try {
          fs.writeFileSync(TUNNEL_TXT, _publicUrl);
        } catch {}
        console.log(`[32m[dashboard] ✓ Public Tunnel URL: ${_publicUrl}[0m`);
        try {
          const bus = require("./bus");
          bus.emitTunnelUpdate({
            status: "connected",
            active: true,
            publicUrl: _publicUrl,
            staticUrl: staticDomain,
            provider: "cloudflared",
            hasToken: false,
            message: `Active at ${_publicUrl}`
          });
        } catch {}
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("exit", code => {
      _proc = null;
      _publicUrl = null;
      try {
        fs.unlinkSync(TUNNEL_TXT);
      } catch {}
      try {
        fs.unlinkSync(TUNNEL_PID);
      } catch {}
      try {
        const bus = require("./bus");
        bus.emitTunnelUpdate({
          status: code === 0 ? "stopped" : "error",
          active: false,
          publicUrl: null,
          staticUrl: staticDomain,
          provider: "cloudflared",
          message: code === 0 ? "Tunnel stopped" : "Tunnel exited with error"
        });
      } catch {}
    });
    return new Promise(resolve => {
      const timeoutMs = isNamedTunnel ? 3e3 : 1e4;
      const check = setInterval(() => {
        if (_publicUrl) {
          clearInterval(check);
          clearTimeout(giveUp);
          _starting = false;
          resolve({
            ok: true,
            active: true,
            publicUrl: _publicUrl,
            staticUrl: staticDomain,
            provider: "cloudflared",
            hasToken: isNamedTunnel
          });
        }
      }, 400);
      const giveUp = setTimeout(() => {
        clearInterval(check);
        _starting = false;
        resolve({
          ok: true,
          active: !!_proc,
          publicUrl: _publicUrl || staticDomain,
          staticUrl: staticDomain,
          provider: "cloudflared",
          hasToken: isNamedTunnel,
          message: _publicUrl ? "Tunnel active" : "Tunnel process started, resolving URL..."
        });
      }, timeoutMs);
    });
  } catch (e) {
    _starting = false;
    return {
      ok: false,
      message: e.message,
      staticUrl: staticDomain
    };
  }
}

function stop() {
  if (_proc) {
    try {
      _proc.kill();
    } catch {}
    _proc = null;
  }
  const saved = readSavedTunnel();
  if (saved && saved.pid) {
    try {
      process.kill(saved.pid);
    } catch {}
  }
  _publicUrl = null;
  try {
    fs.unlinkSync(TUNNEL_TXT);
  } catch {}
  try {
    fs.unlinkSync(TUNNEL_PID);
  } catch {}
  const staticDomain = getStaticDomain();
  try {
    const bus = require("./bus");
    bus.emitTunnelUpdate({
      status: "stopped",
      active: false,
      publicUrl: null,
      staticUrl: staticDomain,
      provider: "cloudflared",
      message: "Tunnel stopped"
    });
  } catch {}
  return {
    ok: true,
    active: false,
    status: "stopped",
    staticUrl: staticDomain
  };
}

function getStatus() {
  const saved = readSavedTunnel();
  const active = !!_proc || !!saved;
  const staticUrl = getStaticDomain();
  const token = getToken();
  const publicUrl = _publicUrl || saved && saved.url || null;
  const status = active && publicUrl ? "connected" : active ? "starting" : "stopped";
  return {
    available: true,
    active: active,
    status: status,
    provider: "cloudflared",
    publicUrl: publicUrl || staticUrl,
    tunnelUrl: publicUrl,
    staticUrl: staticUrl,
    hasToken: !!token,
    mode: token ? "token" : "quick",
    message: publicUrl ? `Active at ${publicUrl}` : active ? "Tunnel starting..." : staticUrl ? `Permanent static domain active at ${staticUrl}` : "Tunnel stopped"
  };
}

module.exports = {
  start: start,
  stop: stop,
  getStatus: getStatus,
  ensureCloudflared: ensureCloudflared,
  getStaticDomain: getStaticDomain
};