const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

function chain() {
  return crypto.createHash("sha256").update(process.env.YT_SESSION_KEY || "akano").digest();
}

class Store {
  constructor(dir) {
    this.d = dir;
    fs.mkdirSync(dir, {
      recursive: true,
      mode: 448
    });
    try {
      fs.chmodSync(dir, 448);
    } catch {}
  }
  enc(raw) {
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv("aes-256-gcm", chain(), iv);
    const ct = Buffer.concat([ c.update(raw), c.final() ]);
    return [ iv, c.getAuthTag(), ct ].map(b => b.toString("base64")).join(":");
  }
  dec(s) {
    const [iv, tag, ct] = s.split(":").map(p => Buffer.from(p, "base64"));
    const d = crypto.createDecipheriv("aes-256-gcm", chain(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([ d.update(ct), d.final() ]);
  }
  file(k) {
    return path.join(this.d, (k || "store") + ".bin");
  }
  async get(k) {
    try {
      return this.dec(fs.readFileSync(this.file(k), "utf8"));
    } catch {
      return undefined;
    }
  }
  async set(k, v) {
    fs.writeFileSync(this.file(k), this.enc(Buffer.from(new Uint8Array(v))), {
      mode: 384
    });
  }
  async remove(k) {
    try {
      fs.unlinkSync(this.file(k));
    } catch {}
  }
}

module.exports = {
  chain: chain,
  Store: Store
};