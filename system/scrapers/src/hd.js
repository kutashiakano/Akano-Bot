const BASE = "https://salman555-upscale-images.hf.space";
const UA = "Mozilla/5.0 (Linux; Android 14)";

const MODES = {
  2: { fn: 0, label: "x2" },
  4: { fn: 1, label: "x4" },
  8: { fn: 2, label: "x8" }
};

function sessionHash() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

async function upscale(input, opts = {}) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const mode = MODES[opts.mode] ? opts.mode : 2;
  const filename = opts.filename || "input.jpg";
  const timeoutMs = opts.timeoutMs || 300000;
  const form = new FormData();
  form.append("files", new Blob([buf], { type: "image/jpeg" }), filename);
  const upRes = await fetch(BASE + "/gradio_api/upload", {
    method: "POST",
    headers: { "User-Agent": UA },
    body: form,
    signal: AbortSignal.timeout(60000)
  });
  if (!upRes.ok) throw new Error(`hd upload ${upRes.status}`);
  const up = await upRes.json();
  const uploadedPath = up[0];
  const hash = sessionHash();
  const joinRes = await fetch(BASE + "/gradio_api/queue/join", {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": UA },
    body: JSON.stringify({
      data: [{
        path: uploadedPath,
        url: BASE + "/gradio_api/file=" + uploadedPath,
        orig_name: filename,
        mime_type: "image/jpeg"
      }],
      event_data: null,
      fn_index: MODES[mode].fn,
      trigger_id: null,
      session_hash: hash
    }),
    signal: AbortSignal.timeout(60000)
  });
  if (!joinRes.ok) throw new Error(`hd join ${joinRes.status}`);
  const { event_id } = await joinRes.json();

  const sseRes = await fetch(BASE + "/gradio_api/queue/data?session_hash=" + hash, {
    headers: { Accept: "text/event-stream", "User-Agent": UA },
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!sseRes.ok) throw new Error(`hd queue ${sseRes.status}`);
  const raw = await sseRes.text();
  let done = null;
  for (const line of raw.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    try {
      const j = JSON.parse(line.slice(6));
      if (j.event_id === event_id && j.msg === "process_completed") done = j;
    } catch {}
  }
  if (!done) throw new Error("hd timeout: no result from server");
  if (!done.success) throw new Error("hd server failed to process image");
  const fileData = done.output?.data?.[0];
  if (!fileData || !fileData.url) throw new Error("hd unexpected output shape");
  const dlRes = await fetch(fileData.url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(120000)
  });
  if (!dlRes.ok) throw new Error(`hd download ${dlRes.status}`);
  return Buffer.from(await dlRes.arrayBuffer());
}

module.exports = { upscale, MODES };
