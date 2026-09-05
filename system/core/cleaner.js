const fs = require("fs");
const path = require("path");

const TMP_DIR = path.join(__dirname, "../../tmp");

function clean(keepMs = 24 * 60 * 60 * 1e3) {
  if (!fs.existsSync(TMP_DIR)) return;
  const now = Date.now();
  const walk = dir => {
    let entries = [];
    try {
      entries = fs.readdirSync(dir, {
        withFileTypes: true
      });
    } catch (e) {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      try {
        const st = fs.statSync(full);
        if (st.isDirectory()) {
          walk(full);
          try {
            if (fs.readdirSync(full).length === 0) fs.rmdirSync(full);
          } catch (e) {}
        } else if (now - st.mtimeMs > keepMs) {
          fs.unlinkSync(full);
        }
      } catch (e) {}
    }
  };
  try {
    walk(TMP_DIR);
  } catch (e) {}
}

function start(keepMs) {
  clean(keepMs);
  const timer = setInterval(() => clean(keepMs), 60 * 60 * 1e3);
  try {
    timer.unref();
  } catch (e) {}
  return timer;
}

module.exports = {
  clean: clean,
  start: start
};