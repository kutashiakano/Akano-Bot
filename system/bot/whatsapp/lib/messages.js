import pkg from "@whiskeysockets/baileys";
import fetch from "node-fetch";
import { getProxyAgent, toAudio, toPTT, sticker, poll as sdkPoll, AIRichBuilder } from "@kutashiakanocanzy/sdk";
import * as SdkSenders from "@kutashiakanocanzy/sdk";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import FileType from "file-type";
import PhoneNumber from "awesome-phonenumber";
import { format } from "util";

const { generateWAMessage, generateWAMessageFromContent, downloadContentFromMessage, prepareWAMessageMedia, proto, areJidsSameUser } = pkg;

const proxyFetch = async (url, opts = {}) => {
  const agent = getProxyAgent(url);
  if (agent) opts.agent = agent;
  return fetch(url, opts);
};

const isUrl = s => typeof s === "string" && /^https?:\/\//i.test(s);

function extMsgs(sock, store, ephemeral) {
  const getWaUpload = () => sock.waUp || sock.waUploadToServer || sock.upload;
  const parseMention = text => {
    if (sock.parseMention) return sock.parseMention(text);
    if (!text || typeof text !== "string") return [];
    return [ ...text.matchAll(/@([0-9]{5,16}|0)/g) ].map(v => v[1] + "@s.whatsapp.net");
  };
  const getThumb = async source => {
    try {
      if (!source) {
        const def = path.join(import.meta.dirname, "../../../..", "media", "image", "default.jpg");
        if (fs.existsSync(def)) return await sock.resize(fs.readFileSync(def), 300, 300);
        return null;
      }
      if (Buffer.isBuffer(source)) return await sock.resize(source, 300, 300);
      if (typeof source === "string" && isUrl(source)) {
        const buf = await (await proxyFetch(source)).buffer().catch(() => null);
        if (buf) return await sock.resize(buf, 300, 300);
        return null;
      }
      if (typeof source === "string" && fs.existsSync(source)) {
        return await sock.resize(fs.readFileSync(source), 300, 300);
      }
      return null;
    } catch {
      return null;
    }
  };
  sock.sendMessageModify = (jid, text, msg, options = {}) => SdkSenders.sendMessageModify(sock, jid, text, msg, options);
  sock.sendMessageModifyV2 = (jid, text, fakeTitle, options = {}, extra = {}) => SdkSenders.sendMessageModifyV2(sock, jid, text, fakeTitle, options, extra);
  sock.sendMessageVerify = (jid, text, fakeName = "© Akano-Bot", options = {}) => SdkSenders.sendMessageVerify(sock, jid, text, fakeName, options);
  sock.sendMessageVerifyV2 = sock.sendMessageVerify;
  sock.sendProgress = (jid, text, quoted, options = {}) => SdkSenders.sendProgress(sock, jid, text, quoted, options);
  sock.sendSticker = async (jid, media, quoted, options = {}) => {
    let buff = Buffer.isBuffer(media) ? media : /^data:.*?\/.*?;base64,/i.test(media) ? Buffer.from(media.split(",")[1], "base64") : isUrl(media) ? await (await proxyFetch(media)).buffer().catch(() => Buffer.alloc(0)) : typeof media === "string" && fs.existsSync(media) ? fs.readFileSync(media) : Buffer.alloc(0);
    if (!buff || buff.length === 0) throw new Error("Invalid media for sticker");
    const packname = options.packname || global.settings?.media?.sticker?.packname || "Akano";
    const author = options.author || global.settings?.media?.sticker?.author || "Bot";
    const categories = options.categories || [ "" ];
    let extra = {};
    if (options.premium) extra.isPremium = true;
    if (options.lock) extra.isLocked = true;
    if (options.meta) extra.isAiSticker = true;
    let stickerBuff;
    try {
      stickerBuff = await sticker(buff, {
        packname: packname,
        author: author,
        categories: categories,
        ...extra,
        ...options
      });
    } catch (e) {
      throw e;
    }
    const sendOpts = {
      ...options
    };
    delete sendOpts.packname;
    delete sendOpts.author;
    delete sendOpts.categories;
    delete sendOpts.premium;
    delete sendOpts.lock;
    delete sendOpts.meta;
    return await sock.sendMessage(jid, {
      sticker: stickerBuff,
      ...sendOpts
    }, {
      quoted: quoted,
      ...ephemeral
    });
  };
  sock.sndAlb = (jid, medias, options = {}) => SdkSenders.sndAlb(sock, jid, medias, options);
  sock.sendAlbumMessage = sock.sndAlb;
  sock.sendAlbum = sock.sndAlb;
  sock.sendFile = async (jid, media, filename = "", caption = "", quoted, options = {}) => {
    if (typeof quoted === "object" && quoted !== null && !quoted.key && !Buffer.isBuffer(quoted) && typeof options === "object" && Object.keys(options).length === 0 && typeof filename === "string" && filename === "") {}
    let isBuffer = Buffer.isBuffer(media);
    let fileInfo;
    try {
      fileInfo = isBuffer ? {
        mime: options.mimetype || "application/octet-stream",
        data: media,
        ext: path.extname(filename).replace(".", "") || "bin"
      } : await sock.getFile(media);
    } catch (e) {
      fileInfo = {
        mime: "application/octet-stream",
        data: Buffer.isBuffer(media) ? media : Buffer.alloc(0),
        ext: "bin"
      };
    }
    let fileData = isBuffer ? media : fileInfo.data;
    let mimetype = fileInfo.mime || options.mimetype || "application/octet-stream";
    let ext = fileInfo.ext || path.extname(filename).replace(".", "") || "";
    let mtype = "document";
    if (options.document) {
      mtype = "document";
    } else if (/image/.test(mimetype)) {
      mtype = "image";
    } else if (/video/.test(mimetype) || /\.gif$/.test(filename) || /\.mp4$/.test(filename)) {
      mtype = "video";
    } else if (/audio/.test(mimetype)) {
      if (options.ptt) {
        try {
          let converted = await toPTT(fileData, ext || "mp3");
          fileData = converted.data;
          filename = converted.filename;
        } catch {}
      } else if (options.audio) {
        try {
          let converted = await toAudio(fileData, ext || "mp3");
          fileData = converted.data;
          filename = converted.filename;
        } catch {}
      }
      if (options.APIC) {}
      mtype = "audio";
      mimetype = options.mimetype || "audio/mpeg";
      if (options.ptt) mimetype = "audio/ogg; codecs=opus";
    }
    if (options.gif) {
      mtype = "video";
      mimetype = "video/mp4";
    }
    let message = {
      ...options,
      caption: caption || options.caption || "",
      filename: filename || fileInfo.filename || `file.${ext || "bin"}`,
      [mtype]: fileData,
      mimetype: mimetype
    };
    delete message.document;
    delete message.ptt;
    delete message.audio;
    delete message.gif;
    delete message.APIC;
    if (options.APIC && Buffer.isBuffer(options.APIC)) {
      message.jpegThumbnail = options.APIC;
    } else if (options.APIC && typeof options.APIC === "string") {
      try {
        let thumb = await getThumb(options.APIC);
        if (thumb) message.jpegThumbnail = thumb;
      } catch {}
    }
    if (mtype === "audio" && options.ptt) {
      message.ptt = true;
    }
    return await sock.sendMessage(jid, message, {
      quoted: quoted,
      ...ephemeral
    });
  };
  sock.sendVideoAsSticker = (jid, pathData, quoted, options = {}) => SdkSenders.sendVideoAsSticker(sock, jid, pathData, quoted, options);
  sock.sendContact = (jid, data, quoted, options = {}) => SdkSenders.sendContact(sock, jid, data, quoted, options);
  sock.reply = (jid, text = "", quoted, options = {}) => {
    if (typeof text !== "string" && !Buffer.isBuffer(text)) {
      text = format(text);
    }
    return Buffer.isBuffer(text) ? sock.sendFile(jid, text, "file", "", quoted, false, options) : sock.sendMessage(jid, {
      ...options,
      text: text,
      mentions: parseMention(text)
    }, {
      quoted: quoted,
      ...options,
      mentions: parseMention(text),
      ...ephemeral
    });
  };
  sock.downloadM = async (m, type, saveToFile) => {
    if (!m || !(m.url || m.directPath)) return Buffer.alloc(0);
    const stream = await downloadContentFromMessage(m, type);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
      buffer = Buffer.concat([ buffer, chunk ]);
    }
    if (saveToFile) {
      var { filename: filename } = await sock.getFile(buffer, true);
    }
    return saveToFile && fs.existsSync(filename) ? filename : buffer;
  };
  sock.downloadAndSaveMediaMessage = (message, filename, attachExtension = true) => SdkSenders.downloadAndSaveMediaMessage(sock, message, filename, attachExtension);
  sock.sendReact = async (jid, emoji, key) => await sock.sendMessage(jid, {
    react: {
      text: emoji,
      key: key
    }
  });
  sock.sendPoll = async (jid, name, options, quoted) => {
    let opts = options || {};
    let pollOptions = [];
    if (Array.isArray(opts)) {
      pollOptions = opts.map(opt => typeof opt === "string" ? opt : opt.name || opt.text || "");
    } else if (opts.options) {
      pollOptions = opts.options.map(opt => {
        if (typeof opt === "string") return opt;
        if (opt && typeof opt === "object") return opt.name || opt.text || opt.optionName || String(opt);
        return String(opt);
      });
    } else if (opts.values) {
      pollOptions = opts.values.map(v => typeof v === "string" ? v : v.name || v.text || "");
    }
    if (pollOptions.length >= 2) {
      try {
        return await sdkPoll(sock, jid, name, pollOptions, quoted);
      } catch {}
    }
    let selectableCount = 0;
    let mapped = pollOptions.map(o => ({ optionName: o }));
    if (mapped.length < 2) throw new Error("Poll requires at least 2 options");
    const pollMessage = {
      name: name,
      options: mapped,
      selectableOptionsCount: selectableCount
    };
    try {
      return await sock.sendMessage(jid, {
        poll: {
          name: name,
          values: pollOptions,
          selectableCount: selectableCount
        }
      }, {
        quoted: quoted
      });
    } catch {}
    return sock.relayMessage(jid, {
      pollCreationMessage: pollMessage
    }, {});
  };
  sock.pollResult = (jid, pollData, quoted, options = {}) => SdkSenders.pollResult(sock, jid, pollData, quoted, options);
  sock.sendPtv = (jid, media, quoted, options = {}) => SdkSenders.sendPtv(sock, jid, media, quoted, options);
  sock.copyNForward = (jid, msg, forceForward = false, options = {}) => SdkSenders.copyNForward(sock, jid, msg, forceForward, options);
  sock.replyButton = async (jid, buttons, msg, options = {}) => sock.sendIAMessage(jid, buttons, msg, options);
  sock.sendIAMessage = async (jid, buttons, msg, options = {}) => {
    const { header: header = "", content: content = options.content ?? options.text ?? "", footer: footer = "", media: media, multiple: multiple, v2: v2, mentions: mentions } = options;
    const nfButtons = (Array.isArray(buttons) ? buttons : []).filter(b => b && typeof b === "object").map(b => {
      if (b.name && (b.buttonParamsJson || b.params)) {
        return {
          name: b.name,
          buttonParamsJson: b.buttonParamsJson || JSON.stringify(b.params)
        };
      }
      return {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: String(b.text || b.display_text || ""),
          id: String(b.command || b.id || b.text || "")
        })
      };
    });
    const readSource = async source => {
      if (Buffer.isBuffer(source)) return source;
      if (typeof source === "string" && isUrl(source)) {
        try {
          const agent = getProxyAgent(source);
          const res = await fetch(source, {
            signal: AbortSignal.timeout(15e3),
            ...agent ? {
              agent: agent
            } : {}
          });
          if (!res.ok) return null;
          return Buffer.from(await res.arrayBuffer());
        } catch {
          return null;
        }
      }
      if (typeof source === "string" && fs.existsSync(source)) return fs.readFileSync(source);
      return null;
    };
    let hdr = {
      title: header,
      hasMediaAttachment: false
    };
    if (media) {
      const isLocation = typeof media === "object" && !Buffer.isBuffer(media) && (media.location || media.name || media.address || media.buffer || media.latitude !== undefined);
      const loc = isLocation ? media.location || media : null;
      if (loc && (loc.buffer || loc.image || loc.latitude !== undefined || loc.name || loc.address)) {
        const rawSource = loc.buffer ?? loc.image;
        let jpegThumbnail = null;
        if (rawSource) {
          const raw = await readSource(rawSource);
          if (raw) {
            const thumb = await sock.resize(raw, 300, 300);
            if (thumb) jpegThumbnail = thumb;
          }
        }
        hdr = {
          title: loc.title || header,
          subtitle: loc.subtitle || "",
          hasMediaAttachment: true,
          locationMessage: {
            degreesLatitude: loc.latitude || 0,
            degreesLongitude: loc.longitude || 0,
            name: loc.name || "",
            address: loc.address || "",
            url: loc.url || "",
            ...jpegThumbnail ? {
              jpegThumbnail: jpegThumbnail
            } : {}
          }
        };
      } else if (Buffer.isBuffer(media) || typeof media === "string") {
        const buf = await readSource(media);
        if (buf) {
          const waUp = getWaUpload();
          let mediaPayload = {
            image: buf
          };
          try {
            const ft = await FileType.fromBuffer(buf).catch(() => null);
            const mime = ft?.mime || "";
            const ext = typeof media === "string" ? path.extname(media).toLowerCase() : "";
            if (mime.startsWith("video/") || [ ".mp4", ".mov", ".avi", ".mkv", ".webm" ].includes(ext)) {
              mediaPayload = {
                video: buf,
                caption: options.caption || undefined,
                gifPlayback: options.gifPlayback || false
              };
            } else if (mime.startsWith("image/")) {
              mediaPayload = {
                image: buf
              };
            } else if (mime && !mime.startsWith("image/") && !mime.startsWith("video/")) {
              mediaPayload = {
                document: buf,
                mimetype: mime,
                fileName: options.fileName || `file.${ft?.ext || "bin"}`
              };
            } else if (ext) {
              if ([ ".pdf", ".zip", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx" ].includes(ext)) {
                mediaPayload = {
                  document: buf,
                  mimetype: mime || "application/octet-stream",
                  fileName: path.basename(media) || `file${ext}`
                };
              } else if ([ ".mp4", ".mov" ].includes(ext)) {
                mediaPayload = {
                  video: buf
                };
              }
            }
          } catch {}
          const prepared = await prepareWAMessageMedia(mediaPayload, {
            upload: waUp
          }).catch(() => null);
          if (prepared && (prepared.imageMessage || prepared.videoMessage || prepared.documentMessage || prepared.productMessage || prepared.locationMessage)) {
            hdr = {
              title: header,
              subtitle: options.subtitle || "",
              hasMediaAttachment: true,
              ...prepared
            };
          } else if (prepared) {
            hdr = {
              title: header,
              subtitle: options.subtitle || "",
              hasMediaAttachment: true,
              ...prepared
            };
          }
        }
      } else if (typeof media === "object" && !Buffer.isBuffer(media)) {
        const waUp = getWaUpload();
        try {
          const prepared = await prepareWAMessageMedia(media, {
            upload: waUp
          }).catch(() => null);
          if (prepared && (prepared.imageMessage || prepared.videoMessage || prepared.documentMessage)) {
            hdr = {
              title: header,
              subtitle: options.subtitle || "",
              hasMediaAttachment: true,
              ...prepared
            };
          }
        } catch {}
      }
    }
    const result = {
      header: hdr,
      body: {
        text: content
      },
      footer: {
        text: footer
      },
      nativeFlowMessage: {
        buttons: nfButtons,
        ...multiple ? {
          messageParamsJson: JSON.stringify({
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: nfButtons.map((_, i) => i),
              list_title: multiple.list_title || "Select Options",
              button_title: multiple.button_title || multiple.name || "Select"
            }
          })
        } : {}
      }
    };
    if (v2) result.nativeFlowMessage.messageVersion = 2;
    if (mentions && Array.isArray(mentions) && mentions.length > 0) {
      result.contextInfo = {
        mentionedJid: mentions,
        groupMentions: [],
        statusAttributions: []
      };
    }
    const isGroupJid = typeof jid === "string" && jid.endsWith("@g.us");
    const additionalNodes = [ {
      tag: "biz",
      attrs: {},
      content: [ {
        tag: "interactive",
        attrs: {
          type: "native_flow",
          v: "1"
        },
        content: [ {
          tag: "native_flow",
          attrs: {
            name: "mixed",
            v: "9"
          }
        } ]
      } ]
    }, ...isGroupJid ? [] : [ {
      tag: "bot",
      attrs: {
        biz_bot: "1"
      }
    } ] ];
    const msgContent = {
      interactiveMessage: result
    };
    return sock.relayMessage(jid, msgContent, {
      messageId: sock.generateMessageId ? sock.generateMessageId() : crypto.randomBytes(16).toString("hex"),
      additionalNodes: additionalNodes,
      ...ephemeral
    });
  };
  sock.groupStatus = (jid, content, options = {}) => SdkSenders.groupStatus(sock, jid, content, options);
  sock.sendMetaMsg = async (jid, items, quoted, options = {}) => {
    if (!Array.isArray(items)) throw new TypeError("items must be array");
    const ai = sock.aiRich();
    if (options.title) ai.setTitle(options.title);
    if (options.subtitle) ai.setSubtitle(options.subtitle);
    if (options.footer) ai.setFooter(options.footer);
    if (options.body) ai.setBody(options.body);
    if (options.mentions) ai.setContextInfo({
      mentionedJid: options.mentions
    }); else if (options.contextInfo) ai.setContextInfo(options.contextInfo);
    for (let item of items) {
      if (!item || typeof item !== "object") continue;
      if (item.text) {
        ai.addText(item.text);
      } else if (item.code) {
        ai.addCode(item.code.language || "javascript", item.code.code || "");
      } else if (item.table) {
        const headers = item.table.headers || item.table.columns || [];
        const rows = item.table.rows || [];
        const table = headers.length ? [ headers, ...rows ] : rows;
        if (table.length) ai.addTable(table);
      } else if (item.muted) {
        ai.addTip(item.muted);
      } else if (item.suggestions || item.suggest || item.suggestion) {
        let list = item.suggestions ?? item.suggest ?? item.suggestion;
        if (list && typeof list === "object" && !Array.isArray(list) && list.list) list = list.list;
        let type = item.suggestions?.type ?? item.type;
        if (Array.isArray(list)) {
          if (type === 2) ai.addSuggest(list, {
            scroll: false,
            layout: "ActionRow"
          }); else if (type === 1) ai.addSuggest(list.join ? list.join("") : String(list), {
            scroll: true
          }); else ai.addSuggest(list);
        } else if (typeof list === "string") {
          ai.addSuggest(list);
        }
      } else if (item.sources || item.source) {
        let src = item.sources || item.source;
        if (!Array.isArray(src)) src = [ src ];
        let mapped = src.map(s => [ s.icon || s.thumbnail || "", s.url || s.link || "", s.title || s.name || "Source" ]);
        ai.addSource(mapped);
      } else if (item.reels) {
        let reels = item.reels;
        if (!Array.isArray(reels)) reels = [ reels ];
        for (let r of reels) {
          if (r.thumbnail) ai.addImage(r.thumbnail);
          let txt = `${r.creator || "Creator"} ${r.verified ? "✓" : ""} • ${r.source || "IG"}\n${r.url || ""}`;
          ai.addText(txt);
        }
      } else if (item.posts) {
        let posts = item.posts;
        if (!Array.isArray(posts)) posts = [ posts ];
        for (let p of posts) {
          if (p.thumbnail || p.media) ai.addImage(p.thumbnail || p.media);
          if (p.caption) ai.addText(p.caption);
          let meta = `${p.username || p.creator || "User"} ${p.verified ? "✓" : ""} • ${p.source || ""}\n${p.url || ""}`;
          ai.addText(meta);
        }
      } else if (item.products) {
        let prods = item.products;
        if (!Array.isArray(prods)) prods = [ prods ];
        for (let prod of prods) {
          if (prod.image) ai.addImage(prod.image);
          let txt = `*${prod.title || "Product"}*\n`;
          if (prod.brand) txt += `${prod.brand}\n`;
          if (prod.sale_price || prod.price) txt += `Price: ${prod.sale_price || prod.price}\n`;
          if (prod.url) txt += `${prod.url}`;
          ai.addText(txt.trim());
        }
      } else if (item.product) {
        let prod = item.product;
        if (prod.image) ai.addImage(prod.image);
        let txt = `*${prod.title || "Product"}*\n${prod.brand || ""}\nPrice: ${prod.sale_price || prod.price || ""}`;
        if (prod.url) txt += `\n${prod.url}`;
        ai.addText(txt);
      } else if (item.image) {
        ai.addImage(item.image);
      } else if (item.tip) {
        ai.addTip(item.tip);
      }
    }
    return await ai.send(jid, {
      quoted: quoted,
      forwarded: true,
      ...options
    });
  };
  sock.sendMetaMsgV1 = sock.sendMetaMsg;
  sock.sendMetaMsgV2 = sock.sendMetaMsg;
  sock.sendMetaMsgV3 = sock.sendMetaMsg;
  sock.aiRich = () => new AIRichBuilder(sock);
  sock.sendCarousel = async (jid, cards, msg, options = {}) => {
    const { content: content = "", footer: footer = "" } = options;
    const carouselMessage = {
      viewOnceMessage: {
        message: {
          messageContextInfo: {
            deviceListMetadataVersion: 2,
            deviceListMetadata: {}
          },
          interactiveMessage: {
            body: {
              text: content
            },
            footer: {
              text: footer
            },
            carouselMessage: {
              cards: cards
            }
          }
        }
      }
    };
    return sock.relayMessage(jid, carouselMessage, {
      messageId: sock.generateMessageId ? sock.generateMessageId() : crypto.randomBytes(16).toString("hex"),
      ...ephemeral
    });
  };
  sock.sendAlbumMessage = sock.sndAlb;
  sock.sendAlbum = sock.sndAlb;
  sock.sendPollV2 = sock.sendPoll;
  sock.sendContactV2 = sock.sendContact;
  if (!sock.mention) sock.mention = parseMention;
}

export { extMsgs };