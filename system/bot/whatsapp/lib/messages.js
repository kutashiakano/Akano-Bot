const {generateWAMessage: generateWAMessage, generateWAMessageFromContent: generateWAMessageFromContent, downloadContentFromMessage: downloadContentFromMessage, prepareWAMessageMedia: prepareWAMessageMedia, proto: proto, areJidsSameUser: areJidsSameUser} = require("baileys");
const fetch = require("node-fetch");
const {getProxyAgent: getProxyAgent} = require("./proxy");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const FileType = require("file-type");
const PhoneNumber = require("awesome-phonenumber");
const {toAudio: toAudio, toPTT: toPTT, sticker: sticker} = require("./converter");
const {writeExifVid: writeExifVid, writeExifImg: writeExifImg, imageToWebp: imageToWebp, videoToWebp: videoToWebp} = require("./exif");
const {AIRich: AIRich} = require("./ai-rich");

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
        const def = path.join(__dirname, "../../../..", "media", "image", "default.jpg");
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
  sock.sendMessageModify = async (jid, text, msg, options = {}) => {
    const {largeThumb: largeThumb = false, thumbnail: thumbnail = "", url: url = "", body: body = "", title: title = "", ads: ads = false, isForwarded: isForwarded = false, type: type, ratio: ratio = "landscape", icon: icon} = options;
    if (type === "preview-link") {
      let thumbUrl = url || thumbnail || "";
      let iconUrl = icon || "";
      let thumbToUse = thumbUrl;
      if (thumbnail && Buffer.isBuffer(thumbnail)) {
        try {
          const up = await getThumb(thumbnail);
          if (up) thumbToUse = `https://telegra.ph/file/${crypto.randomBytes(8).toString("hex")}.jpg`;
        } catch {}
      } else if (thumbnail && typeof thumbnail === "string" && !isUrl(thumbnail) && fs.existsSync(thumbnail)) {
        thumbToUse = url || "https://telegra.ph/file/d5a48b03b80791b50717f.jpg";
      }
      let messageOptions = {
        text: text,
        contextInfo: {
          mentionedJid: parseMention(text),
          isForwarded: isForwarded,
          externalAdReply: {
            showAdAttribution: !!ads,
            title: title || global.header || "© Akano-Bot",
            body: body || null,
            sourceUrl: url || "",
            mediaType: 1,
            renderLargerThumbnail: !!largeThumb,
            thumbnailUrl: isUrl(thumbToUse) ? thumbToUse : undefined,
            thumbnail: !isUrl(thumbToUse) && thumbnail ? thumbnail : undefined,
            mediaUrl: "https://telegra.ph/?id=" + crypto.randomBytes(4).toString("hex")
          }
        },
        ...url ? {
          matchedText: url
        } : {}
      };
      return await sock.sendMessage(jid, messageOptions, {
        quoted: msg
      });
    }
    let messageOptions = {
      text: text,
      contextInfo: {
        mentionedJid: parseMention(text),
        isForwarded: isForwarded
      }
    };
    let thumbUrl = url || thumbnail || "";
    if (thumbnail && !isUrl(thumbnail) && !Buffer.isBuffer(thumbnail) && fs.existsSync(String(thumbnail))) {
      try {
        const {file: file} = await sock.getFile(thumbnail);
        thumbUrl = url || thumbUrl;
      } catch {}
    } else if (thumbnail && Buffer.isBuffer(thumbnail)) {
      thumbUrl = url || thumbUrl;
    } else if (thumbnail && isUrl(thumbnail)) {
      thumbUrl = thumbnail;
    }
    messageOptions.contextInfo.externalAdReply = {
      showAdAttribution: !!ads,
      title: title || global.header || "© Akano-Bot",
      body: body || null,
      sourceUrl: url || "",
      mediaType: 1,
      renderLargerThumbnail: !!largeThumb,
      thumbnailUrl: isUrl(thumbUrl) ? thumbUrl : url ? url : undefined,
      thumbnail: !isUrl(thumbUrl) && thumbnail && !url ? thumbnail : undefined,
      mediaUrl: "https://telegra.ph/?id=" + crypto.randomBytes(4).toString("hex")
    };
    return await sock.sendMessage(jid, messageOptions, {
      quoted: msg
    });
  };
  sock.sendMessageModifyV2 = async (jid, text, fakeTitle, options = {}, extra = {}) => {
    let quotedFake = null;
    let titleForThumb = typeof fakeTitle === "string" ? fakeTitle : options.title || "© Akano-Bot";
    if (typeof fakeTitle === "string") {
      const thumb = await getThumb(path.join(__dirname, "../../../../media/image/thumb.jpg").replace(/\/+/g, "/"));
      let jpegThumb = null;
      try {
        const defPath = path.join(process.cwd(), "media/image/thumb.jpg");
        const tPath = fs.existsSync(defPath) ? defPath : path.join(__dirname, "../../../..", "media/image/default.jpg");
        if (fs.existsSync(tPath)) jpegThumb = await sock.resize(fs.readFileSync(tPath), 300, 300);
      } catch {}
      quotedFake = {
        key: {
          fromMe: false,
          participant: "0@s.whatsapp.net",
          ...jid ? {
            remoteJid: "status@broadcast"
          } : {}
        },
        message: {
          locationMessage: {
            name: fakeTitle || "© Akano-Bot",
            jpegThumbnail: jpegThumb || undefined
          }
        }
      };
    } else if (fakeTitle && typeof fakeTitle === "object" && fakeTitle.key) {
      quotedFake = fakeTitle;
      titleForThumb = options.title || "© Akano-Bot";
    } else {
      quotedFake = fakeTitle;
    }
    const {largeThumb: largeThumb = false, thumbnail: thumbnail = "", url: url = "", body: body = "", title: title = titleForThumb, ads: ads = false, isForwarded: isForwarded = false} = options;
    let messageOptions = {
      text: text,
      contextInfo: {
        mentionedJid: parseMention(text),
        isForwarded: isForwarded,
        externalAdReply: {
          showAdAttribution: !!ads,
          title: title || global.header || "© Akano-Bot",
          body: body || null,
          sourceUrl: url || "",
          mediaType: 1,
          renderLargerThumbnail: !!largeThumb,
          thumbnailUrl: isUrl(thumbnail) ? thumbnail : url || undefined,
          thumbnail: !isUrl(thumbnail) && thumbnail ? thumbnail : undefined,
          mediaUrl: "https://telegra.ph/?id=" + crypto.randomBytes(4).toString("hex")
        }
      },
      ...extra
    };
    return await sock.sendMessage(jid, messageOptions, {
      quoted: quotedFake
    });
  };
  sock.sendMessageVerify = async (jid, text, fakeName = "© Akano-Bot", options = {}) => {
    let jpegThumb = null;
    try {
      const defPath = path.join(process.cwd(), "media/image/thumb.jpg");
      const altPath = path.join(__dirname, "../../../../media/image/thumb.jpg");
      const tPath = fs.existsSync(defPath) ? defPath : fs.existsSync(altPath) ? altPath : path.join(__dirname, "../../../../media/image/default.jpg");
      if (fs.existsSync(tPath)) jpegThumb = await sock.resize(fs.readFileSync(tPath), 300, 300);
    } catch {}
    const fake = {
      key: {
        fromMe: false,
        participant: "0@s.whatsapp.net",
        ...jid ? {
          remoteJid: "status@broadcast"
        } : {}
      },
      message: {
        locationMessage: {
          name: fakeName || "© Akano-Bot",
          jpegThumbnail: jpegThumb || undefined
        }
      },
      expiration: 0
    };
    return await sock.sendMessage(jid, {
      text: text,
      mentions: parseMention(text),
      ...options
    }, {
      quoted: fake,
      ...ephemeral
    });
  };
  sock.sendMessageVerifyV2 = sock.sendMessageVerify;
  sock.sendProgress = async (jid, text, quoted, options = {}) => {
    const steps = [ "⬢⬡⬡⬡⬡⬡⬡⬡⬡⬡ 10%", "⬢⬢⬢⬡⬡⬡⬡⬡⬡⬡ 30%", "⬢⬢⬢⬢⬢⬡⬡⬡⬡⬡ 50%", "⬢⬢⬢⬢⬢⬢⬢⬢⬢⬢ 100%", text ];
    let msg;
    try {
      msg = await sock.sendMessage(jid, {
        text: "⬡⬡⬡⬡⬡⬡⬡⬡⬡⬡ 0%"
      }, {
        quoted: quoted
      });
      if (!msg || !msg.key) return msg;
      for (let c of steps) {
        await sock.delay(800);
        try {
          await sock.sendMessage(jid, {
            text: c,
            edit: msg.key
          });
        } catch {
          try {
            await sock.relayMessage(jid, {
              protocolMessage: {
                key: msg.key,
                type: 14,
                editedMessage: {
                  conversation: c
                }
              }
            }, {});
          } catch {}
        }
      }
      return msg;
    } catch (e) {
      return await sock.sendMessage(jid, {
        text: text
      }, {
        quoted: quoted
      });
    }
  };
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
      try {
        const type = await FileType.fromBuffer(buff).catch(() => ({
          mime: "image/jpeg"
        }));
        if (/video/.test(type?.mime)) {
          if (packname || author) {
            const tmp = await writeExifVid(buff, {
              packname: packname,
              author: author,
              categories: categories
            });
            stickerBuff = fs.readFileSync(tmp);
            try {
              fs.unlinkSync(tmp);
            } catch {}
          } else {
            stickerBuff = await videoToWebp(buff);
          }
        } else {
          if (packname || author) {
            const tmp = await writeExifImg(buff, {
              packname: packname,
              author: author,
              categories: categories
            });
            stickerBuff = fs.readFileSync(tmp);
            try {
              fs.unlinkSync(tmp);
            } catch {}
          } else {
            stickerBuff = await imageToWebp(buff);
          }
        }
      } catch (err) {
        throw err;
      }
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
  sock.sndAlb = async (jid, medias, options = {}) => {
    if (typeof jid !== "string") {
      throw new TypeError(`jid must be string, received: ${jid}`);
    }
    let normalized = medias.map(m => {
      if (m.url && !m.data) {
        return {
          type: m.type || (/\.(mp4|mov|avi)$/i.test(m.url) ? "video" : "image"),
          data: {
            url: m.url
          },
          caption: m.caption || ""
        };
      }
      if (m.data && m.data.url) {
        return {
          type: m.type,
          data: m.data,
          caption: m.caption || ""
        };
      }
      if (Buffer.isBuffer(m.data) || Buffer.isBuffer(m.url)) {
        return {
          type: m.type || "image",
          data: Buffer.isBuffer(m.data) ? m.data : m.url,
          caption: m.caption || ""
        };
      }
      return m;
    });
    for (const media of normalized) {
      if (!media.type || media.type !== "image" && media.type !== "video") {
        throw new TypeError(`medias[i].type must be 'image' or 'video'`);
      }
      if (!media.data || !media.data.url && !Buffer.isBuffer(media.data) && typeof media.data !== "string") {
        throw new TypeError(`medias[i].data must be object with url or buffer`);
      }
    }
    if (normalized.length < 2) throw new RangeError("Minimum 2 media");
    const caption = options.text || options.caption || "";
    const delay = !isNaN(options.delay) ? options.delay : 500;
    const quoted = options.quoted || options.quotedMessage || null;
    delete options.text;
    delete options.caption;
    delete options.delay;
    delete options.quoted;
    delete options.quotedMessage;
    const waUp = getWaUpload();
    const album = generateWAMessageFromContent(jid, {
      messageContextInfo: {
        messageSecret: new Uint8Array(crypto.randomBytes(32))
      },
      albumMessage: {
        expectedImageCount: normalized.filter(media => media.type === "image").length,
        expectedVideoCount: normalized.filter(media => media.type === "video").length,
        ...quoted && quoted.message ? {
          contextInfo: {
            remoteJid: quoted.key.remoteJid,
            fromMe: quoted.key.fromMe,
            stanzaId: quoted.key.id,
            participant: quoted.key.participant || quoted.key.remoteJid,
            quotedMessage: quoted.message || ""
          }
        } : {}
      }
    }, {});
    await sock.relayMessage(album.key.remoteJid, album.message, {
      messageId: album.key.id
    });
    for (const i in normalized) {
      const {type: type, data: data, caption: cap} = normalized[i];
      const useCaption = i === "0" ? caption || cap || "" : cap || "";
      const img = await generateWAMessage(album.key.remoteJid, {
        [type]: typeof data === "object" && data.url ? data : data,
        ...useCaption ? {
          caption: useCaption
        } : {}
      }, {
        upload: waUp
      }).catch(() => null);
      if (!img || !img.message) {
        continue;
      }
      img.message.messageContextInfo = {
        messageSecret: new Uint8Array(crypto.randomBytes(32)),
        messageAssociation: {
          associationType: 1,
          parentMessageKey: album.key
        }
      };
      await sock.relayMessage(img.key.remoteJid, img.message, {
        messageId: img.key.id
      });
      await sock.delay(delay);
    }
    return album;
  };
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
  sock.sendVideoAsSticker = async (jid, pathData, quoted, options = {}) => {
    let buff = Buffer.isBuffer(pathData) ? pathData : /^data:.*?\/.*?;base64,/i.test(pathData) ? Buffer.from(pathData.split(",")[1], "base64") : isUrl(pathData) ? await (await proxyFetch(pathData)).buffer().catch(() => Buffer.alloc(0)) : typeof pathData === "string" && fs.existsSync(pathData) ? fs.readFileSync(pathData) : Buffer.alloc(0);
    if (!buff || buff.length === 0) throw new Error("Invalid media for sendVideoAsSticker");
    const packname = options.packname || global.settings?.media?.sticker?.packname || "Akano";
    const author = options.author || global.settings?.media?.sticker?.author || "Bot";
    const categories = options.categories || [ "" ];
    let buffer;
    try {
      const meta = {
        packname: packname,
        author: author,
        categories: categories
      };
      const tmpPath = await writeExifVid(buff, meta).catch(async () => await videoToWebp(buff));
      if (typeof tmpPath === "string" && fs.existsSync(tmpPath)) {
        buffer = fs.readFileSync(tmpPath);
        try {
          fs.unlinkSync(tmpPath);
        } catch {}
      } else if (Buffer.isBuffer(tmpPath)) {
        buffer = tmpPath;
      } else {
        buffer = await videoToWebp(buff);
      }
      if (buffer && packname && author) {
        try {
          const {Image: Image} = require("node-webpmux");
          const img = new Image;
          const {makeExif: makeExif} = require("./exif");
          await img.load(buffer);
          img.exif = makeExif(packname, author, categories);
          buffer = await img.save(null);
        } catch {}
      }
    } catch {
      buffer = await videoToWebp(buff);
    }
    const sendOpts = {
      ...options
    };
    delete sendOpts.packname;
    delete sendOpts.author;
    delete sendOpts.categories;
    await sock.sendMessage(jid, {
      sticker: buffer,
      ...sendOpts
    }, {
      quoted: quoted,
      ...ephemeral
    });
    return buffer;
  };
  sock.sendContact = async (jid, data, quoted, options = {}) => {
    let contactsInput = [];
    if (Array.isArray(data) && data.length > 0 && typeof data[0] === "object" && !Array.isArray(data[0])) {
      contactsInput = data.map(c => [ c.number || c.phone || c.id, c.name || c.displayName, c.about || c.status || "" ]);
    } else if (Array.isArray(data[0]) && typeof data[0] === "string") {
      contactsInput = data;
    } else if (Array.isArray(data) && typeof data[0] === "string" && typeof data[1] === "string") {
      contactsInput = [ data ];
    } else {
      contactsInput = data;
    }
    let contacts = [];
    const org = options.org || "Akano Network";
    const website = options.website || "https://akano.my.id";
    const email = options.email || "contact@akano.my.id";
    for (let entry of contactsInput) {
      let number, name, about;
      if (Array.isArray(entry)) {
        [number, name, about] = entry;
      } else if (typeof entry === "object") {
        number = entry.number || entry.phone;
        name = entry.name;
        about = entry.about;
      }
      if (!number || !name) continue;
      number = String(number).replace(/[^0-9]/g, "");
      let njid = number + "@s.whatsapp.net";
      let biz = {};
      try {
        biz = await sock.getBusinessProfile(njid).catch(() => null) || {};
      } catch {}
      let displayPhone;
      try {
        displayPhone = PhoneNumber("+" + number).getNumber("international") || "+" + number;
      } catch {
        displayPhone = "+" + number;
      }
      let vcard = `\nBEGIN:VCARD\nVERSION:3.0\nFN:${String(name).replace(/\n/g, "\\n")}\nORG:${String(org).replace(/\n/g, "\\n")}\nTEL;type=CELL;type=VOICE;waid=${number}:${displayPhone}\nEMAIL;type=Email:${String(email).replace(/\n/g, "\\n")}\nURL;type=Website:${String(website).replace(/\n/g, "\\n")}\nADR;type=Location:;;Unknown;;\nNOTE:${String(about || biz.description || "").replace(/\n/g, "\\n")}\nEND:VCARD\n`.trim();
      try {
        const ppUrl = await sock.profilePictureUrl(njid, "image").catch(() => null);
        if (ppUrl) {
          const imgBuf = await (await proxyFetch(ppUrl)).buffer().catch(() => null);
          if (imgBuf) {
            const b64 = imgBuf.toString("base64");
            vcard = vcard.replace("END:VCARD", `PHOTO;BASE64:${b64}\nEND:VCARD`);
          }
        }
      } catch {}
      if (biz.description) {
        vcard = vcard.replace("END:VCARD", `X-WA-BIZ-DESCRIPTION:${String(biz.description).replace(/\n/g, "\\n")}\nX-WA-BIZ-NAME:${String(name).replace(/\n/g, "\\n")}\nEND:VCARD`);
      }
      contacts.push({
        vcard: vcard,
        displayName: name
      });
    }
    if (contacts.length === 0) throw new Error("No valid contacts");
    return sock.sendMessage(jid, {
      ...options,
      contacts: {
        ...options,
        displayName: (contacts.length >= 2 ? `${contacts.length} contacts` : contacts[0].displayName) || null,
        contacts: contacts
      }
    }, {
      quoted: quoted,
      ...options,
      ...ephemeral
    });
  };
  sock.reply = (jid, text = "", quoted, options = {}) => {
    if (typeof text !== "string" && !Buffer.isBuffer(text)) {
      text = require("util").format(text);
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
      var {filename: filename} = await sock.getFile(buffer, true);
    }
    return saveToFile && fs.existsSync(filename) ? filename : buffer;
  };
  sock.downloadAndSaveMediaMessage = async (message, filename, attachExtension = true) => {
    let quoted = message.msg ? message.msg : message;
    let mime = (message.msg || message).mimetype || "";
    let messageType = message.mtype ? message.mtype.replace(/Message/gi, "") : mime.split("/")[0];
    const stream = await downloadContentFromMessage(quoted, messageType);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
      buffer = Buffer.concat([ buffer, chunk ]);
    }
    let type = await FileType.fromBuffer(buffer);
    const trueFileName = attachExtension ? filename + "." + type.ext : filename;
    await fs.writeFileSync(trueFileName, buffer);
    return trueFileName;
  };
  sock.sendReact = async (jid, emoji, key) => await sock.sendMessage(jid, {
    react: {
      text: emoji,
      key: key
    }
  });
  sock.sendPoll = async (jid, name, options, quoted) => {
    let opts = options || {};
    let selectableCount = 0;
    let pollOptions = [];
    if (Array.isArray(opts)) {
      pollOptions = opts.map(opt => typeof opt === "string" ? {
        optionName: opt
      } : {
        optionName: opt.name || opt.text || ""
      });
    } else if (opts.options) {
      pollOptions = opts.options.map(opt => {
        if (typeof opt === "string") return {
          optionName: opt
        };
        if (opt && typeof opt === "object") {
          return {
            optionName: opt.name || opt.text || opt.optionName || String(opt)
          };
        }
        return {
          optionName: String(opt)
        };
      });
    } else if (opts.values) {
      pollOptions = opts.values.map(v => ({
        optionName: typeof v === "string" ? v : v.name || v.text || ""
      }));
    }
    if (pollOptions.length < 2) throw new Error("Poll requires at least 2 options");
    const pollMessage = {
      name: name,
      options: pollOptions,
      selectableOptionsCount: selectableCount
    };
    try {
      return await sock.sendMessage(jid, {
        poll: {
          name: name,
          values: pollOptions.map(o => o.optionName),
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
  sock.pollResult = async (jid, pollData, quoted, options = {}) => {
    const name = pollData.name || pollData.title || "Poll Result";
    const votes = (pollData.votes || pollData.options || []).map(v => ({
      name: v.name || v.optionName || v.text || "",
      voteCount: parseInt(v.count ?? v.voteCount ?? v.votes ?? 0, 10)
    }));
    const pollType = pollData.pollType || 0;
    const content = {
      pollResult: {
        name: name,
        votes: votes.map(v => ({
          name: v.name,
          voteCount: v.voteCount
        })),
        pollType: pollType
      }
    };
    try {
      const msg = await generateWAMessage(jid, content, {
        upload: getWaUpload(),
        ...options
      });
      await sock.relayMessage(jid, msg.message, {
        messageId: msg.key.id
      });
      return msg;
    } catch (e) {
      let txt = `*${name}*\n`;
      votes.forEach((v, i) => {
        txt += `${i + 1}. ${v.name}: ${v.voteCount} votes\n`;
      });
      return await sock.sendMessage(jid, {
        text: txt.trim()
      }, {
        quoted: quoted
      });
    }
  };
  sock.sendPtv = async (jid, media, quoted, options = {}) => {
    let buffer = Buffer.isBuffer(media) ? media : isUrl(media) ? await (await proxyFetch(media)).buffer().catch(() => Buffer.alloc(0)) : typeof media === "string" && fs.existsSync(media) ? fs.readFileSync(media) : Buffer.alloc(0);
    return await sock.sendMessage(jid, {
      video: buffer,
      ptv: true,
      ...options
    }, {
      quoted: quoted
    });
  };
  sock.copyNForward = async (jid, msg, forceForward = false, options = {}) => {
    let vtype, ptype;
    if (options.readViewOnce) {
      vtype = msg.message.viewOnceMessage?.message;
      ptype = msg.message.viewOnceMessageV2?.message;
      delete msg.message.viewOnceMessage;
      delete msg.message.viewOnceMessageV2;
      msg.message = vtype || ptype || msg.message;
    }
    const mtype = Object.keys(msg.message)[0];
    const cMsg = proto.Message.fromObject(msg.message);
    const content = cMsg[mtype];
    if (typeof content === "string") cMsg[mtype] = content; else if (content.contextInfo) cMsg[mtype].contextInfo = content.contextInfo;
    if (forceForward) cMsg[mtype].contextInfo = {
      ...cMsg[mtype].contextInfo || {},
      forwardingScore: forceForward ? 1 : 0,
      isForwarded: true
    };
    await sock.relayMessage(jid, {
      [mtype]: cMsg
    }, {
      messageId: msg.key.id,
      ...options
    });
    return msg;
  };
  sock.replyButton = async (jid, buttons, msg, options = {}) => sock.sendIAMessage(jid, buttons, msg, options);
  sock.sendIAMessage = async (jid, buttons, msg, options = {}) => {
    const {header: header = "", content: content = options.content ?? options.text ?? "", footer: footer = "", media: media, multiple: multiple, v2: v2, mentions: mentions} = options;
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
  sock.sendFromAI = async (jid, text, quoted, options = {}) => {
    await sock.sendPresenceUpdate("composing", jid).catch(() => {});
    const waUp = getWaUpload();
    const mentions = parseMention(text);
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
    }, {
      tag: "bot",
      attrs: {
        biz_bot: "1"
      }
    } ];
    try {
      const msg = generateWAMessageFromContent(jid, {
        extendedTextMessage: {
          text: text,
          contextInfo: {
            mentionedJid: mentions,
            ...options.contextInfo
          }
        },
        messageContextInfo: {
          messageSecret: crypto.randomBytes(32),
          supportPayload: JSON.stringify({
            version: 1,
            is_ai_message: true,
            should_show_system_message: true,
            ticket_id: 0x5eece88464ef5
          })
        }
      }, {
        userJid: sock.user?.id || sock.user?.jid || jid,
        quoted: quoted,
        ...ephemeral
      });
      if (msg.message.extendedTextMessage) {
        msg.message.extendedTextMessage.contextInfo = {
          ...msg.message.extendedTextMessage.contextInfo,
          forwardingScore: 1,
          isForwarded: true,
          forwardedAiBotMessageInfo: {
            botJid: "0@bot"
          }
        };
      }
      await sock.relayMessage(jid, msg.message, {
        messageId: msg.key.id,
        additionalNodes: additionalNodes,
        ...ephemeral
      });
      return msg;
    } catch (e) {
      return await sock.sendMessage(jid, {
        text: text,
        mentions: mentions,
        ...options
      }, {
        quoted: quoted
      });
    }
  };
  sock.groupStatus = async (jid, content, options = {}) => {
    const waUp = getWaUpload();
    let msgContent = {};
    let isPrivate = !!options.private;
    if (content && content.key && content.message) {
      const mtype = Object.keys(content.message)[0];
      const inner = content.message[mtype];
      try {
        const msg = await generateWAMessage(jid, {
          [mtype.replace("Message", "").toLowerCase()]: inner,
          groupStatus: jid
        }, {
          upload: waUp
        });
        await sock.relayMessage(jid, msg.message, {
          messageId: msg.key.id
        });
        return msg;
      } catch (e) {
        await sock.relayMessage(jid, content.message, {
          messageId: content.key.id
        });
        return content;
      }
    }
    if (content && content.message && typeof content.message === "object" && !content.key) {
      const keys = Object.keys(content.message);
      const first = keys[0];
      if (first && first.endsWith("Message")) {
        msgContent = {
          ...content.message,
          groupStatus: jid
        };
        if (content.caption) {
          const k = first;
          if (msgContent[k]) msgContent[k].caption = content.caption;
        }
      } else {
        msgContent = {
          ...content,
          groupStatus: jid
        };
        delete msgContent.message;
        Object.assign(msgContent, content.message);
      }
      if (isPrivate) msgContent.groupStatus = jid;
    } else if (content && content.media) {
      let media = content.media;
      let caption = content.caption || "";
      let buffer;
      if (Buffer.isBuffer(media)) buffer = media; else if (isUrl(media)) buffer = await (await proxyFetch(media)).buffer().catch(() => Buffer.alloc(0)); else if (typeof media === "string" && fs.existsSync(media)) buffer = fs.readFileSync(media); else buffer = Buffer.alloc(0);
      let type = null;
      try {
        type = await FileType.fromBuffer(buffer);
      } catch {}
      let mime = type?.mime || "";
      if (/image/.test(mime)) {
        msgContent = {
          image: buffer,
          caption: caption,
          groupStatus: jid
        };
      } else if (/video/.test(mime)) {
        msgContent = {
          video: buffer,
          caption: caption,
          groupStatus: jid
        };
      } else if (/audio/.test(mime)) {
        msgContent = {
          audio: buffer,
          mimetype: "audio/mpeg",
          ptt: false,
          groupStatus: jid
        };
        if (content.background) msgContent.backgroundColor = content.background;
      } else {
        msgContent = {
          image: buffer,
          caption: caption,
          groupStatus: jid
        };
      }
      if (content.background) msgContent.backgroundColor = content.background;
    } else if (content && content.text) {
      msgContent = {
        text: content.text,
        groupStatus: jid
      };
      if (content.background) msgContent.backgroundColor = content.background;
      if (content.color) msgContent.backgroundColor = content.color;
      if (content.font) msgContent.font = content.font;
    } else if (typeof content === "string") {
      msgContent = {
        text: content,
        groupStatus: jid
      };
      if (options.background) msgContent.backgroundColor = options.background;
    } else if (content && (content.background || content.color)) {
      msgContent = {
        text: content.text || content.caption || "Hi!",
        groupStatus: jid,
        backgroundColor: content.background || content.color
      };
    } else {
      msgContent = {
        text: String(content || "Hi!"),
        groupStatus: jid
      };
    }
    if (msgContent.backgroundColor && typeof msgContent.backgroundColor === "string") {
      const hex = msgContent.backgroundColor.trim().replace("#", "");
      let num = parseInt(hex.length <= 6 ? "FF" + hex.padStart(6, "0") : hex, 16);
      if (!isNaN(num)) msgContent.backgroundColor = num;
    }
    if (isPrivate) {
      try {
        const statusJid = "status@broadcast";
        const msg = await generateWAMessage(statusJid, msgContent, {
          upload: waUp
        });
        if (options.private) {
          const attr = options.private;
          msg.message.messageContextInfo = msg.message.messageContextInfo || {};
          msg.message.messageContextInfo.statusAttribution = {
            type: 1,
            groupStatus: {
              groupJid: jid,
              attributionTag: attr.emoji || "🔥"
            }
          };
        }
        await sock.relayMessage(statusJid, msg.message, {
          messageId: msg.key.id,
          statusJidList: [ jid ]
        });
        return msg;
      } catch {}
    }
    try {
      const msg = await generateWAMessage(jid, msgContent, {
        upload: waUp
      });
      await sock.relayMessage(jid, msg.message, {
        messageId: msg.key.id
      });
      return msg;
    } catch (e) {
      try {
        const msg2 = await generateWAMessage("status@broadcast", msgContent, {
          upload: waUp
        });
        await sock.relayMessage("status@broadcast", msg2.message, {
          messageId: msg2.key.id,
          statusJidList: [ jid ]
        });
        return msg2;
      } catch (err) {
        throw e;
      }
    }
  };
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
  sock.aiRich = () => new AIRich(sock);
  sock.sendCarousel = async (jid, cards, msg, options = {}) => {
    const {content: content = "", footer: footer = ""} = options;
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

module.exports = {
  extMsgs: extMsgs
};