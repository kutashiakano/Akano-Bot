const LINK_PATTERNS = [ /chat\.whatsapp\.com\/[^\s]+/gi, /https?:\/\/[^\s]*t\.me\/[^\s]+/gi, /https?:\/\/[^\s]*wa\.me\/[^\s]+/gi, /https?:\/\/[^\s]*telegram\.me\/[^\s]+/gi ];

const VRX_T = 5e3;

function isLink(text) {
  if (!text) return false;
  return LINK_PATTERNS.some(p => p.test(text));
}

function isVirtex(text) {
  if (!text) return false;
  return text.length > VRX_T;
}

function extractLinks(text) {
  if (!text) return [];
  const links = [];
  for (const pattern of LINK_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) links.push(...matches);
  }
  return [ ...new Set(links) ];
}

class AntiDelete {
  constructor() {
    this.recentMessages = new Map;
    this.MAX_SIZE = 1e3;
  }
  store(key, msg) {
    this.recentMessages.set(key, msg);
    if (this.recentMessages.size > this.MAX_SIZE) {
      const firstKey = this.recentMessages.keys().next().value;
      this.recentMessages.delete(firstKey);
    }
  }
  get(key) {
    return this.recentMessages.get(key);
  }
  delete(key) {
    this.recentMessages.delete(key);
  }
}

module.exports = {
  isLink: isLink,
  isVirtex: isVirtex,
  extractLinks: extractLinks,
  AntiDelete: AntiDelete,
  LINK_PATTERNS: LINK_PATTERNS,
  VRX_T: VRX_T
};