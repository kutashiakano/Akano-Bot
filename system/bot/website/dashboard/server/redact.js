const SENSITIVE_KEYS = /(token|secret|password|passwd|api_?key|authorization|cookie|session|credential)/i;

const PATTERNS = [ /ghp_[A-Za-z0-9]{20,}/g, /github_pat_[A-Za-z0-9_]{20,}/g, /sk-[A-Za-z0-9_-]{20,}/g, /AIza[0-9A-Za-z_-]{30,}/g, /Bot[0-9]{8,10}:[A-Za-z0-9_-]{30,}/g, /[A-Za-z0-9_-]{24}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27}/g, /Bearer\s+[A-Za-z0-9._-]{16,}/gi ];

function redactString(s) {
  let out = String(s);
  for (const re of PATTERNS) out = out.replace(re, "[REDACTED]");
  return out;
}

function redactValue(value, key) {
  if (value === null || value === undefined) return value;
  if (key && SENSITIVE_KEYS.test(String(key))) return "[REDACTED]";
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.map(v => redactValue(v));
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = redactValue(v, k);
    return out;
  }
  return value;
}

function redactText(input) {
  if (input === null || input === undefined) return "";
  if (typeof input === "string") return redactString(input);
  try {
    return redactString(JSON.stringify(redactValue(input)));
  } catch {
    return "[unserializable]";
  }
}

module.exports = {
  redactText: redactText,
  redactValue: redactValue
};