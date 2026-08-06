const axios = require("axios");

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/event-stream",
  Referer: "https://www.perplexity.ai/",
  "Content-Type": "application/json",
};

function parseSSE(buffer) {
  const lines = buffer.split("\n");
  const remaining = lines.pop() || "";
  const events = [];
  for (const line of lines) {
    if (!line.startsWith("data: ")) continue;
    try {
      events.push(JSON.parse(line.slice(6)));
    } catch {}
  }
  return { events, remaining };
}

async function getCookies() {
  const res = await axios.get("https://www.perplexity.ai/api/auth/session", {
    headers: { "User-Agent": HEADERS["User-Agent"] },
    withCredentials: true,
  });
  const cookies = res.headers["set-cookie"];
  return cookies ? cookies.map((c) => c.split(";")[0]).join("; ") : "";
}

async function query(prompt, options = {}) {
  const cookieStr = await getCookies();

  const response = await axios({
    method: "POST",
    url: "https://www.perplexity.ai/rest/sse/perplexity_ask",
    headers: { ...HEADERS, Cookie: cookieStr },
    data: {
      query_str: prompt.trim(),
      version: "2.18",
      source: options.source || "default",
      search_focus: options.searchFocus || "internet",
      attachments: [],
    },
    responseType: "stream",
    timeout: 60000,
    maxHeaderSize: 131072,
  });

  let answer = "";
  let sources = [];
  let queryStr = prompt;
  let backendUuid = "";
  let buffer = "";

  await new Promise((resolve, reject) => {
    response.data.on("data", (chunk) => {
      buffer += chunk.toString();
      const { events, remaining } = parseSSE(buffer);
      buffer = remaining;

      for (const data of events) {
        if (data.backend_uuid && !backendUuid) backendUuid = data.backend_uuid;
        if (data.query_str) queryStr = data.query_str;

        if (data.blocks) {
          for (const block of data.blocks) {
            if (block.markdown_block) {
              if (block.markdown_block.answer) {
                answer = block.markdown_block.answer;
              } else if (block.markdown_block.chunks) {
                answer = block.markdown_block.chunks.join("");
              }
            }
          }
        }
      }
    });

    response.data.on("end", resolve);
    response.data.on("error", reject);
  });

  if (backendUuid) {
    try {
      const threadRes = await axios({
        method: "GET",
        url: `https://www.perplexity.ai/rest/thread/${backendUuid}`,
        headers: {
          "User-Agent": HEADERS["User-Agent"],
          Referer: "https://www.perplexity.ai/",
          Cookie: cookieStr,
        },
        timeout: 15000,
      });

      const entry = threadRes.data.entries?.[0];
      if (entry?.text) {
        const textData = JSON.parse(entry.text);
        const finalStep = textData.find((s) => s.step_type === "FINAL");
        if (finalStep?.content?.answer) {
          const answerData = JSON.parse(finalStep.content.answer);
          if (answerData.web_results?.length) {
            sources = answerData.web_results.map((r) => ({
              url: r.url,
              name: r.name || "",
              snippet: r.snippet || "",
            }));
          }
        }
      }
    } catch {}
  }

  return { text: answer.trim(), sources, query: queryStr, backendUuid };
}

async function search(prompt, options = {}) {
  return query(prompt, options);
}

async function chat(prompt, userId = null, onChunk = null, options = {}) {
  const result = await query(prompt, options);

  if (onChunk && result.text) {
    const chunks = result.text.match(/.{1,50}/g) || [];
    for (const chunk of chunks) {
      onChunk(chunk);
      await new Promise((r) => setTimeout(r, 30));
    }
  }

  return {
    text: result.text,
    sources: result.sources,
    query: result.query,
  };
}

function listModels() {
  return [
    { id: "turbo", name: "Sonar (Default)" },
    { id: "pro", name: "Sonar Pro" },
    { id: "offline", name: "Sonar Offline" },
  ];
}

module.exports = { search, chat, listModels };
