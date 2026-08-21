const crypto = require("crypto");

const UNIQUE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const STATUS = {
  PENDING: "pending",
  VERIFIED: "verified",
  EXPIRED: "expired",
  FAILED: "failed",
  APPROVED: "approved",
};

function getConfig() {
  const cfg = global.settings?.verification || {};
  return {
    enabled: cfg.enabled !== false,
    captchaLength: Number(cfg.captchaLength) > 0 ? Number(cfg.captchaLength) : 6,
    expiresIn: Number(cfg.expiresIn) > 0 ? Number(cfg.expiresIn) : 5 * 60 * 1000,
    maxAttempts: Number(cfg.maxAttempts) > 0 ? Number(cfg.maxAttempts) : 3,
  };
}

function getState() {
  if (!global.db?.data || typeof global.db.data !== "object") return {};
  if (!global.db.data.verifications || typeof global.db.data.verifications !== "object") {
    global.db.data.verifications = {};
  }
  return global.db.data.verifications;
}

function stateKey(groupJid, userJid) {
  return `wa:${groupJid}:${userJid}`;
}

function generateCaptcha(length) {
  const max = Math.floor(256 / UNIQUE_CHARS.length) * UNIQUE_CHARS.length;
  let code = "";
  while (code.length < length) {
    const byte = crypto.randomBytes(1)[0];
    if (byte < max) code += UNIQUE_CHARS[byte % UNIQUE_CHARS.length];
  }
  return code;
}

function formatCaptchaMessage(code, minutes) {
  return (
    "Verification\n\n" +
    `Code: ${code}\n\n` +
    "Reply to this message with the code above.\n\n" +
    `Valid for ${minutes} minutes.`
  );
}

function formatQuestionMessage(question, minutes) {
  return (
    "Verification\n\n" +
    `Question: ${question}\n\n` +
    "Reply to this message with the answer above.\n\n" +
    `Valid for ${minutes} minutes.`
  );
}

function persist() {
  if (!global.db?.write) return Promise.resolve();
  return global.db.write().catch(() => {});
}

function findStateKeyByCaptchaMessageId(messageId) {
  if (!messageId) return null;
  const state = getState();
  for (const key of Object.keys(state)) {
    if (state[key]?.cptId === messageId) return key;
  }
  return null;
}

async function resolveToPhoneJid(sock, jid) {
  jid = sock.decodeJid(jid);
  if (!jid || !jid.endsWith("@lid")) return jid;
  if (typeof sock.findUserId !== "function") return jid;
  try {
    const info = await sock.findUserId(jid);
    if (info && typeof info.phoneNumber === "string" && info.phoneNumber.includes("@")) {
      return info.phoneNumber;
    }
  } catch (e) {}
  return jid;
}

async function sameUser(sock, a, b) {
  a = sock.decodeJid(a);
  b = sock.decodeJid(b);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.endsWith("@lid") || b.endsWith("@lid")) {
    try {
      const resolvedA = await resolveToPhoneJid(sock, a);
      const resolvedB = await resolveToPhoneJid(sock, b);
      return resolvedA === resolvedB || a === resolvedB || resolvedA === b;
    } catch (e) {
      return false;
    }
  }
  return false;
}

function sweepExpired() {
  const state = getState();
  const config = getConfig();
  const now = Date.now();
  let changed = false;
  for (const key of Object.keys(state)) {
    const verification = state[key];
    if (!verification || typeof verification !== "object") {
      delete state[key];
      changed = true;
      continue;
    }
    const isTerminal = [STATUS.VERIFIED, STATUS.APPROVED, STATUS.FAILED, STATUS.EXPIRED].includes(
      verification.status,
    );
    const isStale = now > (verification.expiresAt || 0) + (config.expiresIn || 0);
    if (isTerminal || (verification.status === STATUS.PENDING && isStale)) {
      delete state[key];
      changed = true;
    }
  }
  if (changed) persist();
  return changed;
}

function startSweeper() {
  if (global.verificationSweeperStarted) return;
  global.verificationSweeperStarted = true;
  const timer = setInterval(
    () => {
      try {
        sweepExpired();
      } catch (e) {}
    },
    5 * 60 * 1000,
  );
  if (timer.unref) timer.unref();
}

async function onJoinRequest(sock, { id, participant, action }) {
  startSweeper();
  const config = getConfig();
  if (!config.enabled) return;
  const groupJid = sock.decodeJid(id);
  if (!groupJid || typeof groupJid !== "string" || !groupJid.endsWith("@g.us")) return;
  if (!participant || typeof participant !== "string") return;

  let userJid = sock.decodeJid(participant);
  if (!userJid.includes("@")) return;

  try {
    const metadata = await global.store?.fetchGroupMetadata(groupJid, sock);
    const found = metadata?.participants?.find(
      (u) =>
        (typeof u.id === "string" && sock.decodeJid(u.id) === userJid) ||
        (typeof u.lid === "string" && u.lid === userJid),
    );
    if (found && typeof found.phoneNumber === "string" && found.phoneNumber.includes("@")) {
      userJid = found.phoneNumber;
    }
  } catch (e) {}

  const key = stateKey(groupJid, userJid);
  const state = getState();

  if (action === "revoked" || action === "rejected") {
    if (state[key]) {
      delete state[key];
      await persist();
    }
    return;
  }

  if (action !== "created") return;

  const chat = global.db?.data?.chats?.[groupJid] || {};
  if (chat.verification === false) return;

  if (state[key] && [STATUS.PENDING, STATUS.VERIFIED].includes(state[key].status)) return;

  const useQuestion =
    typeof chat.verifQuestion === "string" &&
    chat.verifQuestion.trim() &&
    typeof chat.verifAnswer === "string" &&
    chat.verifAnswer.trim();

  const captcha = useQuestion ? null : generateCaptcha(config.captchaLength);
  const verification = {
    userJid,
    groupJid,
    captcha,
    question: useQuestion ? chat.verifQuestion.trim() : null,
    answer: useQuestion ? chat.verifAnswer.trim() : null,
    attempts: 0,
    createdAt: Date.now(),
    expiresAt: Date.now() + config.expiresIn,
    status: STATUS.PENDING,
    cptId: null,
  };
  state[key] = verification;

  try {
    const minutes = Math.max(1, Math.round(config.expiresIn / 60000));
    const text = useQuestion
      ? formatQuestionMessage(chat.verifQuestion.trim(), minutes)
      : formatCaptchaMessage(captcha, minutes);
    const sent = await sock.sendMessage(userJid, { text });
    verification.cptId = sent?.key?.id;
    if (!verification.cptId) {
      delete state[key];
      await persist();
      return;
    }
    await persist();
  } catch (e) {
    delete state[key];
    await persist();
    global.logError("whatsapp.verification.send", e);
  }
}

async function handleReply(sock, m) {
  const config = getConfig();
  if (!config.enabled) return false;
  if (m.fromMe) return false;
  if (!m.quoted || typeof m.quoted.id !== "string") return false;

  const key = findStateKeyByCaptchaMessageId(m.quoted.id);
  if (!key) return false;

  const state = getState();
  const verification = state[key];
  if (!verification) return false;

  if (!(await sameUser(sock, m.sender, verification.userJid))) return false;
  if (!(await sameUser(sock, m.chat, verification.userJid))) return false;

  if ([STATUS.VERIFIED, STATUS.APPROVED].includes(verification.status)) return true;
  if (verification.status !== STATUS.PENDING) return true;

  const chat = global.db?.data?.chats?.[verification.groupJid] || {};
  if (chat.verification === false) return true;

  if (Date.now() > verification.expiresAt) {
    delete state[key];
    await persist();
    await sock
      .reply(
        m.chat,
        "Verification expired.\n\nPlease send a new join request to get a new code.",
        m,
      )
      .catch(() => {});
    return true;
  }

  const answer = (m.text || "").trim();
  if (!answer) return true;

  const expected = verification.question
    ? String(verification.answer || "").trim()
    : verification.captcha;
  if (answer.toLowerCase() !== expected.toLowerCase()) {
    verification.attempts += 1;
    if (verification.attempts >= config.maxAttempts) {
      delete state[key];
      await persist();
      await sock
        .reply(m.chat, "Verification failed.\n\nYou have run out of attempts.", m)
        .catch(() => {});
    } else {
      await persist();
      await sock
        .reply(
          m.chat,
          `Wrong code.\n\nAttempt: ${verification.attempts}/${config.maxAttempts}\nPlease reply to the verification message with the correct code.`,
          m,
        )
        .catch(() => {});
    }
    return true;
  }

  verification.status = STATUS.VERIFIED;
  await persist();

  let approved = false;
  try {
    if (typeof sock.groupRequestParticipantsUpdate === "function") {
      const result = await sock.groupRequestParticipantsUpdate(
        verification.groupJid,
        [verification.userJid],
        "approve",
      );
      approved = Array.isArray(result) && result.every((r) => r && String(r.status) === "200");
    }
  } catch (e) {
    approved = false;
    global.logError("whatsapp.verification.approve", e);
  }

  delete state[key];
  await persist();

  await sock
    .reply(
      m.chat,
      approved
        ? "Verification successful.\n\nYour join request has been approved."
        : "Verification failed.\n\nPlease send a new join request to get a new code.",
      m,
    )
    .catch(() => {});
  return true;
}

module.exports = {
  getConfig,
  generateCaptcha,
  onJoinRequest,
  handleReply,
  sweepExpired,
  STATUS,
};
