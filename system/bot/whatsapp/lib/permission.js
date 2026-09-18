const { Notifier, getPermission, isOwner, isPremium } = require('../../sdk/common/permission');
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
  Notifier: Notifier,
  getPermission: getPermission,
  isOwner: isOwner,
  isPremium: isPremium,
  isAdmin: isAdmin,
  isBotAdmin: isBotAdmin
};