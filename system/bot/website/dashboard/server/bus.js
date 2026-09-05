const {EventEmitter: EventEmitter} = require("events");
const os = require("os");

const MESSAGE_BUFFER = 300;

const LOG_BUFFER = 500;

const bus = new EventEmitter;

bus.setMaxListeners(100);

const messages = [];

const logs = [];

const wsClients = new Set;

const stats = {
  startedAt: Date.now(),
  messagesIn: 0,
  messagesOut: 0,
  commands: 0,
  errors: 0,
  warnings: 0
};

const topCommands = new Map;

function emitEvent(type, payload) {
  const evt = {
    type: type,
    data: payload,
    ts: Date.now()
  };
  bus.emit("event", evt);
  broadcastWs(evt);
}

function broadcastWs(evt) {
  const msg = JSON.stringify(evt);
  for (const ws of wsClients) {
    try {
      if (ws.readyState === 1) ws.send(msg);
    } catch {
      wsClients.delete(ws);
    }
  }
}

function addWsClient(ws) {
  wsClients.add(ws);
  ws.on("close", () => wsClients.delete(ws));
  ws.on("error", () => wsClients.delete(ws));
  try {
    ws.send(JSON.stringify({
      type: "init",
      data: {
        messages: messages.slice(-50),
        stats: {
          ...stats,
          uptimeMs: Date.now() - stats.startedAt
        },
        connectedClients: wsClients.size
      },
      ts: Date.now()
    }));
  } catch {}
}

function pushMessage(entry) {
  const item = {
    ts: Date.now(),
    ...entry
  };
  messages.push(item);
  if (messages.length > MESSAGE_BUFFER) messages.shift();
  stats.messagesIn += 1;
  if (entry.isCommand) {
    stats.commands += 1;
    const cname = String(entry.command || "unknown").slice(0, 40);
    topCommands.set(cname, (topCommands.get(cname) || 0) + 1);
    if (topCommands.size > 60) {
      const lowest = [ ...topCommands.entries() ].sort((a, b) => a[1] - b[1])[0];
      if (lowest) topCommands.delete(lowest[0]);
    }
  }
  emitEvent("message:new", item);
}

function pushLog(entry) {
  const item = {
    ts: Date.now(),
    ...entry
  };
  logs.push(item);
  if (logs.length > LOG_BUFFER) logs.shift();
  const level = String(item.level || "info").toLowerCase();
  if (level === "error") stats.errors += 1; else if (level === "warn") stats.warnings += 1;
  emitEvent("log", item);
}

function emitBotStatus() {
  emitEvent("bot:status", {
    memory: process.memoryUsage(),
    uptime: process.uptime(),
    connectedClients: wsClients.size
  });
}

function emitConnectionUpdate(platform, state) {
  emitEvent("connection:update", {
    platform: platform,
    state: state,
    ts: Date.now()
  });
}

function emitSettingsUpdate(changes) {
  emitEvent("settings:update", {
    changes: changes,
    ts: Date.now()
  });
}

function emitTunnelUpdate(status) {
  emitEvent("tunnel:update", status);
}

function snapshot() {
  return {
    messages: [ ...messages ],
    logs: [ ...logs ],
    stats: {
      ...stats,
      uptimeMs: Date.now() - stats.startedAt,
      connectedClients: wsClients.size
    }
  };
}

function topCommandsList(limit = 8) {
  return [ ...topCommands.entries() ].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([name, count]) => ({
    name: name,
    count: count
  }));
}

function clearBuffers() {
  messages.length = 0;
  logs.length = 0;
}

function emitMemoryUpdate() {
  const mu = process.memoryUsage();
  emitEvent("memory:update", {
    rss: mu.rss,
    heapUsed: mu.heapUsed,
    heapTotal: mu.heapTotal,
    external: mu.external,
    ts: Date.now()
  });
}

function emitCpuUpdate() {
  emitEvent("cpu:update", {
    loadavg: os.loadavg(),
    freeMem: os.freemem(),
    totalMem: os.totalmem(),
    ts: Date.now()
  });
}

function emitNotification(notification) {
  emitEvent("notification:new", {
    ...notification,
    ts: notification.ts || Date.now()
  });
}

function emitMessageUpdate(message) {
  emitEvent("message:update", {
    ...message,
    ts: message.ts || Date.now()
  });
}

function emitMessageDelete(ref) {
  emitEvent("message:delete", {
    ...ref,
    ts: Date.now()
  });
}

function emitChatUpdate(chat) {
  emitEvent("chat:update", {
    ...chat,
    ts: chat.ts || Date.now()
  });
}

function emitUserUpdate(user) {
  emitEvent("user:update", {
    ...user,
    ts: user.ts || Date.now()
  });
}

function emitPresenceUpdate(presence) {
  emitEvent("presence:update", {
    ...presence,
    ts: presence.ts || Date.now()
  });
}

setInterval(() => {
  emitBotStatus();
}, 5e3);

setInterval(() => {
  emitMemoryUpdate();
  emitCpuUpdate();
}, 1e4);

module.exports = {
  bus: bus,
  pushMessage: pushMessage,
  pushLog: pushLog,
  snapshot: snapshot,
  stats: stats,
  emitEvent: emitEvent,
  topCommandsList: topCommandsList,
  clearBuffers: clearBuffers,
  addWsClient: addWsClient,
  wsClients: wsClients,
  broadcastWs: broadcastWs,
  emitBotStatus: emitBotStatus,
  emitConnectionUpdate: emitConnectionUpdate,
  emitSettingsUpdate: emitSettingsUpdate,
  emitTunnelUpdate: emitTunnelUpdate,
  emitMemoryUpdate: emitMemoryUpdate,
  emitCpuUpdate: emitCpuUpdate,
  emitNotification: emitNotification,
  emitMessageUpdate: emitMessageUpdate,
  emitMessageDelete: emitMessageDelete,
  emitChatUpdate: emitChatUpdate,
  emitUserUpdate: emitUserUpdate,
  emitPresenceUpdate: emitPresenceUpdate
};