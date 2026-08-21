const https = require("https");
const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const sessions = new Map();
const SESSION_FILE = path.join(__dirname, "../../../tmp/gemini_sessions.json");

const MODEL = {
  UNSPECIFIED: { model_name: "unspecified", model_header: {} },
  BASIC_FLASH: {
    model_name: "gemini-3-flash",
    model_header: {
      "x-goog-ext-525001261-jspb":
        '[1,null,null,null,"fbb127bbb056c959",null,null,0,[4,6],null,null,1,null,null,1]',
      "x-goog-ext-73010989-jspb": "[0]",
      "x-goog-ext-73010990-jspb": "[0,0,0]",
    },
  },
  BASIC_PRO: {
    model_name: "gemini-3-pro",
    model_header: {
      "x-goog-ext-525001261-jspb":
        '[1,null,null,null,"9d8ca3786ebdfbea",null,null,0,[4,6],null,null,1,null,null,3]',
      "x-goog-ext-73010989-jspb": "[0]",
      "x-goog-ext-73010990-jspb": "[0,0,0]",
    },
  },
  BASIC_LITE: {
    model_name: "gemini-3-lite",
    model_header: {
      "x-goog-ext-525001261-jspb":
        '[1,null,null,null,"cf41b0e0dd7d53e5",null,null,0,[4,6],null,null,1,null,null,6]',
      "x-goog-ext-73010989-jspb": "[0]",
      "x-goog-ext-73010990-jspb": "[0,0,0]",
    },
  },
};

const DEFAULT_METADATA = ["", "", "", null, null, null, null, null, null, ""];

function loadSessions() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      const data = JSON.parse(fs.readFileSync(SESSION_FILE, "utf8"));
      for (const [key, value] of Object.entries(data)) {
        sessions.set(key, value);
      }
    }
  } catch (e) {}
}

function saveSessions() {
  try {
    const dir = path.dirname(SESSION_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const obj = Object.fromEntries(sessions);
    fs.writeFileSync(SESSION_FILE, JSON.stringify(obj, null, 2));
  } catch (e) {}
}

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
  text = text.replace(/http:\/\/googleusercontent\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\n*/g, "");
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function request(url, options, data) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === "https:" ? https : http;

    const req = client.request(
      url,
      {
        method: options.method || "GET",
        headers: options.headers || {},
        maxHeaderSize: 131072,
      },
      (res) => {
        resolve(res);
      },
    );

    req.on("error", reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });

    if (data) req.write(data);
    req.end();
  });
}

function requestFull(url, options, data) {
  return new Promise((resolve, reject) => {
    request(url, options, data)
      .then((res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body), headers: res.headers });
          } catch (e) {
            resolve({ status: res.statusCode, data: body, headers: res.headers });
          }
        });
        res.on("error", reject);
      })
      .catch(reject);
  });
}

async function getAccessToken(cookies) {
  const pageRes = await request("https://gemini.google.com/app", {
    method: "GET",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  let pageData = "";
  await new Promise((resolve, reject) => {
    pageRes.on("data", (chunk) => {
      pageData += chunk;
    });
    pageRes.on("end", resolve);
    pageRes.on("error", reject);
  });

  syncCookies(cookies, pageRes.headers["set-cookie"]);

  const html = pageData.toString();
  const cfb2hMatch = html.match(/"cfb2h":\s*"(.*?)"/);
  const buildLabel = cfb2hMatch ? cfb2hMatch[1] : "boq_assistant-bard-web-server_20260709.09_p0";

  const response = await request(
    "https://gemini.google.com/_/BardChatUi/data/batchexecute?rpcids=maGuAc&source-path=%2F&hl=en-US&_reqid=1&rt=c",
    {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
        cookie: buildCookieString(cookies),
      },
    },
    'f.req=[[["maGuAc","[0]",null,"generic"]]]&',
  );

  let resData = "";
  await new Promise((resolve, reject) => {
    response.on("data", (chunk) => {
      resData += chunk;
    });
    response.on("end", resolve);
    response.on("error", reject);
  });

  syncCookies(cookies, response.headers["set-cookie"]);

  const sessionId = Array.from({ length: 19 }, () => Math.floor(Math.random() * 10)).join("");

  return { buildLabel, sessionId, cookies };
}

async function startSession(retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const cookies = {};
      const { buildLabel, sessionId, cookies: validCookies } = await getAccessToken(cookies);
      return {
        cookies: validCookies,
        buildLabel,
        sessionId,
        reqId: Math.floor(Math.random() * 90000) + 10000,
      };
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

async function chat(prompt, userId = null, onChunk = null, options = {}) {
  const { model = MODEL.UNSPECIFIED, temporary = false, files = [] } = options;

  let sessionData = userId ? sessions.get(userId) : null;
  let auth = sessionData?.auth || null;
  let chatId = sessionData?.chatId || null;

  const hadSavedSession = !!sessionData;

  if (!auth) {
    auth = await startSession();
  }

  const result = await streamOnce(prompt, auth, chatId, onChunk, model, temporary, userId);
  if (result && result.text) return result;

  if (hadSavedSession) {
    sessions.delete(userId);
    saveSessions();
    const freshAuth = await startSession();
    const retry = await streamOnce(prompt, freshAuth, null, onChunk, model, temporary, userId);
    if (retry && retry.text) return retry;
    return result;
  }

  return result;
}

async function streamOnce(prompt, auth, chatId, onChunk, model, temporary, userId) {
  if (!auth) auth = await startSession();
  auth.reqId = (auth.reqId || 10000) + 100000;

  let metadata = [...DEFAULT_METADATA];
  if (chatId) {
    try {
      metadata = typeof chatId === "string" ? JSON.parse(chatId) : chatId;
    } catch (e) {}
  }

  const flags = new Array(50).fill(null);
  flags[7] = onChunk ? 1 : null;
  if (temporary) flags[45] = 1;

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
    [1],
  ];

  const traceId = crypto.randomUUID().toUpperCase();
  const queryParams = new URLSearchParams({
    hl: "en-US",
    _reqid: String(auth.reqId),
    rt: "c",
  });
  if (auth.buildLabel) queryParams.set("bl", auth.buildLabel);
  if (auth.sessionId) queryParams.set("f.sid", auth.sessionId);

  const requestBody = new URLSearchParams({
    "f.req": JSON.stringify([null, JSON.stringify(requestPayload)]),
  });

  const headers = {
    "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
    "x-same-domain": "1",
    origin: "https://gemini.google.com",
    referer: "https://gemini.google.com/",
    cookie: buildCookieString(auth.cookies),
    ...MODEL[model.model_name === "unspecified" ? "BASIC_FLASH" : model.model_name]?.model_header,
  };

  const streamResponse = await request(
    `https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?${queryParams}`,
    { method: "POST", headers },
    requestBody.toString(),
  );

  syncCookies(auth.cookies, streamResponse.headers["set-cookie"]);

  return new Promise((resolve, reject) => {
    let accText = "";
    let lastSentText = "";
    let buffer = "";
    let updatedMetadata = metadata;
    let timeoutId;
    let images = [];

    timeoutId = setTimeout(() => {
      streamResponse.destroy();
      reject(new Error("Response timeout"));
    }, 60000);

    streamResponse.on("data", (chunk) => {
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
                accText = cleaned;
                const delta = cleaned.substring(lastSentText.length);
                if (delta && onChunk) {
                  onChunk(delta);
                  lastSentText = cleaned;
                }
              }

              const imgs = cand?.[3] || [];
              for (const img of imgs) {
                if (img && img[0]) {
                  images.push(img[0]);
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

    streamResponse.on("end", () => {
      clearTimeout(timeoutId);
      try {
        const finalDelta = accText.substring(lastSentText.length);
        if (finalDelta && onChunk) onChunk(finalDelta);

        if (userId && !temporary) {
          sessions.set(userId, {
            auth,
            chatId: updatedMetadata,
          });
          saveSessions();
        }

        resolve({
          text: accText,
          images,
          metadata: updatedMetadata,
          cid: updatedMetadata[0] || null,
          rid: updatedMetadata[1] || null,
        });
      } catch (err) {
        reject(err);
      }
    });

    streamResponse.on("error", (err) => {
      clearTimeout(timeoutId);
      reject(err);
    });
  });
}

async function generateImage(prompt, userId = null) {
  const imagePrompt = `Generate an image: ${prompt}`;
  return await chat(imagePrompt, userId, null, { temporary: false });
}

async function chatWithImage(prompt, imagePath, userId = null) {
  return await chat(prompt, userId, null, { files: [imagePath] });
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

function listModels() {
  return Object.entries(MODEL).map(([key, value]) => ({
    name: key,
    model_name: value.model_name,
  }));
}

module.exports = {
  chat,
  generateImage,
  chatWithImage,
  clearSession,
  hasSession,
  getSessionCount,
  listModels,
  MODEL,
};
