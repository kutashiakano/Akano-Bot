const axios = require("axios");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const sessions = new Map();
const SESSION_FILE = path.join(__dirname, "../../../tmp/gemini_sessions.json");

// Load sessions from file
function loadSessions() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      const data = JSON.parse(fs.readFileSync(SESSION_FILE, "utf8"));
      for (const [key, value] of Object.entries(data)) {
        sessions.set(key, value);
      }
    }
  } catch (e) {
    // Ignore errors, start fresh
  }
}

// Save sessions to file
function saveSessions() {
  try {
    const dir = path.dirname(SESSION_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const obj = Object.fromEntries(sessions);
    fs.writeFileSync(SESSION_FILE, JSON.stringify(obj, null, 2));
  } catch (e) {
    // Ignore write errors
  }
}

// Auto-load on startup
loadSessions();

function syncCookies(jar, setCookie) {
  if (!setCookie) return;
  const list = Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const item of list) {
    const pair = item.split(";")[0].split("=");
    if (pair.length >= 2) {
      jar[pair[0].trim()] = pair.slice(1).join("=").trim();
    }
  }
}

const buildCookieString = (jar) =>
  Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");

function cleanText(text) {
  if (!text) return "";
  text = text.replace(
    /http:\/\/googleusercontent\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\n*/g,
    ""
  );
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) =>
      String.fromCodePoint(parseInt(h, 16))
    )
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

async function startSession(retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const cookies = {};

      const pageRes = await axios.get("https://gemini.google.com/app", {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        timeout: 15000
      });
      syncCookies(cookies, pageRes.headers["set-cookie"]);

      const html = pageRes.data.toString();
      const cfb2hMatch = html.match(/"cfb2h":\s*"(.*?)"/);
      const buildLabel = cfb2hMatch
        ? cfb2hMatch[1]
        : "boq_assistant-bard-web-server_20260709.09_p0";

      const response = await axios.post(
        "https://gemini.google.com/_/BardChatUi/data/batchexecute?rpcids=maGuAc&source-path=%2F&hl=en-US&_reqid=1&rt=c",
        'f.req=[[["maGuAc","[0]",null,"generic"]]]&',
        {
          headers: {
            "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
            cookie: buildCookieString(cookies)
          },
          timeout: 15000
        }
      );
      syncCookies(cookies, response.headers["set-cookie"]);

      const sessionId = Array.from({ length: 19 }, () =>
        Math.floor(Math.random() * 10)
      ).join("");

      return {
        cookies,
        buildLabel,
        sessionId,
        reqId: Math.floor(Math.random() * 90000) + 10000
      };
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

async function chat(prompt, userId = null, onChunk = null) {
  let sessionData = userId ? sessions.get(userId) : null;
  let auth = sessionData?.auth || null;
  let chatId = sessionData?.chatId || null;

  if (!auth) {
    auth = await startSession();
  }

  auth.reqId = (auth.reqId || 10000) + 100000;

  let metadata = ["", "", "", null, null, null, null, null, null, ""];
  if (chatId) {
    try {
      metadata = typeof chatId === "string" ? JSON.parse(chatId) : chatId;
    } catch (e) {}
  }

  const requestPayload = [
    [prompt, 0, null, null, null, null, 0],
    ["en-US"],
    metadata,
    null,
    null,
    null,
    [1],
    1,
    null,
    null,
    1,
    0,
    null,
    null,
    null,
    null,
    null,
    [[0]],
    1,
    null,
    null,
    null,
    null,
    null,
    ["", "", "", null, null, null, null, null, 0, null, 1, null, null, null, []],
    null,
    null,
    1,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
    1,
    null,
    null,
    null,
    null,
    [1]
  ];

  const traceId = crypto.randomUUID().toUpperCase();
  const queryParams = new URLSearchParams({
    hl: "en-US",
    _reqid: String(auth.reqId),
    rt: "c"
  });
  if (auth.buildLabel) queryParams.set("bl", auth.buildLabel);
  if (auth.sessionId) queryParams.set("f.sid", auth.sessionId);

  const requestBody = new URLSearchParams({
    "f.req": JSON.stringify([null, JSON.stringify(requestPayload)])
  });

  const streamResponse = await axios.post(
    `https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?${queryParams}`,
    requestBody.toString(),
    {
      headers: {
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
        "x-goog-ext-525001261-jspb":
          '[1,null,null,null,"fbb127bbb056c959",null,null,0,[4,6],null,null,1,null,null,1]',
        "x-goog-ext-525005358-jspb": `["${traceId}",1]`,
        "x-goog-ext-73010989-jspb": "[0]",
        "x-goog-ext-73010990-jspb": "[0,0,0]",
        "x-same-domain": "1",
        origin: "https://gemini.google.com",
        referer: "https://gemini.google.com/",
        cookie: buildCookieString(auth.cookies)
      },
      responseType: "stream",
      maxHeaderSize: 65536,
      insecureHTTPParser: true,
      timeout: 60000
    }
  );

  syncCookies(auth.cookies, streamResponse.headers["set-cookie"]);

  return new Promise((resolve, reject) => {
    let accumulatedText = "";
    let lastSentText = "";
    let buffer = "";
    let updatedMetadata = metadata;
    let timeoutId;

    // Timeout handler
    timeoutId = setTimeout(() => {
      streamResponse.data.destroy();
      reject(new Error("Response timeout"));
    }, 60000);

    streamResponse.data.on("data", (chunk) => {
      try {
        buffer += chunk.toString("utf8");

        if (buffer.startsWith(")]}'")) {
          buffer = buffer.substring(4).trimStart();
        }

        while (true) {
          const nl = buffer.indexOf("\n");
          if (nl === -1) break;

          const sizeStr = buffer.substring(0, nl).trim();
          const size = parseInt(sizeStr, 10);

          if (isNaN(size)) {
            buffer = buffer.substring(nl + 1);
            continue;
          }

          if (buffer.length < nl + size) break;

          const framePayload = buffer.substring(nl, nl + size);
          buffer = buffer.substring(nl + size);

          let frameData;
          try {
            frameData = JSON.parse(framePayload);
          } catch (e) {
            continue;
          }

          const envelope = Array.isArray(frameData) ? frameData : [frameData];
          for (const item of envelope) {
            const innerStr = item?.[2];
            if (!innerStr) continue;

            let pj;
            try {
              pj = JSON.parse(innerStr);
            } catch (e) {
              continue;
            }

            const mData = pj?.[1];
            if (mData) updatedMetadata = mData;

            const contextToken = pj?.[25];
            if (typeof contextToken === "string") {
              updatedMetadata[9] = contextToken;
            }

            const candidates = pj?.[4] || [];
            for (const cand of candidates) {
              const rawContent = cand?.[1]?.[0] || "";
              const cleaned = cleanText(rawContent);
              if (cleaned) {
                accumulatedText = cleaned;
                const delta = cleaned.substring(lastSentText.length);
                if (delta && onChunk) {
                  onChunk(delta);
                  lastSentText = cleaned;
                }
              }
            }
          }
        }
      } catch (err) {
        clearTimeout(timeoutId);
        reject(err);
      }
    });

    streamResponse.data.on("end", () => {
      clearTimeout(timeoutId);
      try {
        const finalDelta = accumulatedText.substring(lastSentText.length);
        if (finalDelta && onChunk) onChunk(finalDelta);

        if (userId) {
          sessions.set(userId, {
            auth,
            chatId: updatedMetadata
          });
          saveSessions();
        }

        resolve(accumulatedText);
      } catch (err) {
        reject(err);
      }
    });

    streamResponse.data.on("error", (err) => {
      clearTimeout(timeoutId);
      reject(err);
    });
  });
}

function clearSession(userId) {
  sessions.delete(userId);
  saveSessions();
}

function hasSession(userId) {
  return sessions.has(userId);
}

function getSessionCount() {
  return sessions.size;
}

module.exports = { chat, clearSession, hasSession, getSessionCount };
