const $ = s => document.querySelector(s);

const $$ = s => document.querySelectorAll(s);

const state = {
  page: "overview",
  ws: null,
  wsState: "DISCONNECTED",
  wsBackoff: 1e3,
  wsTimer: null,
  chats: [],
  activeChat: null,
  activeChatPlatform: null,
  chatFilter: "all",
  chatSearch: "",
  unreadOnly: false,
  messages: [],
  userInfo: null,
  isSending: false,
  isSidebarCollapsed: false,
  status: null,
  stats: null
};

const ICONS = {
  broadcast: '<path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/><path d="M19.1 4.9C23 8.8 23 15.2 19.1 19.1"/>',
  bots: '<rect x="4" y="8" width="16" height="12" rx="2"/><path d="M12 8V4M8 4h8"/><circle cx="9" cy="14" r="1"/><circle cx="15" cy="14" r="1"/><path d="M9 17.5h6"/>',
  whatsapp: '<path d="M20.5 11.7A8.5 8.5 0 0 1 8.6 19.9L3.5 21l1.2-4.9A8.5 8.5 0 1 1 20.5 11.7z"/><path d="M8.8 7.6c.2-.5.9-.6 1.2-.1l.8 1.4c.2.3.1.7-.1 1l-.5.6c.5 1 1.4 1.9 2.4 2.4l.6-.5c.3-.2.7-.3 1-.1l1.4.8c.5.3.4 1-.1 1.2-2 .9-4.4.2-6-1.4s-2.3-4-1.4-6z"/>',
  discord: '<path d="M8.5 17c-2.5 0-4-1.5-4.5-2.5C4.5 10 6 6.5 6 6.5 7.5 5.7 9 5.5 9 5.5l.5 1.2a12 12 0 0 1 5 0L15 5.5s1.5.2 3 1c0 0 1.5 3.5 2 8-.5 1-2 2.5-4.5 2.5l-1-1.6a8 8 0 0 1-4 0z"/><circle cx="9.5" cy="12" r="1"/><circle cx="14.5" cy="12" r="1"/>',
  telegram: '<path d="M21.5 4.5L2.8 11.7c-.7.3-.7 1.3.1 1.5l4.6 1.4 1.7 5.3c.2.7 1.1.8 1.5.3l2.4-2.9 4.6 3.4c.6.4 1.4.1 1.6-.6L22.9 5.7c.2-.8-.6-1.5-1.4-1.2z"/><path d="M7.5 14.6l9.9-8"/>',
  overview: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  chat: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
  messages: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  groups: '<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/><circle cx="12" cy="12" r="10"/>',
  plugins: '<path d="M10 2v6M14 2v6M8 8h8v4a4 4 0 0 1-4 4 4 4 0 0 1-4-4z"/><path d="M12 16v6"/>',
  logs: '<path d="M4 4h13a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  tunnel: '<path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1"/>',
  system: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  audit: '<path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  send: '<path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2z"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  chevron: '<polyline points="9 18 15 12 9 6"/>',
  connections: '<path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v1"/><path d="M18 8l4 4-4 4"/><path d="M8 12h14"/>',
  about: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'
};

const NAV = [ [ "overview", "Overview" ], [ "chat", "Unified Chat" ], [ "connections", "Connections" ], [ "system", "Monitoring" ], [ "tunnel", "Public Web" ], [ "settings", "Settings" ], [ "broadcast", "Broadcast" ], [ "plugins", "Plugins" ], [ "logs", "Logs" ], [ "about", "About" ] ];

function svg(name, size = 18, cls = "") {
  return `<svg class="ic ${cls}" data-ic="${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="${size}" height="${size}">${ICONS[name] || ""}</svg>`;
}

const PLATFORM_FULL = {
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  discord: "Discord"
};

const fullName = p => PLATFORM_FULL[p] || String(p || "");

function waBadgeText(wa) {
  if (wa.state === "linked") return "Linked";
  if (wa.state === "reconnecting") return "Reconnecting";
  if (wa.state === "unpaired") return "Awaiting link";
  return "Offline";
}

function waBadge(wa) {
  const txt = waBadgeText(wa);
  const cls = wa.state === "linked" ? "ok" : wa.state === "down" ? "err" : "warn";
  return `<span class="tag ${cls}">${txt}</span>`;
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    credentials: "same-origin",
    ...opts
  });
  if (res.status === 401) {
    showLogin();
    throw new Error("unauthorized");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || res.statusText);
  return data;
}

function toast(msg, type = "info", ms = 3200) {
  if (typeof type === "number") {
    ms = type;
    type = "info";
  }
  let container = $("#toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  const item = document.createElement("div");
  item.className = `toast-item toast-${type}`;
  item.innerHTML = `\n    <span class="toast-text">${esc(msg)}</span>\n    <button class="toast-close" aria-label="Close notification">&times;</button>\n    <div class="toast-bar" style="animation-duration:${ms}ms"></div>\n  `;
  container.appendChild(item);
  let closed = false;
  const dismiss = () => {
    if (closed) return;
    closed = true;
    item.style.animation = "toastOut .18s var(--ease-out) forwards";
    setTimeout(() => {
      item.remove();
    }, 190);
  };
  item.querySelector(".toast-close").onclick = dismiss;
  setTimeout(dismiss, ms);
}

function showModal({title: title = "Confirm Action", message: message = "", confirmText: confirmText = "Confirm", cancelText: cancelText = "Cancel", danger: danger = false, onConfirm: onConfirm, onCancel: onCancel}) {
  const container = $("#modalContainer");
  if (!container) return;
  const prevActive = document.activeElement;
  container.innerHTML = `\n    <div class="modal-overlay" id="activeModalOverlay" role="dialog" aria-modal="true" aria-labelledby="modalTitle">\n      <div class="modal-card">\n        <h3 id="modalTitle" style="font-size:18px;font-weight:700">${esc(title)}</h3>\n        <p style="color:var(--mut);font-size:14px;line-height:1.5">${esc(message)}</p>\n        <div class="actions" style="margin-top:10px;justify-content:flex-end">\n          <button class="btn" id="modalCancelBtn">${esc(cancelText)}</button>\n          <button class="btn ${danger ? "danger" : "primary"}" id="modalConfirmBtn">${esc(confirmText)}</button>\n        </div>\n      </div>\n    </div>\n  `;
  document.body.style.overflow = "hidden";
  const close = () => {
    container.innerHTML = "";
    document.body.style.overflow = "";
    if (prevActive && typeof prevActive.focus === "function") prevActive.focus();
  };
  const confirmBtn = $("#modalConfirmBtn");
  const cancelBtn = $("#modalCancelBtn");
  confirmBtn?.focus();
  if (confirmBtn) {
    confirmBtn.onclick = () => {
      close();
      if (typeof onConfirm === "function") onConfirm();
    };
  }
  if (cancelBtn) {
    cancelBtn.onclick = () => {
      close();
      if (typeof onCancel === "function") onCancel();
    };
  }
  const overlay = $("#activeModalOverlay");
  if (overlay) {
    overlay.onclick = e => {
      if (e.target === overlay) {
        close();
        if (typeof onCancel === "function") onCancel();
      }
    };
  }
  const onKey = e => {
    if (e.key === "Escape") {
      document.removeEventListener("keydown", onKey);
      close();
      if (typeof onCancel === "function") onCancel();
    }
  };
  document.addEventListener("keydown", onKey);
}

function confirmThen(msg, fn, title = "Confirm Action", danger = true) {
  showModal({
    title: title,
    message: msg,
    danger: danger,
    confirmText: "Proceed",
    cancelText: "Cancel",
    onConfirm: fn
  });
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

function fmtBytes(b) {
  if (!b) return "0 B";
  const u = [ "B", "KB", "MB", "GB", "TB" ];
  const i = Math.floor(Math.log(b) / Math.log(1024));
  return (b / Math.pow(1024, i)).toFixed(i ? 1 : 0) + " " + u[i];
}

function fmtUptime(ms) {
  const s = Math.floor(ms / 1e3), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
}

function debounce(fn, ms) {
  let h;
  return (...a) => {
    clearTimeout(h);
    h = setTimeout(() => fn(...a), ms);
  };
}

function showLogin() {
  $("#appView").classList.add("hidden");
  $("#loginView").classList.remove("hidden");
  stopStream();
}

async function checkAuth() {
  try {
    await api("/api/status");
    showApp();
  } catch {
    showLogin();
  }
}

const toggleLoginKey = $("#toggleLoginKey");

if (toggleLoginKey) {
  toggleLoginKey.addEventListener("click", () => {
    const keyInput = $("#loginKey");
    const isPass = keyInput.type === "password";
    keyInput.type = isPass ? "text" : "password";
    const eyeOff = toggleLoginKey.querySelector(".eye-off");
    const eyeOn = toggleLoginKey.querySelector(".eye-on");
    if (eyeOff && eyeOn) {
      eyeOff.classList.toggle("hidden", isPass);
      eyeOn.classList.toggle("hidden", !isPass);
    }
  });
}

$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  const errEl = $("#loginError");
  const loginBtn = $("#loginBtn");
  const loginCard = $(".login-card");
  const btnSpinner = loginBtn ? loginBtn.querySelector(".btn-spinner") : null;
  const btnLabel = loginBtn ? loginBtn.querySelector(".btn-label") : null;
  const btnArrow = loginBtn ? loginBtn.querySelector(".btn-arrow") : null;
  errEl.classList.add("hidden");
  loginCard?.classList.remove("shake");
  if (loginBtn) {
    loginBtn.disabled = true;
    loginBtn.classList.add("loading");
  }
  if (btnSpinner) btnSpinner.classList.remove("hidden");
  if (btnArrow) btnArrow.classList.add("hidden");
  if (btnLabel) btnLabel.textContent = "Verifying…";
  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        key: $("#loginKey").value
      })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || "Invalid access key");
    }
    if (btnLabel) btnLabel.textContent = "Unlocked";
    if (loginBtn) loginBtn.classList.add("success");
    setTimeout(() => {
      showApp();
      if (loginBtn) {
        loginBtn.disabled = false;
        loginBtn.classList.remove("loading", "success");
      }
      if (btnSpinner) btnSpinner.classList.add("hidden");
      if (btnArrow) btnArrow.classList.remove("hidden");
      if (btnLabel) btnLabel.textContent = "Unlock Console";
    }, 300);
  } catch (err) {
    if (loginCard) {
      void loginCard.offsetWidth;
      loginCard.classList.add("shake");
    }
    errEl.textContent = err.message;
    errEl.classList.remove("hidden");
    if (loginBtn) {
      loginBtn.disabled = false;
      loginBtn.classList.remove("loading");
    }
    if (btnSpinner) btnSpinner.classList.add("hidden");
    if (btnArrow) btnArrow.classList.remove("hidden");
    if (btnLabel) btnLabel.textContent = "Unlock Console";
    const loginInput = $("#loginKey");
    if (loginInput) loginInput.focus();
  }
});

$("#logoutBtn").addEventListener("click", async () => {
  await fetch("/api/logout", {
    method: "POST"
  });
  showLogin();
});

function buildNav() {
  const nav = $("#nav");
  nav.innerHTML = "";
  NAV.forEach(([id, label], i) => {
    const b = document.createElement("button");
    const active = state.page === id;
    b.className = "nav-item" + (active ? " active" : "");
    b.setAttribute("aria-current", active ? "page" : "false");
    b.setAttribute("aria-label", label);
    b.innerHTML = `<span class="ico" aria-hidden="true">${svg(id)}</span><span>${label}</span><span class="nav-num">${String(i + 1).padStart(2, "0")}</span>`;
    b.onclick = () => {
      b.classList.add("nav-pop");
      setTimeout(() => b.classList.remove("nav-pop"), 400);
      go(id);
      closeDrawer();
    };
    nav.appendChild(b);
  });
}

function go(page) {
  state.page = page;
  buildNav();
  const item = NAV.find(n => n[0] === page);
  $("#pageTitle").textContent = item ? item[1] : page;
  $("#pageCrumb").textContent = String(NAV.findIndex(n => n[0] === page) + 1).padStart(2, "0") + " — console";
  const content = $("#content");
  content.classList.remove("page-enter");
  void content.offsetWidth;
  content.classList.add("page-enter");
  const topSearch = document.getElementById("topSearch");
  if (topSearch) topSearch.value = "";
  renderPage();
}

function closeDrawer() {
  const sb = $("#sidebar");
  const bd = $("#backdrop");
  const btn = $("#menuBtn");
  sb.classList.remove("open");
  bd.classList.remove("show");
  if (btn) {
    btn.classList.remove("x");
    btn.setAttribute("aria-expanded", "false");
  }
  document.body.style.overflow = "";
}

function openDrawer() {
  const sb = $("#sidebar");
  const bd = $("#backdrop");
  const btn = $("#menuBtn");
  sb.classList.add("open");
  bd.classList.add("show");
  if (btn) {
    btn.classList.add("x");
    btn.setAttribute("aria-expanded", "true");
  }
  document.body.style.overflow = "hidden";
}

$("#menuBtn").addEventListener("click", () => {
  const isOpen = $("#sidebar").classList.contains("open");
  if (isOpen) closeDrawer(); else openDrawer();
});

$("#backdrop").addEventListener("click", closeDrawer);

document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    if ($("#sidebar").classList.contains("open")) closeDrawer();
    const np = $("#notifPanel");
    if (np && !np.classList.contains("hidden")) {
      np.classList.add("hidden");
      $("#bellBtn")?.setAttribute("aria-expanded", "false");
    }
  }
});

window.addEventListener("resize", () => {
  if (window.innerWidth > 900 && $("#sidebar").classList.contains("open")) closeDrawer();
});

(function initTopSearch() {
  const input = document.getElementById("topSearch");
  if (!input) return;
  document.addEventListener("keydown", e => {
    if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const ae = document.activeElement;
      if (ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.isContentEditable)) return;
      e.preventDefault();
      input.focus();
    }
  });
  input.addEventListener("input", debounce(() => {
    const q = input.value.trim().toLowerCase();
    const msgF = document.getElementById("msgFilter");
    const logQ = document.getElementById("logQ");
    const devF = document.getElementById("devFilter");
    if (msgF && state.page === "messages") {
      msgF.value = q;
      msgF.dispatchEvent(new Event("input", {
        bubbles: true
      }));
    } else if (logQ && state.page === "logs") {
      logQ.value = q;
      logQ.dispatchEvent(new Event("input", {
        bubbles: true
      }));
    } else if (devF && state.page === "dev") {
      devF.value = q;
      devF.dispatchEvent(new Event("input", {
        bubbles: true
      }));
    } else {
      if (!q) {
        document.querySelectorAll("#content .card, #content tr").forEach(el => el.style.display = "");
        return;
      }
      document.querySelectorAll("#content .card").forEach(card => {
        const txt = card.textContent.toLowerCase();
        card.style.display = txt.includes(q) ? "" : "none";
      });
    }
  }, 180));
})();

function showApp() {
  $("#loginView").classList.add("hidden");
  $("#appView").classList.remove("hidden");
  buildNav();
  go(state.page || "overview");
  startStream();
}

function startStream() {
  stopStream();
  connectWebSocket();
}

function connectWebSocket() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  try {
    const ws = new WebSocket(wsUrl);
    state.ws = ws;
    setPill("CONNECTING");
    ws.onopen = () => {
      state.wsState = "CONNECTED";
      state.wsBackoff = 1e3;
      setPill("CONNECTED");
    };
    ws.onmessage = e => {
      try {
        const evt = JSON.parse(e.data);
        handleWsEvent(evt);
      } catch {}
    };
    ws.onclose = () => {
      state.wsState = "RECONNECTING";
      setPill("RECONNECTING");
      scheduleReconnect();
    };
    ws.onerror = () => {
      try {
        ws.close();
      } catch {}
    };
  } catch {
    fallbackToSSE();
  }
}

function scheduleReconnect() {
  clearTimeout(state.wsTimer);
  state.wsTimer = setTimeout(() => {
    connectWebSocket();
    state.wsBackoff = Math.min(state.wsBackoff * 1.5, 15e3);
  }, state.wsBackoff);
}

function fallbackToSSE() {
  const es = new EventSource("/api/events");
  state.es = es;
  es.onopen = () => setPill("CONNECTED");
  es.onerror = () => setPill("RECONNECTING");
  es.addEventListener("message", e => {
    try {
      const evt = JSON.parse(e.data);
      handleWsEvent(evt);
    } catch {}
  });
  es.addEventListener("log", e => {
    try {
      const d = JSON.parse(e.data).data;
      bumpBell(d.level);
      if (state.page === "logs") prependLog(d);
    } catch {}
  });
}

function handleWsEvent(evt) {
  if (!evt) return;
  const {type: type, data: data} = evt;
  if (type === "message" || type === "message:new") {
    if (state.page === "messages") prependMessage(data);
    if (state.page === "chat") {
      if (state.activeChat && (data.chatId === state.activeChat || data.from === state.activeChat || data.to === state.activeChat)) {
        state.messages.push(data);
        renderChatMessages(document.getElementById("chatMessagesBox"));
      }
      loadChatList();
    }
    if (state.page === "overview") {
      clearTimeout(_ovTimer);
      _ovTimer = setTimeout(refreshOverview, 1800);
    }
  } else if (type === "message:update") {
    if (state.page === "chat" && data?.id) {
      const idx = state.messages.findIndex(m => m.id === data.id);
      if (idx !== -1) {
        state.messages[idx] = Object.assign({}, state.messages[idx], data);
        renderChatMessages(document.getElementById("chatMessagesBox"));
      }
    }
  } else if (type === "message:delete") {
    if (state.page === "chat" && data?.id) {
      state.messages = state.messages.filter(m => m.id !== data.id);
      renderChatMessages(document.getElementById("chatMessagesBox"));
    }
  } else if (type === "chat:update") {
    if (state.page === "chat") loadChatList();
  } else if (type === "user:update") {
    if (state.page === "chat" && state.activeChat === data?.id) {
      loadChatUserDetails(state.activeChatPlatform, state.activeChat);
    }
  } else if (type === "presence:update") {
    const pStatus = document.getElementById("panelUserTag");
    if (pStatus && state.activeChat === data?.id) {
      pStatus.textContent = data.status || "Active";
    }
  } else if (type === "connection:update") {
    if (state.page === "overview" || state.page === "connections") {
      refreshOverview();
    }
  } else if (type === "memory:update" || type === "cpu:update" || type === "bot:status") {
    if (state.page === "overview") {
      const memCard = document.querySelector("#ovCards [data-count]");
      if (data?.memory?.heapUsed) {
        const valEl = document.querySelector("#ovCards article:nth-child(6) .val");
        if (valEl) valEl.textContent = fmtBytes(data.memory.heapUsed);
      }
    }
  } else if (type === "notification:new") {
    toast(data?.message || "New notification", data?.level || "info");
    bumpBell(data?.level);
  } else if (type === "log") {
    bumpBell(data.level);
    if (state.page === "logs") prependLog(data);
  } else if (type === "settings:update") {
    toast("Settings updated live", "success");
    if (state.page === "settings") pageSettings();
  } else if (type === "tunnel:update") {
    if (state.page === "tunnel") pageTunnel(); else if (data?.publicUrl) toast(`Tunnel active: ${data.publicUrl}`, "info");
  }
}

function stopStream() {
  clearTimeout(state.wsTimer);
  if (state.ws) {
    try {
      state.ws.close();
    } catch {}
    state.ws = null;
  }
  if (state.es) {
    try {
      state.es.close();
    } catch {}
    state.es = null;
  }
}

let unreadAlerts = 0;

function bumpBell(level) {
  if (level !== "error" && level !== "warn") return;
  if (state.page === "logs") return;
  unreadAlerts++;
  const b = $("#bellBadge");
  const btn = $("#bellBtn");
  b.textContent = unreadAlerts > 99 ? "99+" : String(unreadAlerts);
  b.classList.remove("hidden");
  btn?.classList.add("has-unread");
}

$("#bellBtn")?.addEventListener("click", async () => {
  const panel = $("#notifPanel");
  const btn = $("#bellBtn");
  const willOpen = panel.classList.contains("hidden");
  panel.classList.toggle("hidden");
  btn?.setAttribute("aria-expanded", willOpen ? "true" : "false");
  if (!panel.classList.contains("hidden")) {
    const [logs, health, stor] = await Promise.all([ api("/api/logs?limit=15").catch(() => []), api("/api/health").catch(() => null), api("/api/storage").catch(() => null) ]);
    let items = [];
    if (health) {
      for (const [k, v] of Object.entries(health)) {
        if (v.state !== "linked" && v.state !== "ready" && v.state !== "online") items.push({
          level: "warn",
          source: k,
          message: `${v.label} — check Bots page`
        });
      }
    }
    if (stor && stor.usedPct > 85) items.push({
      level: "error",
      source: "storage",
      message: `Disk ${stor.usedPct}% full`
    });
    const alerts = logs.filter(l => l.level === "error" || l.level === "warn");
    items = [ ...items, ...alerts ].slice(0, 15);
    $("#notifList").innerHTML = items.length ? items.map(l => `<div class="np-item"><span class="tag ${l.level === "error" ? "err" : "warn"}">${l.level}</span><div><b class="mono">${esc(l.source || "-")}</b><p>${esc((l.message || "").slice(0, 100))}</p></div></div>`).join("") : '<div class="empty" style="padding:18px">All clear.</div>';
    unreadAlerts = 0;
    $("#bellBadge").classList.add("hidden");
    btn?.classList.remove("has-unread");
  } else {}
});

document.addEventListener("click", e => {
  const wrap = document.querySelector(".notif-wrap");
  const panel = $("#notifPanel");
  const btn = $("#bellBtn");
  if (!wrap || !panel || panel.classList.contains("hidden")) return;
  if (wrap.contains(e.target)) return;
  panel.classList.add("hidden");
  btn?.setAttribute("aria-expanded", "false");
});

function setPill(stateStatus) {
  const pill = $("#connPill");
  if (!pill) return;
  const txt = $("#connText");
  pill.classList.remove("on", "off", "connected", "connecting", "offline");
  if (stateStatus === "CONNECTED" || stateStatus === true) {
    pill.classList.add("on", "connected");
    if (txt) txt.textContent = "Live";
  } else if (stateStatus === "CONNECTING") {
    pill.classList.add("off", "connecting");
    if (txt) txt.textContent = "Connecting…";
  } else if (stateStatus === "RECONNECTING") {
    pill.classList.add("off", "connecting");
    if (txt) txt.textContent = "Reconnecting…";
  } else {
    pill.classList.add("off", "offline");
    if (txt) txt.textContent = "Offline";
  }
}

let _npTimer = null;

async function loadNowPlaying() {
  try {
    const list = await api("/api/music/now");
    const box = document.getElementById("npList");
    if (!box || state.page !== "overview") return;
    box.innerHTML = list.length ? list.map(n => {
      const pct = n.duration ? Math.min(100, Math.round(n.elapsed / n.duration * 100)) : 0;
      return `<div class="np2-item reveal">\n        ${n.thumbnail ? `<img class="np2-thumb" src="${esc(n.thumbnail)}" alt="">` : '<div class="np2-thumb"></div>'}\n        <div class="np2-main">\n          <div class="np2-title">${esc(n.title)}</div>\n          <div class="np2-meta"><span>${esc(n.artist || "Unknown")}</span><span>${n.paused ? "paused" : "playing"} • ${n.queued} queued</span></div>\n          <div class="np2-bar"><div class="np2-fill" style="--progress:${pct / 100}"></div></div>\n          <div class="np2-meta"><span>${fmtUptime(n.elapsed * 1e3)}</span><span>${fmtUptime((n.duration || 0) * 1e3)}</span></div>\n        </div>\n      </div>`;
    }).join("") : '<div class="empty" style="padding:22px">Nothing playing right now.</div>';
    const upd = document.getElementById("npUpdated");
    if (upd) upd.textContent = "updated " + (new Date).toLocaleTimeString();
  } catch {}
}

function renderPage() {
  $("#content").innerHTML = `<div class="empty reveal">loading</div>`;
  const pages = {
    overview: pageOverview,
    chat: pageChat,
    connections: pageConnections,
    bots: pageConnections,
    broadcast: pageBroadcast,
    messages: pageMessages,
    groups: pageGroups,
    plugins: pagePlugins,
    logs: pageLogs,
    settings: pageSettings,
    tunnel: pageTunnel,
    system: pageSystem,
    audit: pageAudit,
    about: pageAbout
  };
  (pages[state.page] || pageOverview)();
}

const SKELETON = `\n  <div class="sk-row"><div class="sk-av"></div><div style="flex:1"><div class="sk-line" style="width:35%"></div><div class="sk-line" style="width:70%;margin-bottom:0"></div></div></div>\n  <div class="grid g4"><div class="card skel sk-card"></div><div class="card skel sk-card"></div><div class="card skel sk-card"></div><div class="card skel sk-card"></div></div>\n  <section class="card skel" style="min-height:120px"></section>`;

function countUp(el, to, dur = 650) {
  if (!Number.isFinite(to)) {
    el.textContent = String(to);
    return;
  }
  const t0 = performance.now();
  function frame(t) {
    const k = Math.min(1, (t - t0) / dur);
    el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))).toLocaleString();
    if (k < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function countAll(root) {
  (root || document).querySelectorAll("[data-count]").forEach(el => countUp(el, Number(el.dataset.count)));
}

let _ovTimer = null;

async function pageOverview() {
  $("#content").innerHTML = SKELETON;
  const [sData, stData] = await Promise.all([ api("/api/status").catch(() => null), api("/api/stats").catch(() => null) ]);
  $("#content").innerHTML = `\n    <section class="spark-banner reveal">\n      <div class="sb-left">\n        <span class="tag pur">Live console</span>\n        <h2>Good ${(new Date).getHours() < 11 ? "morning" : (new Date).getHours() < 18 ? "afternoon" : "evening"}, Owner.</h2>\n        <p>${(new Date).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  })} — all three runtimes at a glance.</p>\n        <div class="actions"><button class="btn primary" onclick="go('logs')">Check logs</button></div>\n      </div>\n      \n    </section>\n    <div class="grid g4" id="ovCards"></div>\n    <section class="card reveal">\n      <div class="section-head"><h3>Now playing</h3><span class="mono dim tiny" id="npUpdated"></span></div>\n      <div id="npList" class="np2-list"><div class="empty" style="padding:22px">Nothing playing right now.</div></div>\n    </section>\n    </section>`;
  await refreshOverview();
}

async function refreshOverview() {
  try {
    const [s, st] = await Promise.all([ api("/api/status"), api("/api/stats") ]);
    const cards = [ [ "whatsapp", waBadgeText(s.whatsapp), s.whatsapp.phonePretty || (s.whatsapp.user && s.whatsapp.user !== "~" ? s.whatsapp.user : "") || "not set", s.whatsapp.connected ], [ "discord", s.discord.connected ? "Ready" : "Offline", `${s.discord.guilds} guild${s.discord.guilds === 1 ? "" : "s"}`, s.discord.connected ], [ "telegram", s.telegram.connected ? "Online" : "Offline", "long polling active", s.telegram.connected ], [ "system", s.maintenance ? "Maintenance ON" : "Normal ops", `node ${s.node.replace("v", "")}`, !s.maintenance ], [ "uptime", fmtUptime(s.uptimeMs), "since last boot" ], [ "memory", fmtBytes(s.memory.heapUsed), `rss ${fmtBytes(s.memory.rss)}` ], [ "messages", st.messagesIn, "captured live" ], [ "errors", st.errors, `${st.warnings} warnings` ] ];
    const pretty = {
      whatsapp: "WhatsApp",
      discord: "Discord",
      telegram: "Telegram",
      system: "System",
      uptime: "Uptime",
      memory: "Memory",
      messages: "Messages seen",
      errors: "Errors logged"
    };
    const iconFor = {
      whatsapp: "whatsapp",
      discord: "discord",
      telegram: "telegram",
      system: "settings",
      uptime: "overview",
      memory: "system",
      messages: "messages",
      errors: "logs"
    };
    const el = $("#ovCards");
    if (el) {
      el.innerHTML = cards.map(([l, v, sub, ok]) => `<article class="card reveal"><div class="card-head"><span class="ico-chip">${svg(iconFor[l] || "overview")}</span><div class="lbl">${esc(pretty[l] || l)}</div></div><div class="val num"${typeof v === "number" ? ` data-count="${v}"` : ""}>${typeof v === "string" && v.startsWith("<") ? v : typeof v === "number" ? "0" : esc(v)}</div><div class="sub">${esc(typeof sub === "string" ? sub : "")}</div>${ok !== undefined && typeof ok === "boolean" ? `<div class="sub"><span class="tag ${ok ? "ok" : "err"}">${ok ? "healthy" : "down"}</span></div>` : ""}</article>`).join("");
      countAll(el);
    }
    clearTimeout(_ovTimer);
    if (state.page === "overview") {
      _ovTimer = setTimeout(refreshOverview, 15e3);
      loadNowPlaying();
    }
  } catch {}
}

async function pageChat() {
  $("#content").innerHTML = `\n    <div class="chat-layout reveal" id="chatLayout">\n      \x3c!-- 1. Conversation List --\x3e\n      <div class="chat-pane" id="chatListPane">\n        <div class="chat-list-head">\n          <input class="fld" id="chatSearchInput" placeholder="Search…" value="${esc(state.chatSearch)}">\n          <div class="chat-filters">\n            <button class="filter-btn ${state.chatFilter === "all" ? "active" : ""}" data-filter="all">All</button>\n            <button class="filter-btn ${state.chatFilter === "whatsapp" ? "active" : ""}" data-filter="whatsapp">WhatsApp</button>\n            <button class="filter-btn ${state.chatFilter === "telegram" ? "active" : ""}" data-filter="telegram">Telegram</button>\n            <button class="filter-btn ${state.chatFilter === "discord" ? "active" : ""}" data-filter="discord">Discord</button>\n          </div>\n        </div>\n        <div class="chat-items" id="chatListContainer">\n          <div class="empty" style="padding:24px">Loading…</div>\n        </div>\n      </div>\n\n      \x3c!-- 2. Chat Window --\x3e\n      <div class="chat-pane win-view" id="chatWinPane" style="border-right:1px solid var(--line)">\n        <div class="chat-win-head" id="chatWinHeader">\n          <div class="chat-win-title">\n            <button class="btn small" id="chatBackBtn" style="display:none">← Back</button>\n            <img class="chat-item-avatar" id="winAvatar" src="/api/bots/owner/avatar.png" alt="" style="width:38px;height:38px">\n            <div>\n              <div style="font-weight:700;font-size:14px" id="winName">Select a conversation</div>\n              <div class="chat-win-status" id="winSub">No active chat</div>\n            </div>\n          </div>\n          <div id="winPlatformTag"></div>\n        </div>\n        <div class="chat-messages" id="chatMessagesBox">\n          <div class="empty" style="padding:48px;text-align:center">\n            ${svg("chat", 48)}\n            <br>Select a conversation to start messaging.\n          </div>\n        </div>\n        \x3c!-- Composer --\x3e\n        <div class="chat-composer-wrap" id="chatComposerWrap">\n          <div class="composer-reply-strip hidden" id="composerReplyStrip">\n            <div class="reply-strip-bar">\n              <div class="reply-strip-name" id="replyStripName">Reply</div>\n              <div class="reply-strip-text" id="replyStripText"></div>\n            </div>\n            <button class="reply-strip-close" id="replyStripClose" title="Cancel reply">×</button>\n          </div>\n          <div class="composer-media-strip" id="composerMediaStrip"></div>\n          <div class="chat-composer" id="chatComposerForm">\n            <button class="composer-attach-btn" id="composerAttachBtn" title="Attach image/video" type="button">\n              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>\n            </button>\n            <input type="file" id="mediaFileInput" accept="image/*,video/*,audio/*" style="display:none" multiple>\n            <div class="composer-input-wrap">\n              <textarea class="chat-input-field" id="chatInput" placeholder="Message…" rows="1" disabled></textarea>\n            </div>\n            <button class="composer-mic-btn" id="composerMicBtn" title="Voice note" type="button">\n              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>\n            </button>\n            <div class="recording-bar" id="recordingBar">\n              <div class="recording-dot"></div>\n              <span class="recording-time" id="recordingTime">0:00</span>\n              <button class="recording-cancel" id="recordingCancel" type="button">Cancel</button>\n            </div>\n            <button class="composer-send-btn" id="chatSendBtn" disabled title="Send">\n              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2z" fill="currentColor"/></svg>\n            </button>\n          </div>\n        </div>\n      </div>\n\n      \x3c!-- 3. User Info Pane --\x3e\n      <div class="chat-pane chat-user-pane" id="chatUserPane">\n        <img class="user-avatar-lg" id="panelUserAvatar" src="/api/bots/owner/avatar.png" alt="">\n        <div>\n          <h3 id="panelUserName" style="font-size:16px;font-weight:700">—</h3>\n          <div class="mono tiny dim" id="panelUserTag">—</div>\n        </div>\n        <hr style="width:100%;border:none;border-top:1px solid var(--line);margin:4px 0">\n        <div style="width:100%;display:flex;flex-direction:column;gap:10px;text-align:left">\n          <div class="kv"><span>Platform</span><b id="panelUserPlatform" class="mono">—</b></div>\n          <div class="kv"><span>Chat / User ID</span><b id="panelUserId" class="mono" style="word-break:break-all;font-size:11px">—</b></div>\n          <div class="kv"><span>Messages Seen</span><b id="panelUserMsgCount" class="mono">—</b></div>\n          <div class="kv"><span>Last Seen</span><b id="panelUserLastSeen" class="mono">—</b></div>\n        </div>\n      </div>\n    </div>`;
  state.replyTo = null;
  state.mediaFiles = [];
  state.mediaRecorder = null;
  state.recordingTimer = null;
  bindChatEvents();
  await loadChatList();
}

async function loadChatList() {
  try {
    const list = await api("/api/chats");
    state.chats = Array.isArray(list) ? list : [];
    renderChatListItems();
  } catch (e) {
    const box = document.getElementById("chatListContainer");
    if (box) box.innerHTML = `<div class="empty" style="color:var(--err)">Failed to load chats: ${esc(e.message)}</div>`;
  }
}

function renderChatListItems() {
  const box = document.getElementById("chatListContainer");
  if (!box) return;
  const q = (state.chatSearch || "").toLowerCase();
  const f = state.chatFilter;
  let filtered = state.chats.filter(c => {
    if (f !== "all" && c.platform !== f) return false;
    if (q && !(c.name || "").toLowerCase().includes(q) && !(c.id || "").toLowerCase().includes(q)) return false;
    return true;
  });
  if (!filtered.length) {
    box.innerHTML = `<div class="empty" style="padding:24px">No conversations found.</div>`;
    return;
  }
  box.innerHTML = filtered.map(c => {
    const isActive = state.activeChat === c.id && state.activeChatPlatform === c.platform;
    const avatarSrc = c.avatar || `/api/bots/${c.platform}/avatar.png`;
    const timeStr = c.lastMessageTime ? new Date(c.lastMessageTime).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    }) : "";
    return `\n      <div class="chat-item ${isActive ? "active" : ""}" data-chat-id="${esc(c.id)}" data-chat-plat="${esc(c.platform)}">\n        <img class="chat-item-avatar" src="${esc(avatarSrc)}" alt="" onerror="this.src='/api/bots/owner/avatar.png'">\n        <div class="chat-item-body">\n          <div class="chat-item-top">\n            <span class="chat-item-name">${esc(c.name || c.id)}</span>\n            <span class="chat-item-time">${esc(timeStr)}</span>\n          </div>\n          <div class="chat-item-prev">${esc(c.lastMessage || "(No messages yet)")}</div>\n        </div>\n      </div>`;
  }).join("");
  box.querySelectorAll(".chat-item").forEach(item => {
    item.onclick = () => {
      const id = item.dataset.chatId;
      const plat = item.dataset.chatPlat;
      selectChat(plat, id);
    };
  });
}

async function selectChat(platform, chatId) {
  state.activeChat = chatId;
  state.activeChatPlatform = platform;
  renderChatListItems();
  if (window.innerWidth <= 768) {
    const listPane = document.getElementById("chatListPane");
    const winPane = document.getElementById("chatWinPane");
    const backBtn = document.getElementById("chatBackBtn");
    if (listPane) listPane.classList.add("hidden-mobile");
    if (winPane) winPane.classList.remove("hidden-mobile");
    if (backBtn) backBtn.style.display = "inline-flex";
  }
  const chat = state.chats.find(c => c.id === chatId && c.platform === platform) || {
    id: chatId,
    platform: platform,
    name: chatId
  };
  const nameEl = document.getElementById("winName");
  const subEl = document.getElementById("winSub");
  const avatarEl = document.getElementById("winAvatar");
  const tagEl = document.getElementById("winPlatformTag");
  const inp = document.getElementById("chatInput");
  const btn = document.getElementById("chatSendBtn");
  if (nameEl) nameEl.textContent = chat.name || chat.id;
  if (subEl) subEl.textContent = `${fullName(platform)} · ${chat.isGroup ? "Group" : "Direct Message"}`;
  if (avatarEl) avatarEl.src = chat.avatar || `/api/bots/${platform}/avatar.png`;
  if (tagEl) tagEl.innerHTML = `<span class="tag pur">${esc(fullName(platform))}</span>`;
  if (inp) {
    inp.disabled = false;
    inp.focus();
  }
  if (btn) btn.disabled = false;
  loadChatUserDetails(platform, chatId, chat);
  await loadChatMessages(platform, chatId);
}

async function loadChatUserDetails(platform, chatId, chat) {
  try {
    const user = await api(`/api/chats/${platform}/${encodeURIComponent(chatId)}/user`).catch(() => null);
    const pAvatar = document.getElementById("panelUserAvatar");
    const pName = document.getElementById("panelUserName");
    const pTag = document.getElementById("panelUserTag");
    const pPlat = document.getElementById("panelUserPlatform");
    const pId = document.getElementById("panelUserId");
    const pCount = document.getElementById("panelUserMsgCount");
    const pLast = document.getElementById("panelUserLastSeen");
    if (pAvatar) pAvatar.src = user?.avatar || chat?.avatar || `/api/bots/${platform}/avatar.png`;
    if (pName) pName.textContent = user?.name || chat?.name || chatId;
    if (pTag) pTag.textContent = chat?.isGroup ? "Group / Channel" : "User Profile";
    if (pPlat) pPlat.textContent = fullName(platform);
    if (pId) pId.textContent = chatId;
    if (pCount) pCount.textContent = user?.messageCount ?? "—";
    if (pLast) pLast.textContent = user?.lastSeen ? new Date(user.lastSeen).toLocaleString() : "Recently active";
  } catch {}
}

async function loadChatMessages(platform, chatId) {
  const box = document.getElementById("chatMessagesBox");
  if (!box) return;
  try {
    const msgs = await api(`/api/chats/${platform}/${encodeURIComponent(chatId)}/messages?limit=60`);
    state.messages = Array.isArray(msgs) ? msgs : [];
    renderChatMessages(box);
  } catch (e) {
    box.innerHTML = `<div class="empty" style="color:var(--err)">Failed to load messages: ${esc(e.message)}</div>`;
  }
}

function renderChatMessages(box) {
  if (!box) return;
  if (!state.messages.length) {
    box.innerHTML = `<div class="empty" style="padding:32px">No messages found in active memory buffer.<br>Send a message below to start chatting!</div>`;
    return;
  }
  const wasNearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 140;
  box.innerHTML = state.messages.map(m => {
    const isOut = m.from === "me" || m.outgoing === true;
    const time = m.ts || m.timestamp ? new Date(m.ts || m.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    }) : "";
    return `\n      <div class="chat-bubble ${isOut ? "out" : "in"}">\n        <div>${esc(m.text || m.caption || m.preview || "")}</div>\n        <div class="bubble-meta">\n          <span>${esc(time)}</span>\n          ${isOut ? "<span>✓</span>" : ""}\n        </div>\n      </div>`;
  }).join("");
  if (wasNearBottom || state.messages.length <= 5) {
    box.scrollTop = box.scrollHeight;
  }
}

function bindChatEvents() {
  const backBtn = document.getElementById("chatBackBtn");
  if (backBtn) {
    backBtn.onclick = () => {
      const listPane = document.getElementById("chatListPane");
      const winPane = document.getElementById("chatWinPane");
      if (listPane) listPane.classList.remove("hidden-mobile");
      if (winPane) winPane.classList.add("hidden-mobile");
      backBtn.style.display = "none";
    };
  }
  const sInput = document.getElementById("chatSearchInput");
  sInput?.addEventListener("input", debounce(e => {
    state.chatSearch = e.target.value;
    renderChatListItems();
  }, 150));
  document.querySelectorAll(".chat-filters .filter-btn").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".chat-filters .filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.chatFilter = btn.dataset.filter;
      renderChatListItems();
    };
  });
  const form = document.getElementById("chatComposerForm");
  const input = document.getElementById("chatInput");
  const sendBtn = document.getElementById("chatSendBtn");
  input?.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form?.dispatchEvent(new Event("submit"));
    }
  });
  form?.addEventListener("submit", async e => {
    e.preventDefault();
    const text = (input?.value || "").trim();
    if (!text || !state.activeChat || !state.activeChatPlatform) return;
    input.value = "";
    input.disabled = true;
    if (sendBtn) sendBtn.disabled = true;
    try {
      state.messages.push({
        from: "me",
        outgoing: true,
        text: text,
        ts: Date.now()
      });
      renderChatMessages(document.getElementById("chatMessagesBox"));
      await api("/api/chats/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          platform: state.activeChatPlatform,
          chatId: state.activeChat,
          text: text
        })
      });
      toast("Message sent");
    } catch (err) {
      toast("Send failed: " + err.message);
    } finally {
      input.disabled = false;
      if (sendBtn) sendBtn.disabled = false;
      input.focus();
    }
  });
}

const refreshOverviewStats = () => {
  if (state.page === "overview") refreshOverview().catch(() => {});
};

async function pluginReload() {
  return api("/api/plugins/reload", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: "{}"
  });
}

async function pageMessages() {
  $("#content").innerHTML = `\n    <div class="hero reveal"><div class="kicker">Live monitor</div><h2>Message <em>stream.</em></h2><p>In-memory tail of recent events. Nothing persisted to disk.</p></div>\n    <div class="section-head"><input class="fld grow" id="msgFilter" placeholder="filter sender, chat or text"><span class="mono dim small" id="msgCount"></span></div>\n    <div id="msgList" class="stream"></div>`;
  const draw = async () => {
    const items = await api("/api/messages?limit=150");
    const q = ($("#msgFilter")?.value || "").toLowerCase();
    const list = items.filter(m => !q || JSON.stringify(m).toLowerCase().includes(q));
    $("#msgList").innerHTML = list.length ? list.map(m => `\n      <article class="msg-item">\n        <div class="msg-meta"><span class="mono">${new Date(m.ts).toLocaleTimeString()}</span><span class="tag pur">${esc(fullName(m.platform))}</span><span class="strong">${esc(m.sender || "")}</span><span class="dim">${esc(m.type || "")}</span>${m.isCommand ? '<span class="tag ok">command</span>' : ""}</div>\n        <div class="msg-prev">${esc(m.preview || "(no text)")}</div>\n      </article>`).join("") : `<div class="empty">No messages captured yet. Talk to the bot first.</div>`;
    const cnt = $("#msgCount");
    if (cnt) cnt.textContent = list.length + " shown";
  };
  $("#msgFilter").addEventListener("input", debounce(draw, 250));
  await draw();
}

function prependMessage(m) {
  const list = $("#msgList");
  if (!list) return;
  const el = document.createElement("article");
  el.className = "msg-item";
  el.innerHTML = `<div class="msg-meta"><span class="mono">${new Date(m.ts).toLocaleTimeString()}</span><span class="tag pur">${esc(fullName(m.platform))}</span><span class="strong">${esc(m.sender || "")}</span><span class="dim">${esc(m.type || "")}</span>${m.isCommand ? '<span class="tag ok">command</span>' : ""}</div><div class="msg-prev">${esc(m.preview || "(no text)")}</div>`;
  list.prepend(el);
  while (list.children.length > 160) list.lastChild.remove();
}

async function pageGroups() {
  const rows = await api("/api/groups");
  $("#content").innerHTML = `\n    <div class="hero reveal"><div class="kicker">Presence</div><h2>Where the bot <em>lives.</em></h2></div>\n    <div class="card reveal table-wrap"><table class="tbl" data-responsive><thead><tr><th>Platform</th><th>Name</th><th>ID</th><th>Members</th><th>Flags</th></tr></thead><tbody>\n    ${rows.length ? rows.map(g => `<tr><td data-l="platform"><span class="tag pur">${esc(fullName(g.platform))}</span></td><td data-l="name" class="strong">${esc(g.name)}</td><td data-l="id" class="mono dim">${esc(g.id)}</td><td data-l="members" class="mono">${g.members ?? "—"}</td><td data-l="flags" class="small mut">${g.settings ? Object.entries(g.settings).filter(([, v]) => v).map(([k]) => k).join(", ") || "—" : "—"}</td></tr>`).join("") : `<tr><td colspan="5"><div class="empty">Nothing discovered yet.</div></td></tr>`}\n    </tbody></table></div>`;
}

async function pagePlugins() {
  const rows = await api("/api/plugins");
  $("#content").innerHTML = `\n    <div class="hero reveal"><div class="kicker">Modules</div><h2>Plugin <em>manager.</em></h2><p>Toggles persist per platform. Reload applies instantly on Discord; WhatsApp hot-reloads via file watcher.</p></div>\n    <div class="section-head"><button class="btn primary" id="reloadAllBtn">Reload all platforms</button><span class="mono dim small">${rows.length} modules loaded</span></div>\n    <div class="card reveal table-wrap"><table class="tbl" data-responsive><thead><tr><th>Platform</th><th>Name</th><th>Category</th><th>Status</th><th>Action</th></tr></thead><tbody>\n    ${rows.map(p => `<tr><td data-l="platform"><span class="tag pur">${esc(fullName(p.platform))}</span></td><td data-l="name" class="mono strong">${esc(p.name)}</td><td data-l="category" class="mut small">${esc(p.category || "—")}</td><td data-l="status"><span class="tag ${p.enabled ? "ok" : "err"}">${p.enabled ? "enabled" : "disabled"}</span></td>\n      <td data-l="action">${p.platform !== "whatsapp" ? `<button class="btn small" data-plat="${p.platform}" data-name="${esc(p.name)}" data-enable="${p.enabled ? "0" : "1"}">${p.enabled ? "Disable" : "Enable"}</button>` : '<span class="dim small">watcher</span>'}</td></tr>`).join("")}\n    </tbody></table></div>`;
  $("#reloadAllBtn").onclick = async () => {
    try {
      toast((await pluginReload()).message);
    } catch (e) {
      toast(e.message);
    }
  };
  document.querySelectorAll("[data-plat]").forEach(b => {
    b.onclick = async () => {
      try {
        const r = await api("/api/plugins/toggle", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            platform: b.dataset.plat,
            name: b.dataset.name,
            enable: b.dataset.enable === "1"
          })
        });
        toast(r.message);
        pagePlugins();
      } catch (e) {
        toast(e.message);
      }
    };
  });
}

async function pageBroadcast() {
  $("#content").innerHTML = `\n    <div class="hero reveal"><div class="kicker">Outreach</div><h2>Broadcast <em>center.</em></h2><p>Send one message to many chats at once. Use dry run first to preview destinations.</p></div>\n    <form id="bcForm" class="grid g2">\n      <section class="card reveal">\n        <div class="section-head"><h3>Message</h3></div>\n        <div class="field-row">\n          <label>Text (max 2000)</label>\n          <textarea class="fld" name="text" rows="6" maxlength="2000" placeholder="Server maintenance tonight 23:00 WIB..." style="resize:vertical;font-family:var(--sans)"></textarea>\n        </div>\n        <div class="actions" style="margin-top:14px">\n          <label class="chk"><input type="checkbox" name="p_wa" checked> WhatsApp</label>\n          <label class="chk"><input type="checkbox" name="p_tg" checked> Telegram</label>\n          <label class="chk"><input type="checkbox" name="p_dc" checked> Discord</label>\n        </div>\n      </section>\n      <section class="card reveal">\n        <div class="section-head"><h3>Targets</h3></div>\n        <label class="chk" style="margin-bottom:14px"><input type="checkbox" name="all_groups" checked> All known groups / servers</label>\n        <div class="tgt-section">\n          <div class="lbl" style="margin-bottom:8px">Custom targets</div>\n          ${[ "whatsapp", "telegram", "discord" ].map(p2 => `\n            <div style="margin-bottom:10px">\n              <span class="tag pur">${p2}</span>\n              <div class="tgt-chips" data-plat="${p2}"></div>\n              <div style="display:flex;gap:6px;margin-top:6px">\n                <input class="fld tgt-input" data-plat="${p2}" placeholder="${p2 === "whatsapp" ? "group JID" : p2 === "telegram" ? "chat ID" : "channel ID"}" style="flex:1;min-height:34px;font-family:var(--mono);font-size:12px">\n                <button type="button" class="btn small tgt-add" data-plat="${p2}">Add</button>\n              </div>\n            </div>`).join("")}\n        </div>\n      </section>\n      <div class="actions sticky-bar">\n        <button type="button" class="btn" id="bcDry">${svg("eye", 16)} Dry run</button>\n        <button type="submit" class="btn primary">${svg("send", 16)} Send broadcast</button>\n      </div>\n    </form>\n    <section class="card reveal hidden" id="bcResult"></section>`;
  const tgtChips = {};
  function renderChips(plat) {
    const box = document.querySelector(`.tgt-chips[data-plat="${plat}"]`);
    if (!box) return;
    box.innerHTML = (tgtChips[plat] || []).map((id, i) => `<span class="chip-target">${esc(id)}<button type="button" class="chip-x" data-p="${plat}" data-i="${i}">&times;</button></span>`).join("") || '<span class="tiny dim mono">none — will use all groups</span>';
    box.querySelectorAll(".chip-x").forEach(x => x.onclick = () => {
      tgtChips[plat].splice(Number(x.dataset.i), 1);
      renderChips(plat);
    });
  }
  [ "whatsapp", "telegram", "discord" ].forEach(plat => {
    tgtChips[plat] = [];
    document.querySelector(`.tgt-add[data-plat="${plat}"]`)?.addEventListener("click", () => {
      const inp = document.querySelector(`.tgt-input[data-plat="${plat}"]`);
      if (!inp || !inp.value.trim()) return;
      tgtChips[plat].push(inp.value.trim());
      inp.value = "";
      renderChips(plat);
    });
    renderChips(plat);
  });
  const collect = () => {
    const f = document.getElementById("bcForm");
    const lines = v => v.split(/\n+/).map(x => x.trim()).filter(Boolean);
    return {
      text: f.text.value,
      platforms: [ [ "p_wa", "whatsapp" ], [ "p_tg", "telegram" ], [ "p_dc", "discord" ] ].filter(([n]) => f[n].checked).map(([, v]) => v),
      all_groups: f.all_groups.checked,
      targets: {
        whatsapp: [ ...(f.t_wa.value || "").split("\n").filter(Boolean), ...tgtChips.whatsapp || [] ],
        telegram: [ ...(f.t_tg.value || "").split("\n").filter(Boolean), ...tgtChips.telegram || [] ],
        discord: [ ...(f.t_dc.value || "").split("\n").filter(Boolean), ...tgtChips.discord || [] ]
      }
    };
  };
  const runBc = async dry => {
    const body = {
      ...collect(),
      dry: dry
    };
    if (!body.text.trim()) return toast("Write the message first.");
    try {
      const r = await api("/api/broadcast", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });
      const box = document.getElementById("bcResult");
      box.classList.remove("hidden");
      if (r.dry) {
        box.innerHTML = `<div class="section-head"><h3>Dry run — ${r.total} destination(s)</h3></div>\n          <table class="tbl"><tbody>${(r.plan || []).map(p2 => `<tr><td data-l="platform"><span class="tag pur">${esc(p2.platform)}</span></td><td data-l="target" class="mono dim">${esc(p2.target)}</td></tr>`).join("") || '<tr><td class="empty">No destinations found.</td></tr>'}</tbody></table>`;
      } else {
        box.innerHTML = `<div class="section-head"><h3>Result</h3></div>\n          <p><span class="tag ok">${r.sent} sent</span> <span class="tag ${r.failed ? "err" : ""}">${r.failed} failed</span></p>\n          ${(r.failures || []).length ? `<table class="tbl"><tbody>${r.failures.map(f2 => `<tr><td data-l="platform"><span class="tag pur">${esc(f2.platform)}</span></td><td data-l="target" class="mono dim">${esc(f2.target)}</td><td data-l="error" class="small mut">${esc(f2.error)}</td></tr>`).join("")}</tbody></table>` : ""}`;
      }
    } catch (e) {
      toast(e.message);
    }
  };
  document.getElementById("bcDry").onclick = () => runBc(true);
  document.getElementById("bcForm").addEventListener("submit", e => {
    e.preventDefault();
    confirmThen("Send this broadcast for real?", () => runBc(false));
  });
}

async function pageLogs() {
  $("#content").innerHTML = `\n    <div class="hero reveal"><div class="kicker">Diagnostics</div><h2>Error &amp; log <em>center.</em></h2><p>Live stream plus the persisted NDJSON file. Click a row to expand.</p></div>\n    <div class="section-head wrap">\n      <input class="fld grow" id="logQ" placeholder="search message or source">\n      <select class="fld" id="logLevel"><option value="">all levels</option><option value="error">error</option><option value="warn">warn</option></select>\n      <button class="btn" id="logFileBtn">Load persisted file</button>\n      <button class="btn" id="logExport">Export NDJSON</button>\n      <button class="btn danger" id="logClear">Clear buffer</button>\n    </div>\n    <div class="card reveal logbox" id="logBox"></div>`;
  const render = items => {
    $("#logBox").innerHTML = items.length ? items.map(l => `\n      <div class="log-line">\n        <span class="mono dim">${new Date(l.ts).toLocaleTimeString()}</span>\n        <span class="lv ${l.level || "info"}">${esc(l.level || "info")}</span>\n        <span class="clip">[${esc(l.source || "-")}] ${esc(l.message || "")}</span>\n        ${l.origin ? `<div class="stack mono">origin: ${esc(l.origin)}</div>` : ""}\n      </div>`).join("") : `<div class="empty">Buffer empty — healthy run.</div>`;
    document.querySelectorAll(".log-line").forEach(el => el.addEventListener("click", () => el.classList.toggle("open")));
  };
  const draw = async () => {
    const q = $("#logQ").value, lvl = $("#logLevel").value;
    render(await api(`/api/logs?${q ? "q=" + encodeURIComponent(q) : ""}${lvl ? "&level=" + lvl : ""}`));
  };
  $("#logQ").addEventListener("input", debounce(draw, 300));
  $("#logLevel").addEventListener("change", draw);
  $("#logFileBtn").onclick = async () => {
    const items = await api("/api/logs/file");
    render(items.slice(0, 200).map(l => ({
      ts: new Date(l.wib || l.ts).getTime() || Date.now(),
      level: "error",
      source: l.source,
      message: l.message,
      origin: l.origin
    })));
  };
  $("#logExport").onclick = () => window.open("/api/logs/export", "_blank");
  $("#logClear").onclick = async () => {
    confirmThen("Clear in-memory log & message buffers?", async () => {
      await api("/api/logs/clear", {
        method: "POST"
      });
      toast("Buffers cleared.");
      draw();
    });
  };
  await draw();
}

function prependLog(l) {
  const box = $("#logBox");
  if (!box || state.page !== "logs") return;
  const div = document.createElement("div");
  div.className = "log-line";
  div.innerHTML = `<span class="mono dim">${new Date(l.ts).toLocaleTimeString()}</span><span class="lv ${l.level || "info"}">${esc(l.level || "info")}</span><span class="clip">[${esc(l.source || "-")}] ${esc(l.message || "")}</span>${l.origin ? `<div class="stack mono">origin: ${esc(l.origin)}</div>` : ""}`;
  div.addEventListener("click", () => div.classList.toggle("open"));
  box.prepend(div);
  while (box.children.length > 300) box.lastChild.remove();
}

const SETTING_SECTIONS = [ [ "Identity & prefixes", [ "botname", "prefix" ] ], [ "Access & limits", [ "settings.limit.enabled", "settings.limit.free", "settings.limit.premium", "settings.limit.reset", "settings.discord.dailyLimit" ] ], [ "WhatsApp behaviour", [ "settings.opts.autoRead", "settings.opts.selfMode", "settings.opts.dmOnly", "settings.opts.groupOnly", "settings.automation.autoTyping", "settings.automation.autoOnline", "settings.automation.autoBackup", "settings.connection.pairing_number" ] ], [ "Telegram behaviour", [ "settings.telegram.autoTyping", "settings.telegram.inlineMode", "settings.telegram.webHook", "settings.telegram.greeting", "settings.telegram.groupManager.welcomeMessage", "settings.telegram.groupManager.goodbyeMessage", "settings.telegram.groupManager.autoGreeting", "settings.telegram.groupManager.verification", "settings.telegram.groupManager.moderation" ] ], [ "Discord presence", [ "settings.discord.presence.name", "settings.discord.presence.type", "settings.discord.presence.state", "settings.discord.presence.status" ] ], [ "Group safety", [ "settings.group.welcome", "settings.group.antilink", "settings.group.antivirtex", "settings.group.antidelete", "settings.verification.enabled" ] ], [ "Media & Stickers", [ "settings.media.sticker.packname", "settings.media.sticker.author", "settings.media.watermark", "settings.media.watermarkText" ] ], [ "System, Games & Logs", [ "settings.afk.enabled", "settings.afk.message", "settings.game.enabled", "settings.game.rpg", "settings.game.dailyReward", "settings.game.dailyAmount", "settings.system.cooldown", "settings.log.level", "settings.log.error" ] ], [ "Dashboard & Public Web", [ "settings.website.enabled", "settings.website.mode", "settings.website.port", "settings.website.domain", "settings.website.title", "settings.website.caption", "settings.website.description", "settings.website.thumb", "settings.website.theme", "settings.website.tunnel.enabled", "settings.website.tunnel.token", "settings.website.tunnel.domain", "settings.maintenance" ] ] ];

async function pageSettings() {
  const data = await api("/api/settings");
  const schema = (await api("/api/schema")).fields;
  const fieldHtml = key => {
    const def = schema[key];
    const v = data.values[key];
    const name = "f_" + key.replace(/\./g, "_");
    let input;
    if (def.type === "boolean") input = `<select class="fld" name="${name}" data-key="${key}"><option value="true" ${v ? "selected" : ""}>on</option><option value="false" ${!v ? "selected" : ""}>off</option></select>`; else if (def.type === "enum") input = `<select class="fld" name="${name}" data-key="${key}">${def.options.map(o => `<option ${o === v ? "selected" : ""}>${o}</option>`).join("")}</select>`; else input = `<input class="fld" name="${name}" data-key="${key}" value="${esc(v ?? "")}" ${def.max ? `maxlength="${def.max}"` : ""}>`;
    return `<div class="field-row"><label>${esc(def.label || key)}</label>${input}<span class="mono dim tiny">${key}</span></div>`;
  };
  $("#content").innerHTML = `\n    <div class="hero reveal"><div class="kicker">Configuration</div><h2>Tune everything, <em>type nothing twice.</em></h2><p>Structured fields validated server-side against a whitelist schema. Every save snapshots a backup.</p></div>\n    <form id="setForm">\n      ${SETTING_SECTIONS.map(([title, keys]) => `\n        <section class="card reveal">\n          <div class="section-head"><h3>${title}</h3></div>\n          <div class="form-grid">${keys.map(fieldHtml).join("")}</div>\n        </section>`).join("")}\n      <div class="actions sticky-bar">\n        <button type="submit" class="btn primary">Save &amp; apply live</button>\n        <button type="reset" class="btn">Reset form</button>\n        <button type="button" class="btn" id="reloadCfg">Reload from disk</button>\n      </div>\n    </form>\n    <section class="card reveal">\n      <div class="section-head"><h3>Settings backups</h3><span class="mono dim small">last 10 kept</span></div>\n      <div class="table-wrap"><table class="tbl"><tbody id="backupRows"></tbody></table></div>\n    </section>\n    <section class="card reveal">\n      <div class="section-head"><h3>Database safety</h3><button class="btn small primary" id="dbBackupBtn">Create backup now</button></div>\n      <div id="dbIntegrity" class="small mut"></div>\n      <div class="section-head" style="margin-top:16px"><h3>DB backups</h3><span class="mono dim small">last 10 kept</span></div>\n      <div class="table-wrap"><table class="tbl"><tbody id="dbBackupRows"></tbody></table></div>\n    </section>`;
  const [backups, dbBackups, integrity] = await Promise.all([ api("/api/backups"), api("/api/db/backups").catch(() => []), api("/api/db/integrity").catch(() => ({
    valid: false
  })) ]);
  $("#dbIntegrity").innerHTML = `Integrity: ${integrity.valid ? '<span class="tag ok">valid</span>' : '<span class="tag err">corrupt — ' + esc(integrity.error || "") + "</span>"} · ${(integrity.size / 1024).toFixed(1)} KB`;
  $("#dbBackupBtn").onclick = async () => {
    await api("/api/db/backup", {
      method: "POST"
    });
    toast("Database backup created.");
    pageSettings();
  };
  $("#dbBackupRows").innerHTML = Array.isArray(dbBackups) && dbBackups.length ? dbBackups.slice(0, 8).map(b => `<tr><td data-l="file" class="mono">${esc(b.file)}</td><td data-l="size" class="mono dim">${fmtBytes(b.size)}</td><td style="text-align:right"><button class="btn small" data-dbrestore="${esc(b.file)}">Restore</button></td></tr>`).join("") : `<tr><td><div class="empty">No database backups yet.</div></td></tr>`;
  document.querySelectorAll("[data-dbrestore]").forEach(b => {
    b.onclick = () => confirmThen("Restore this database backup? Current data will be overwritten.", async () => {
      try {
        await api("/api/db/restore", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            file: b.dataset.dbrestore
          })
        });
        toast("Database restored. Restart bot to apply.");
      } catch (e) {
        toast(e.message);
      }
    });
  });
  $("#backupRows").innerHTML = backups.length ? backups.slice(0, 8).map(b => `<tr><td data-l="file" class="mono">${esc(b.file.replace("settings-", "").replace(".json", ""))}</td><td data-l="size" class="mono dim">${fmtBytes(b.size)}</td><td style="text-align:right"><button class="btn small" data-bk="${esc(b.file)}">Restore</button></td></tr>`).join("") : `<tr><td><div class="empty">No backups yet. Save once to create one.</div></td></tr>`;
  document.querySelectorAll("[data-bk]").forEach(b => {
    b.onclick = () => confirmThen("Restore this backup over current overlay?", async () => {
      toast((await api("/api/settings/restore", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          file: b.dataset.bk
        })
      })).message);
      pageSettings();
    });
  });
  $("#reloadCfg").onclick = async () => toast((await api("/api/settings/reload", {
    method: "POST"
  })).message);
  $("#setForm").addEventListener("submit", async e => {
    e.preventDefault();
    const values = {};
    e.target.querySelectorAll("[data-key]").forEach(el => {
      const def = schema[el.dataset.key];
      let v = el.value;
      if (def?.type === "boolean") v = v === "true"; else if (def?.type === "number") v = Number(v);
      values[el.dataset.key] = v;
    });
    try {
      const r = await api("/api/settings/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          botname: e.target.querySelector("[data-key='botname']").value,
          prefix: e.target.querySelector("[data-key='prefix']").value,
          values: values
        })
      });
      toast(r.message);
    } catch (err) {
      toast("Save failed: " + err.message);
    }
  });
}

async function pageTunnel() {
  const t = await api("/api/tunnel/status").catch(() => ({
    available: false,
    status: "error"
  }));
  const staticUrl = t.staticUrl || "https://your-domain.sslip.io";
  const isConnected = t.active && t.publicUrl;
  const isStarting = t.status === "starting" || t.active && !t.publicUrl;
  const isNamedTunnel = t.hasToken || t.mode === "token";
  const statusCls = isConnected ? "ok" : isStarting ? "warn" : "err";
  const statusLabel = isConnected ? isNamedTunnel ? "Connected (Named Tunnel)" : "Connected (Quick Tunnel)" : isStarting ? "Starting…" : "Stopped";
  $("#content").innerHTML = `\n    <div class="hero reveal">\n      <div class="kicker">Remote Access & Domains</div>\n      <h2>Public Web <em>Access.</em></h2>\n      <p>Access your Akano-Bot dashboard securely from anywhere via permanent static domain or Cloudflare Tunnel.</p>\n    </div>\n\n    \x3c!-- Permanent Static Domain Card --\x3e\n    <div class="card reveal" style="padding:24px;border:1px solid rgba(34,197,94,.35);background:radial-gradient(ellipse at top left, rgba(34,197,94,.08), transparent 70%), var(--card-bg)">\n      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px">\n        <div>\n          <span class="tag ok" style="font-size:12px;margin-bottom:8px">● Static Domain · Permanent SSL</span>\n          <h3 style="font-size:18px;font-weight:700">Dedicated Static Domain</h3>\n          <p class="mono dim tiny" style="margin-top:4px">Server IP: your-domain.sslip.io · Port 80 / 443 (HTTPS) · Zero Configuration</p>\n        </div>\n        <div class="actions">\n          <button class="btn small" id="btnCopyStaticUrl">Copy Static URL</button>\n          <a href="${esc(staticUrl)}" target="_blank" rel="noreferrer" class="btn small primary">Open Static URL →</a>\n        </div>\n      </div>\n      <div style="margin-top:16px;padding:14px 18px;background:rgba(0,0,0,.25);border-radius:10px;border:1px solid rgba(255,255,255,.06);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">\n        <div>\n          <div class="lbl" style="margin-bottom:4px">Permanent Public URL (Never Changes on Restart)</div>\n          <a href="${esc(staticUrl)}" target="_blank" rel="noreferrer" class="mono strong" style="color:var(--ink);font-size:16px;text-decoration:underline;text-underline-offset:4px">${esc(staticUrl)}</a>\n        </div>\n        <span class="mono tiny dim">Let's Encrypt TLS Valid</span>\n      </div>\n      <p class="small dim" style="margin-top:12px;line-height:1.5">\n        This static URL is permanently linked to your server. Unlike quick tunnels, this address remains constant through server restarts and bot reloads.\n      </p>\n    </div>\n\n    \x3c!-- Cloudflare Tunnel Card --\x3e\n    <div class="card reveal" style="margin-top:16px;padding:24px;border:1px solid ${isConnected ? "rgba(59,130,246,.3)" : "var(--line)"}">\n      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px">\n        <div>\n          <span class="tag ${statusCls}" style="font-size:12px;margin-bottom:8px">${statusLabel}</span>\n          <h3 style="font-size:18px;font-weight:700">Cloudflared Secure Tunnel</h3>\n          <p class="mono dim tiny" style="margin-top:4px">Provider: cloudflared · Mode: ${isNamedTunnel ? "Token (Static Custom Domain)" : "Quick Tunnel (trycloudflare.com)"}</p>\n        </div>\n        <div class="actions">\n          ${!t.active ? `\n            <button class="btn primary" id="btnStartTunnel">${svg("tunnel", 16)} Start Tunnel</button>\n          ` : `\n            <button class="btn danger" id="btnStopTunnel">Stop Tunnel</button>\n          `}\n          <button class="btn" id="btnRefreshTunnel">Refresh</button>\n        </div>\n      </div>\n\n      ${isConnected ? `\n        <div style="margin-top:20px;padding:16px;background:rgba(255,255,255,.04);border-radius:12px;border:1px solid var(--line-strong);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">\n          <div>\n            <div class="lbl" style="margin-bottom:4px">Live Cloudflare Tunnel URL</div>\n            <a href="${esc(t.publicUrl)}" target="_blank" rel="noreferrer" class="mono strong" style="color:var(--ink);font-size:16px;text-decoration:underline;text-underline-offset:4px">${esc(t.publicUrl)}</a>\n          </div>\n          <div class="actions">\n            <button class="btn small" id="btnCopyTunnelUrl">Copy URL</button>\n            <a href="${esc(t.publicUrl)}" target="_blank" rel="noreferrer" class="btn small primary">Open Dashboard →</a>\n          </div>\n        </div>\n      ` : isStarting ? `\n        <div style="margin-top:20px;padding:16px;background:rgba(245,158,11,.08);border-radius:12px;border:1px solid rgba(245,158,11,.2)">\n          <p class="small" style="color:var(--warn)">Tunnel is starting and establishing Cloudflare connection... Please wait 5-10 seconds.</p>\n        </div>\n      ` : `\n        <div style="margin-top:20px;padding:16px;background:rgba(255,255,255,.02);border-radius:12px;border:1px solid var(--line)">\n          <p class="small dim">Tunnel is currently stopped. Click "Start Tunnel" above to generate a public URL.</p>\n        </div>\n      `}\n    </div>\n\n    <div class="grid g2" style="margin-top:16px">\n      <div class="card reveal">\n        <div class="section-head"><h3>Permanent Custom Domain via Cloudflare</h3></div>\n        <p class="small mut" style="line-height:1.6">\n          To bind your own custom domain (e.g. <code>dash.yourdomain.com</code>) via Cloudflare Zero Trust:\n        </p>\n        <ol class="small mut" style="margin-top:8px;padding-left:18px;line-height:1.8">\n          <li>Create a tunnel in Cloudflare Zero Trust dashboard.</li>\n          <li>Copy your Tunnel Token.</li>\n          <li>Set it in <b>Settings → Dashboard & Public Web → Cloudflare Tunnel Token</b>.</li>\n          <li>The bot will automatically run <code>cloudflared tunnel run --token ...</code> for a static domain.</li>\n        </ol>\n      </div>\n      <div class="card reveal">\n        <div class="section-head"><h3>Access Security</h3></div>\n        <p class="small mut" style="line-height:1.6">\n          The public dashboard is protected by SHA256 cookie session authentication, rate-limiting, and strict origin validation. Never share your console key with unauthorized parties.\n        </p>\n        <div style="margin-top:14px">\n          <button class="btn small" id="btnGoToSettings">Configure Domain Settings →</button>\n        </div>\n      </div>\n    </div>\n  `;
  document.getElementById("btnRefreshTunnel")?.addEventListener("click", () => pageTunnel());
  document.getElementById("btnCopyStaticUrl")?.addEventListener("click", () => {
    navigator.clipboard.writeText(staticUrl).then(() => toast("Static domain URL copied to clipboard!", "success"));
  });
  document.getElementById("btnGoToSettings")?.addEventListener("click", () => go("settings"));
  document.getElementById("btnStartTunnel")?.addEventListener("click", async () => {
    toast("Starting tunnel...", "info");
    try {
      await api("/api/tunnel/start", {
        method: "POST"
      });
      setTimeout(pageTunnel, 1500);
    } catch (e) {
      toast(e.message, "error");
    }
  });
  document.getElementById("btnStopTunnel")?.addEventListener("click", async () => {
    confirmThen("Stop the public tunnel? Direct static access will remain online.", async () => {
      try {
        await api("/api/tunnel/stop", {
          method: "POST"
        });
        toast("Tunnel stopped", "info");
        pageTunnel();
      } catch (e) {
        toast(e.message, "error");
      }
    });
  });
  document.getElementById("btnCopyTunnelUrl")?.addEventListener("click", () => {
    if (t.publicUrl) {
      navigator.clipboard.writeText(t.publicUrl).then(() => toast("Tunnel URL copied to clipboard!", "success"));
    }
  });
}

async function pageConnections() {
  const data = await api("/api/bots").catch(() => ({}));
  $("#content").innerHTML = `\n    <div class="hero reveal">\n      <div class="kicker">Runtimes</div>\n      <h2>Bot <em>Connections.</em></h2>\n      <p>Realtime connection status, pairing, and credential controls for all connected platforms.</p>\n    </div>\n    <div class="grid g3">\n      \x3c!-- WhatsApp Card --\x3e\n      <div class="card reveal">\n        <div class="card-head">\n          <span class="ico-chip">${svg("whatsapp", 20)}</span>\n          <div class="lbl">WhatsApp</div>\n        </div>\n        <div class="val" style="font-size:18px">${data.whatsapp ? waBadge({
    state: data.whatsapp.state
  }) : "Offline"}</div>\n        <div class="kv" style="margin-top:12px"><span>Identity</span><b>${esc(data.whatsapp?.user || "—")}</b></div>\n        <div class="kv"><span>Phone</span><b class="mono">${esc(data.whatsapp?.phonePretty || data.whatsapp?.phone || "—")}</b></div>\n        <div class="kv"><span>Session</span><b class="mono">${esc(data.whatsapp?.sessionName || "sessions")}</b></div>\n        <div class="subsec" style="margin-top:14px;border-top:1px solid var(--line);padding-top:12px">\n          ${data.whatsapp && !data.whatsapp.sessionInfo?.creds ? `\n            <form class="pair-form" data-bot="whatsapp">\n              <input class="fld grow" name="phone" placeholder="e.g. YOUR_PHONE_NUMBER" value="${esc(data.whatsapp.phone || "")}">\n              <button class="btn primary small" type="submit">${svg("send", 14)} Pair Code</button>\n            </form>\n            <div class="pair-result hidden mono" style="margin-top:8px"></div>\n          ` : `<span class="tag ok">Linked &amp; Active</span>`}\n        </div>\n      </div>\n\n      \x3c!-- Telegram Card --\x3e\n      <div class="card reveal">\n        <div class="card-head">\n          <span class="ico-chip">${svg("telegram", 20)}</span>\n          <div class="lbl">Telegram</div>\n        </div>\n        <div class="val" style="font-size:18px">\n          <span class="tag ${data.telegram?.connected ? "ok" : "err"}">${data.telegram?.connected ? "Online" : "Offline"}</span>\n        </div>\n        <div class="kv" style="margin-top:12px"><span>Bot Username</span><b class="mono">${esc(data.telegram?.username ? "@" + data.telegram.username : "—")}</b></div>\n        <div class="kv"><span>Token</span><b class="mono">${esc(data.telegram?.tokenMasked || "not set")}</b></div>\n        <div class="subsec" style="margin-top:14px;border-top:1px solid var(--line);padding-top:12px">\n          <form class="tok-form" data-bot="telegram">\n            <input class="fld grow" name="token" type="password" placeholder="Replace Telegram token">\n            <button class="btn small" type="submit">Save</button>\n          </form>\n        </div>\n      </div>\n\n      \x3c!-- Discord Card --\x3e\n      <div class="card reveal">\n        <div class="card-head">\n          <span class="ico-chip">${svg("discord", 20)}</span>\n          <div class="lbl">Discord</div>\n        </div>\n        <div class="val" style="font-size:18px">\n          <span class="tag ${data.discord?.connected ? "ok" : "err"}">${data.discord?.connected ? "Ready" : "Offline"}</span>\n        </div>\n        <div class="kv" style="margin-top:12px"><span>Bot Tag</span><b class="mono">${esc(data.discord?.user || "—")}</b></div>\n        <div class="kv"><span>Guilds</span><b class="mono">${data.discord?.guilds ?? 0}</b></div>\n        <div class="subsec" style="margin-top:14px;border-top:1px solid var(--line);padding-top:12px">\n          <form class="tok-form" data-bot="discord">\n            <input class="fld grow" name="token" type="password" placeholder="Replace Discord token">\n            <button class="btn small" type="submit">Save</button>\n          </form>\n        </div>\n      </div>\n    </div>\n  `;
  document.querySelectorAll(".tok-form").forEach(f => {
    f.onsubmit = async e => {
      e.preventDefault();
      const plat = f.dataset.bot;
      const tok = f.token.value.trim();
      if (!tok) return toast("Enter a token first", "warn");
      try {
        const r = await api("/api/bots/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            platform: plat,
            token: tok
          })
        });
        toast(r.message, "success");
        f.token.value = "";
        pageConnections();
      } catch (err) {
        toast(err.message, "error");
      }
    };
  });
  document.querySelectorAll(".pair-form").forEach(f => {
    f.onsubmit = async e => {
      e.preventDefault();
      const num = f.phone.value.trim();
      if (!num) return toast("Enter phone number", "warn");
      const resBox = f.parentElement.querySelector(".pair-result");
      try {
        const r = await api("/api/bots/whatsapp/pair", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            number: num
          })
        });
        if (resBox) {
          resBox.classList.remove("hidden");
          resBox.textContent = "Pairing Code: " + (r.code || JSON.stringify(r));
        }
        toast("Code requested", "success");
      } catch (err) {
        toast(err.message, "error");
      }
    };
  });
}

async function pageAbout() {
  const status = await api("/api/status").catch(() => ({}));
  $("#content").innerHTML = `\n    <div class="hero reveal">\n      <div class="kicker">System Information</div>\n      <h2>About <em>Akano-Bot.</em></h2>\n      <p>Enterprise multi-platform bot framework and unified control hub.</p>\n    </div>\n    <div class="grid g3">\n      <div class="card reveal">\n        <div class="lbl">Bot Version</div>\n        <div class="val mono" style="font-size:20px">${esc(status.version || "2.0.0")}</div>\n        <div class="sub">Node.js ${esc(status.node || "v20")}</div>\n      </div>\n      <div class="card reveal">\n        <div class="lbl">Host OS</div>\n        <div class="val mono" style="font-size:20px">${esc(status.platform || "Linux")}</div>\n        <div class="sub">PID ${status.pid || process.pid || "—"}</div>\n      </div>\n      <div class="card reveal">\n        <div class="lbl">Connected Engines</div>\n        <div class="val" style="font-size:20px">\n          ${[ status.whatsapp?.connected && "WhatsApp", status.telegram?.connected && "Telegram", status.discord?.connected && "Discord" ].filter(Boolean).join(" · ") || "Standby"}\n        </div>\n        <div class="sub">WebSocket Realtime Hub</div>\n      </div>\n    </div>\n    <section class="card reveal" style="margin-top:16px">\n      <div class="section-head"><h3>Framework Highlights</h3></div>\n      <div style="display:flex;flex-direction:column;gap:12px;line-height:1.6;color:var(--mut);font-size:14px">\n        <p>• <b>Unified SDK:</b> Seamless multi-platform plugins operating simultaneously across WhatsApp, Telegram, and Discord.</p>\n        <p>• <b>Full WebSocket Architecture:</b> Low-latency duplex communications with auto-reconnection and event bus broadcasting.</p>\n        <p>• <b>Universal Chat Center:</b> Cross-platform messaging, real-time message stream, and outgoing message relay.</p>\n        <p>• <b>Zero-Port Public Tunneling:</b> Cloudflared tunneling integration allowing one-click worldwide remote administration.</p>\n      </div>\n    </section>\n  `;
}

async function pageSystem() {
  const [s, stor, health] = await Promise.all([ api("/api/system"), api("/api/storage"), api("/api/health").catch(() => null) ]);
  const memPct = Math.round((s ? (s.totalMem - s.freeMem) / s.totalMem : 0) * 100);
  const rows = [ [ "Node.js", s.node ], [ "OS", s.os ], [ "Arch", s.arch ], [ "CPU", `${s.cpuModel} ×${s.cpus}` ], [ "Process uptime", fmtUptime(s.uptimeProcess) ], [ "PID", s.pid ], [ "Bot version", s.version ], [ "Commit", s.commit || "—" ] ];
  $("#content").innerHTML = `\n    <div class="hero reveal"><div class="kicker">Host</div><h2>System <em>vitals.</em></h2></div>\n    <div class="grid g3">\n      <div class="card reveal center"><canvas id="gaugeRam" width="120" height="120"></canvas><div class="lbl">RAM ${memPct}%</div><div class="sub mono">${fmtBytes(stor.systemFree)} free</div></div>\n      <div class="card reveal center"><canvas id="gaugeDisk" width="120" height="120"></canvas><div class="lbl">Storage ${stor.usedPct}%</div><div class="sub mono">${stor.totalSizeMB} MB bot files</div></div>\n      <div class="card reveal"><div class="section-head"><h3>Health</h3></div>${health ? Object.entries(health).map(([k, v]) => `<div class="kv-row"><span class="lbl">${k}</span><span class="tag ${v.state === "linked" || v.state === "ready" || v.state === "online" ? "ok" : v.state === "connecting" ? "warn" : "err"}">${v.label}</span></div>`).join("") : ""}</div>\n    </div>\n    <section class="card reveal">\n      <div class="section-head"><h3>Storage breakdown</h3><span class="mono dim small">${stor.totalSizeMB} MB total</span></div>\n      ${stor.dirs.filter(d => d.fileCount > 0).map(d => `<div class="kv-row"><span class="lbl">${esc(d.name)}</span><span class="mono">${d.sizeMB} MB · ${d.fileCount} files</span></div>`).join("")}\n    </section>\n    <section class="card reveal">\n      <div class="section-head"><h3>Restart scheduler</h3></div>\n      <div class="actions"><input type="number" class="fld" id="schedHour" min="0" max="23" placeholder="hour (0-23)" style="width:100px" value="${await api("/api/schedule").then(r => r.hour ?? "").catch(() => "")}"><button class="btn small" id="schedSet">Set</button><button class="btn small danger" id="schedClear">Clear</button></div>\n    </section>\n    <section class="card reveal">\n      <div class="section-head"><h3>Terminal output</h3><button class="btn small" id="termRefresh">Refresh</button></div>\n      <pre id="termOut" class="mono tiny dim" style="max-height:300px;overflow:auto;background:#060809;padding:12px;border-radius:10px;white-space:pre-wrap;word-break:break-all"></pre>\n    </section>\n    <div class="card reveal table-wrap"><table class="tbl" data-responsive><tbody>${rows.map(([k, v]) => `<tr><td data-l="${k}" class="mut">${k}</td><td class="mono strong">${esc(v)}</td></tr>`).join("")}</tbody></table></div>`;
  function drawGauge(canvasId, pct) {
    const cv = document.getElementById(canvasId);
    if (!cv) return;
    const g = cv.getContext("2d");
    g.clearRect(0, 0, 120, 120);
    g.beginPath();
    g.arc(60, 60, 50, 0, Math.PI * 2);
    g.strokeStyle = "#1a1a22";
    g.lineWidth = 10;
    g.stroke();
    g.beginPath();
    g.arc(60, 60, 50, -Math.PI / 2, -Math.PI / 2 + pct / 100 * Math.PI * 2);
    g.strokeStyle = pct > 85 ? "#EF4444" : pct > 65 ? "#F97316" : "#22C55E";
    g.lineWidth = 10;
    g.lineCap = "round";
    g.stroke();
    g.fillStyle = "#F2F2F3";
    g.font = "bold 22px 'Plus Jakarta Sans'";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(pct + "%", 60, 60);
  }
  drawGauge("gaugeRam", memPct);
  drawGauge("gaugeDisk", stor.usedPct);
  const loadTerm = async () => {
    const lines = await api("/api/terminal?n=150").catch(() => []);
    const el = document.getElementById("termOut");
    if (el) {
      el.innerHTML = lines.map(l => `<span style="color:${l.type === "err" ? "#EF4444aa" : "#63636B"}">${esc(l.text)}</span>`).join("");
      el.scrollTop = el.scrollHeight;
    }
  };
  $("#termRefresh").onclick = loadTerm;
  loadTerm();
  $("#schedSet").onclick = async () => {
    const h = parseInt($("#schedHour").value, 10);
    if (isNaN(h) || h < 0 || h > 23) return toast("Hour must be 0-23.");
    const r = await api("/api/schedule", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        hour: h
      })
    });
    toast(r.message);
  };
  $("#schedClear").onclick = async () => {
    await api("/api/schedule", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        hour: null
      })
    });
    toast("Schedule cleared.");
  };
}

async function pageAudit() {
  const rows = await api("/api/audit");
  $("#content").innerHTML = `\n    <div class="hero reveal"><div class="kicker">Trail</div><h2>Audit <em>log.</em></h2><p>Owner-side action history. Credentials are never recorded.</p></div>\n    <div class="card reveal table-wrap"><table class="tbl" data-responsive><thead><tr><th>Time</th><th>Action</th><th>Result</th><th>Detail</th></tr></thead><tbody>\n    ${rows.length ? rows.map(r => `<tr><td data-l="time" class="mono dim">${esc(r.ts || "")}</td><td data-l="action" class="mono strong">${esc(r.action || "")}</td><td data-l="result"><span class="tag ${r.result === "ok" ? "ok" : r.result === "failed" ? "err" : "pur"}">${esc(r.result || "-")}</span></td><td data-l="detail" class="small mut">${esc(r.detail || "")}</td></tr>`).join("") : `<tr><td colspan="4"><div class="empty">No entries yet.</div></td></tr>`}\n    </tbody></table></div>`;
}

checkAuth();