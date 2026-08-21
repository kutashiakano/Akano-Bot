const { getContext } = require("./context");

function memWatch(options = {}) {
  const limitMB = parseInt(
    process.env.MEM_LIMIT_MB ||
      process.env.AKANO_MEM_LIMIT_MB ||
      options.limitMB ||
      "768",
    10,
  );
  const intervalMs = options.intervalMs || 15000;
  const ctx = getContext();

  const timer = setInterval(() => {
    try {
      const usedMB = process.memoryUsage().heapUsed / 1024 / 1024;
      const rssMB = process.memoryUsage().rss / 1024 / 1024;
      if (usedMB > limitMB) {
        ctx.logError?.(
          "core.watchdog",
          new Error(
            `Heap ${usedMB.toFixed(0)}MB > limit ${limitMB}MB (RSS ${rssMB.toFixed(0)}MB) — forcing exit for clean restart`,
          ),
        );
        clearInterval(timer);
        if (typeof process.send === "function") {
          process.send("reset");
        } else {
          setTimeout(() => process.exit(1), 500).unref?.();
        }
      }
    } catch (e) {
      ctx.logError?.("core.watchdog", e);
    }
  }, intervalMs);

  try {
    timer.unref();
  } catch (e) {}
  return timer;
}

module.exports = { memWatch };