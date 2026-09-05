const {getContext: getContext} = require("./context");

let _shuttingDown = false;

let _activeIntervals = null;

if (!global.activeIntervals) global.activeIntervals = new Set;

_activeIntervals = global.activeIntervals;

function registerInterval(timer) {
  if (timer && _activeIntervals) _activeIntervals.add(timer);
  return timer;
}

function cleanupConnectionIntervals() {
  if (!_activeIntervals) return;
  for (const t of _activeIntervals) {
    try {
      clearInterval(t);
    } catch {}
  }
  _activeIntervals.clear();
}

function forceGC() {
  if (typeof global.gc === "function") {
    try {
      global.gc();
      return Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    } catch {}
  }
  return null;
}

async function flushDatabaseAndExit(code, reason) {
  if (_shuttingDown) return;
  _shuttingDown = true;
  const ctx = getContext();
  try {
    ctx.logError?.("core.watchdog", new Error(`flushDatabaseAndExit ${reason} -> exit ${code}`));
  } catch {}
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("flush timeout 5s")), 5e3));
  const doFlush = (async () => {
    try {
      const db = require("../database");
      if (db && typeof db.flushSync === "function") {
        db.flushSync();
      } else if (db && typeof db.write === "function" && db.get) {
        const data = db.get();
        if (data) db.write(data);
      }
      if (global.db && typeof global.db.write === "function" && global.db.data) {
        try {
          await global.db.write();
        } catch {}
      }
    } catch (e) {
      ctx.logError?.("core.watchdog.flush", e);
    }
  })();
  try {
    await Promise.race([ doFlush, timeout ]);
  } catch (e) {
    console.error("[watchdog] flush race failed:", e.message);
  } finally {
    try {
      cleanupConnectionIntervals();
    } catch {}
    if (typeof process.send === "function") {
      try {
        process.send("reset");
      } catch {}
      setTimeout(() => process.exit(code), 3e3).unref?.();
    } else {
      setTimeout(() => process.exit(code), 500).unref?.();
    }
  }
}

function memWatch(options = {}) {
  const HEAP_WARN_MB = parseInt(process.env.HEAP_WARN_MB || "350", 10);
  const HEAP_EXIT_MB = parseInt(process.env.MEM_LIMIT_MB || process.env.HEAP_EXIT_MB || "512", 10);
  const intervalMs = options.intervalMs || parseInt(process.env.WATCHDOG_INTERVAL_MS || String(10 * 60 * 1e3), 10);
  const ctx = getContext();
  if (!global.gc) {
    console.warn("[watchdog] run with --expose-gc for accurate heap measurement (HEAP_WARN 350MB / EXIT 512MB)");
  }
  async function checkMemory() {
    try {
      const mem = process.memoryUsage();
      const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
      const rssMB = Math.round(mem.rss / 1024 / 1024);
      const afterGC = forceGC();
      const finalHeap = afterGC ?? heapUsedMB;
      if (finalHeap > HEAP_EXIT_MB) {
        console.error(`[watchdog] Heap ${finalHeap}MB > EXIT ${HEAP_EXIT_MB}MB (RSS ${rssMB}MB) — flushing & exiting`);
        try {
          ctx.logError?.("core.watchdog", new Error(`Heap ${finalHeap}MB > limit ${HEAP_EXIT_MB}MB (RSS ${rssMB}MB) — forcing exit for clean restart`));
        } catch {}
        await flushDatabaseAndExit(1, `heap ${finalHeap}MB > ${HEAP_EXIT_MB}MB`);
        return;
      } else if (finalHeap > HEAP_WARN_MB) {
        console.warn(`[watchdog] Heap ${finalHeap}MB near limit ${HEAP_EXIT_MB}MB (RSS ${rssMB}MB) — warn threshold ${HEAP_WARN_MB}MB`);
        try {
          ctx.logError?.("core.watchdog.warn", new Error(`Heap ${finalHeap}MB approaching limit ${HEAP_EXIT_MB}MB (RSS ${rssMB}MB)`));
        } catch {}
      }
      if (options.verbose) {
        console.log(`[watchdog] heap ${finalHeap}MB rss ${rssMB}MB`);
      }
    } catch (e) {
      ctx.logError?.("core.watchdog", e);
    }
  }
  const initialTimer = setTimeout(checkMemory, 5e3);
  initialTimer.unref?.();
  const timer = setInterval(checkMemory, intervalMs);
  try {
    timer.unref();
  } catch {}
  registerInterval(timer);
  if (!global._watchdogSignalBound) {
    global._watchdogSignalBound = true;
    process.on("SIGTERM", () => flushDatabaseAndExit(0, "SIGTERM"));
    process.on("SIGINT", () => flushDatabaseAndExit(0, "SIGINT"));
  }
  return timer;
}

let _optikWatchdog = null;

let _lastOpenAt = Date.now();

function startStaleWatchdog(getConn, opts = {}) {
  if (_optikWatchdog) return _optikWatchdog;
  const STALE_MS = opts.staleMs || 5 * 60 * 1e3;
  const CHECK_MS = opts.checkMs || 60 * 1e3;
  _lastOpenAt = Date.now();
  _optikWatchdog = setInterval(async () => {
    try {
      const conn = typeof getConn === "function" ? getConn() : getConn;
      if (!conn) return;
      const idleMs = Date.now() - _lastOpenAt;
      const wsState = conn.ws?.socket?.readyState ?? conn.ws?.readyState ?? null;
      if (idleMs > STALE_MS && wsState !== 1 && wsState !== undefined && !global._isReconnecting) {
        console.warn(`[watchdog:stale] idle ${Math.round(idleMs / 1e3)}s, wsState=${wsState}, forcing reload`);
        global._isReconnecting = true;
        try {
          if (typeof conn.reload === "function") await conn.reload(true); else if (typeof global.reloadHandler === "function") await global.reloadHandler(true); else if (typeof process.send === "function") process.send("reset");
        } catch (e) {
          console.error("[watchdog:stale] reload failed:", e.message);
        } finally {
          global._isReconnecting = false;
          _lastOpenAt = Date.now();
        }
      }
    } catch (e) {
      console.error("[watchdog:stale] error:", e.message);
    }
  }, CHECK_MS);
  try {
    _optikWatchdog.unref();
  } catch {}
  registerInterval(_optikWatchdog);
  return _optikWatchdog;
}

function touchStaleWatchdog() {
  _lastOpenAt = Date.now();
}

function stopStaleWatchdog() {
  if (_optikWatchdog) {
    clearInterval(_optikWatchdog);
    _activeIntervals?.delete(_optikWatchdog);
    _optikWatchdog = null;
  }
}

module.exports = {
  memWatch: memWatch,
  forceGC: forceGC,
  flushDatabaseAndExit: flushDatabaseAndExit,
  startStaleWatchdog: startStaleWatchdog,
  touchStaleWatchdog: touchStaleWatchdog,
  stopStaleWatchdog: stopStaleWatchdog,
  registerInterval: registerInterval,
  cleanupConnectionIntervals: cleanupConnectionIntervals
};