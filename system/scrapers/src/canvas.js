const fs = require("fs");
const path = require("path");

let nc = null;

let fontReady = false;

const FONT_FAMILY = "Akano";

function init() {
  if (nc) return true;
  try {
    nc = require("@napi-rs/canvas");
    registerFont();
    return true;
  } catch {
    return false;
  }
}

function fontCandidates() {
  const localDir = path.join(__dirname, "fonts");
  const locals = fs.existsSync(localDir) ? fs.readdirSync(localDir).filter(f => /\.(ttf|otf)$/i.test(f)).map(f => path.join(localDir, f)) : [];
  return [ ...locals.map(p => [ p, FONT_FAMILY ]), [ "/system/fonts/Roboto-Regular.ttf", FONT_FAMILY ], [ "/system/fonts/RobotoStatic-Regular.ttf", FONT_FAMILY ], [ "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", FONT_FAMILY ], [ "/usr/share/fonts/TTF/DejaVuSans.ttf", FONT_FAMILY ], [ "/usr/share/fonts/dejavu/DejaVuSans.ttf", FONT_FAMILY ], [ "C:/Windows/Fonts/arial.ttf", FONT_FAMILY ], [ "C:/Windows/Fonts/segoeui.ttf", FONT_FAMILY ], [ "/System/Library/Fonts/Helvetica.ttc", FONT_FAMILY ], [ "/System/Library/Fonts/SFNS.ttf", FONT_FAMILY ] ];
}

function registerFont() {
  if (!nc || fontReady || !nc.GlobalFonts) return false;
  for (const [p, fam] of fontCandidates()) {
    try {
      if (fs.existsSync(p) && nc.GlobalFonts.registerFromPath(p, fam)) {
        fontReady = true;
        return true;
      }
    } catch {}
  }
  return false;
}

module.exports = {
  get available() {
    return init();
  },
  get fontOk() {
    init();
    return fontReady;
  },
  get Canvas() {
    if (!init()) return null;
    return nc.Canvas;
  },
  get loadImage() {
    if (!init()) return null;
    return nc.loadImage;
  },
  createCanvas(w, h) {
    if (!init()) return null;
    return new nc.Canvas(w, h);
  },
  font: (size, bold) => `${bold ? "bold " : ""}${size}px ${FONT_FAMILY}, sans-serif`,
  roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  },
  circle(g, cx, cy, r) {
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.closePath();
  }
};