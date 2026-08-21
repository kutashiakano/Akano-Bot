const { areJidsSameUser } = require("baileys");

function getTarget(m, args) {
  if (m.quoted?.sender) return m.quoted.sender;
  const mentioned = m.mentionedJid?.[0];
  if (mentioned) return mentioned;
  const raw = String(args?.[0] || "").replace(/[^0-9]/g, "");
  if (raw) return `${raw}@s.whatsapp.net`;
  return null;
}

function targetPhone(jid, groupMetadata) {
  if (!jid) return "";
  if (jid.endsWith("@s.whatsapp.net")) return jid.split(":")[0].split("@")[0];
  if (jid.endsWith("@lid") && groupMetadata?.participants) {
    const p = groupMetadata.participants.find((item) => areJidsSameUser(item.id, jid));
    if (p?.phoneNumber) return p.phoneNumber.split(":")[0].split("@")[0];
  }
  return "";
}

module.exports = { getTarget, targetPhone };
