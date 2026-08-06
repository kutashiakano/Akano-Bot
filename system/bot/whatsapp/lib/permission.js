const fs = require("fs");
const path = require("path");

class Notifier {
  constructor(sock, ownerJid) {
    this.sock = sock;
    this.ownerJid = ownerJid;
    this.queue = [];
    this.sending = false;
  }

  async send(text) {
    if (!this.ownerJid || !this.sock) return;
    this.queue.push(text);
    if (!this.sending) this._process();
  }

  async _process() {
    this.sending = true;
    while (this.queue.length > 0) {
      const msg = this.queue.shift();
      try {
        await this.sock.sendMessage(this.ownerJid, { text: msg });
      } catch {}
      await new Promise(r => setTimeout(r, 1000));
    }
    this.sending = false;
  }
}

function getPermission(sender, global) {
  const ownerNumbers = global.settings?.owners || [];
  const ownerJid = global.settings?.connection?.owner || "";
  const senderNum = sender?.split("@")[0] || "";
  if (senderNum === ownerJid || ownerNumbers.includes(senderNum)) return "owner";
  if (global.db?.users?.[sender]?.premium) return "premium";
  if (global.db?.users?.[sender]?.admin) return "admin";
  return "user";
}

function isOwner(sender, global) {
  return getPermission(sender, global) === "owner";
}

function isPremium(sender, global) {
  const perm = getPermission(sender, global);
  return perm === "owner" || perm === "premium";
}

function isAdmin(sender, groupMetadata, sock) {
  if (!groupMetadata?.participants) return false;
  const botJid = sock?.user?.id?.replace(/:\d+/, "") || "";
  const senderJid = sender?.replace(/:\d+/, "") || "";
  return groupMetadata.participants.some(p => {
    const pJid = p.id?.replace(/:\d+/, "") || "";
    return (pJid === senderJid || p.id === sender) && p.admin;
  });
}

function isBotAdmin(groupMetadata, sock) {
  if (!groupMetadata?.participants) return false;
  const botJid = sock?.user?.id?.replace(/:\d+/, "") || "";
  return groupMetadata.participants.some(p => {
    const pJid = p.id?.replace(/:\d+/, "") || "";
    return (pJid === botJid || p.id === sock?.user?.id) && p.admin;
  });
}

module.exports = {
  Notifier,
  getPermission,
  isOwner,
  isPremium,
  isAdmin,
  isBotAdmin,
};
