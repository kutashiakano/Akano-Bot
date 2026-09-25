import { getPermission as sdkGetPermission, Notifier as SdkNotifier, isAdmin as sdkIsAdmin, isBotAdmin as sdkIsBotAdmin } from "@kutashiakanocanzy/sdk";
function toOpts(g) {
  return {
    ownerJid: g && g.settings && g.settings.connection ? g.settings.connection.owner || "" : "",
    owners: g && g.settings ? g.settings.owners || [] : []
  };
}
function getPermission(sender, g) {
  if (sdkGetPermission(sender, toOpts(g)) === "owner") return "owner";
  if (g && g.db && g.db.users && g.db.users[sender] && g.db.users[sender].premium) return "premium";
  if (g && g.db && g.db.users && g.db.users[sender] && g.db.users[sender].admin) return "admin";
  return "user";
}
function isOwner(sender, g) {
  return getPermission(sender, g) === "owner";
}
function isPremium(sender, g) {
  const perm = getPermission(sender, g);
  return perm === "owner" || perm === "premium";
}
export { SdkNotifier as Notifier, getPermission, isOwner, isPremium, sdkIsAdmin as isAdmin, sdkIsBotAdmin as isBotAdmin };
export default {
  Notifier: SdkNotifier,
  getPermission: getPermission,
  isOwner: isOwner,
  isPremium: isPremium,
  isAdmin: sdkIsAdmin,
  isBotAdmin: sdkIsBotAdmin
};
