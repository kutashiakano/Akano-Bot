import fs from "fs";

function makeInMemoryStore(config = {}) {
  const store = {
    chats: {},
    contacts: {},
    groupMetadata: {},
    messages: {},
    readFromFile(filePath) {
      try {
        if (!fs.existsSync(filePath)) return;
        const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
        if (data.chats) store.chats = data.chats;
        if (data.contacts) store.contacts = data.contacts;
        if (data.groupMetadata) store.groupMetadata = data.groupMetadata;
        if (data.messages) store.messages = data.messages;
      } catch {}
    },
    writeToFile(filePath) {
      try {
        fs.writeFileSync(filePath, JSON.stringify({
          chats: store.chats,
          contacts: store.contacts,
          groupMetadata: store.groupMetadata,
          messages: store.messages
        }));
      } catch {}
    },
    bind(ev) {
      try {
        ev.on("messages.upsert", ({ messages = [], type = "append" }) => {
          if (type !== "append" && type !== "notify") return;
          for (const m of messages) {
            const jid = m.key && m.key.remoteJid;
            const id = m.key && m.key.id;
            if (!jid || !id) continue;
            if (!store.messages[jid]) store.messages[jid] = {};
            store.messages[jid][id] = m;
          }
        });
        ev.on("contacts.upsert", (contacts = []) => {
          for (const c of contacts || []) {
            if (!c || !c.id) continue;
            store.contacts[c.id] = { ...(store.contacts[c.id] || {}), ...c };
          }
        });
        ev.on("groups.update", (updates = []) => {
          for (const u of updates || []) {
            if (!u || !u.id) continue;
            store.groupMetadata[u.id] = { ...(store.groupMetadata[u.id] || {}), ...u };
          }
        });
        ev.on("chats.upsert", (chats = []) => {
          for (const c of chats || []) {
            if (!c || !c.id) continue;
            store.chats[c.id] = { ...(store.chats[c.id] || {}), ...c };
          }
        });
        ev.on("chats.delete", (deletions = []) => {
          for (const jid of deletions || []) delete store.chats[jid];
        });
      } catch {}
    },
    async loadMessage(jid, id) {
      try {
        return (store.messages[jid] && store.messages[jid][id]) || null;
      } catch {
        return null;
      }
    },
    async fetchGroupMetadata(jid, sock) {
      try {
        if (store.groupMetadata[jid]) return store.groupMetadata[jid];
        if (sock && typeof sock.groupMetadata === "function") {
          const meta = await sock.groupMetadata(jid);
          if (meta) store.groupMetadata[jid] = meta;
          return meta;
        }
        return null;
      } catch {
        return null;
      }
    }
  };
  return store;
}

export { makeInMemoryStore };
