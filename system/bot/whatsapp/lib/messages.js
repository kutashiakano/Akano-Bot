const {
  generateWAMessage,
  generateWAMessageFromContent,
  downloadContentFromMessage,
  prepareWAMessageMedia,
  proto,
  areJidsSameUser
} = require("baileys");
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const FileType = require("file-type");
const PhoneNumber = require("awesome-phonenumber");
const { toAudio, toPTT } = require("./converter");
const { writeExifVid, videoToWebp } = require("./exif");
const { AIRich } = require("./ai-rich");

function extendMessages(sock, store, ephemeral) {
  sock.sendMessageModify = async (jid, text, msg, options = {}) => {
    const {
      largeThumb = false,
      thumbnail = "",
      url = "",
      body = "",
      title = "",
      ads = false,
      isForwarded = false,
    } = options;

    let messageOptions = {
      text: text,
      contextInfo: {
        mentionedJid:
          [...text.matchAll(/@([0-9]{5,16}|0)/g)].map(
            (v) => v[1] + "@s.whatsapp.net"
          ) || [],
        isForwarded: isForwarded,
      },
    };

    messageOptions.contextInfo.externalAdReply = {
      showAdAttribution: ads,
      title: title,
      body: body,
      sourceUrl: url,
      mediaType: 1,
      renderLargerThumbnail: largeThumb,
      thumbnailUrl: url || undefined,
      thumbnail: !url ? thumbnail : undefined,
    };

    return await sock.sendMessage(jid, messageOptions, {
      quoted: msg,
    });
  };

  sock.sendAlbumMessage = async (jid, medias, options = {}) => {
    if (typeof jid !== "string") {
      throw new TypeError(`jid must be string, received: ${jid}`);
    }
    for (const media of medias) {
      if (!media.type || (media.type !== "image" && media.type !== "video")) {
        throw new TypeError(`medias[i].type must be 'image' or 'video'`);
      }
      if (!media.data || (!media.data.url && !Buffer.isBuffer(media.data))) {
        throw new TypeError(`medias[i].data must be object with url or buffer`);
      }
    }
    if (medias.length < 2) throw new RangeError("Minimum 2 media");
    const caption = options.text || options.caption || "";
    const delay = !isNaN(options.delay) ? options.delay : 500;
    delete options.text;
    delete options.caption;
    delete options.delay;

    const album = generateWAMessageFromContent(
      jid,
      {
        messageContextInfo: {
          messageSecret: new Uint8Array(crypto.randomBytes(32)),
        },
        albumMessage: {
          expectedImageCount: medias.filter((media) => media.type === "image").length,
          expectedVideoCount: medias.filter((media) => media.type === "video").length,
          ...(options.quoted && options.quoted.message
            ? {
                contextInfo: {
                  remoteJid: options.quoted.key.remoteJid,
                  fromMe: options.quoted.key.fromMe,
                  stanzaId: options.quoted.key.id,
                  participant:
                    options.quoted.key.participant ||
                    options.quoted.key.remoteJid,
                  quotedMessage: options.quoted.message || "",
                },
              }
            : {}),
        },
      },
      {}
    );

    await sock.relayMessage(album.key.remoteJid, album.message, {
      messageId: album.key.id,
    });

    for (const i in medias) {
      const { type, data } = medias[i];
      const img = await generateWAMessage(
        album.key.remoteJid,
        {
          [type]: data,
          ...(i === "0" ? { caption } : {}),
        },
        {
          upload: sock.waUploadToServer,
        }
      ).catch(() => null);

      if (!img || !img.message) {
        continue;
      }
      img.message.messageContextInfo = {
        messageSecret: new Uint8Array(crypto.randomBytes(32)),
        messageAssociation: {
          associationType: 1,
          parentMessageKey: album.key,
        },
      };
      await sock.relayMessage(img.key.remoteJid, img.message, {
        messageId: img.key.id,
      });
      await sock.delay(delay);
    }
    return album;
  };

  sock.sendFile = async (
    jid,
    media,
    filename = "",
    caption = "",
    quoted,
    options = {}
  ) => {
    let isBuffer = Buffer.isBuffer(media);
    let type = isBuffer
      ? { mime: options.mimetype || "application/octet-stream" }
      : await sock.getFile(media, true);
    let fileData = isBuffer ? media : type.data;
    let mimetype = type.mime;
    let mtype = "document";

    if (/image/.test(mimetype)) {
      mtype = "image";
    } else if (/video/.test(mimetype) || /\.gif$/.test(filename)) {
      mtype = "video";
    } else if (/audio/.test(mimetype)) {
      if (options.ptt) {
        let converted = await toPTT(fileData, type.ext);
        fileData = converted.data;
        filename = converted.filename;
      } else if (options.audio) {
        let converted = await toAudio(fileData, type.ext);
        fileData = converted.data;
        filename = converted.filename;
      }
      mtype = "audio";
      mimetype = "audio/mpeg";
    }

    let message = {
      ...options,
      caption,
      filename,
      [mtype]: fileData,
      mimetype,
    };

    return await sock.sendMessage(jid, message, { quoted });
  };

  sock.sendVideoAsSticker = async (jid, pathData, quoted, options = {}) => {
    let buff = Buffer.isBuffer(pathData)
      ? pathData
      : /^data:.*?\/.*?;base64,/i.test(pathData)
      ? Buffer.from(pathData.split(",")[1], "base64")
      : /^https?:\/\//.test(pathData)
      ? await (await fetch(pathData)).buffer()
      : fs.existsSync(pathData)
      ? fs.readFileSync(pathData)
      : Buffer.alloc(0);
    let buffer;
    if (options && (options.packname || options.author)) {
      buffer = await writeExifVid(buff, options);
    } else {
      buffer = await videoToWebp(buff);
    }
    await sock.sendMessage(
      jid,
      {
        sticker: {
          url: buffer,
        },
        ...options,
      },
      {
        quoted,
        ...ephemeral,
      }
    );
    return buffer;
  };

  sock.sendContact = async (jid, data, quoted, options = {}) => {
    if (!Array.isArray(data[0]) && typeof data[0] === "string") data = [data];
    let contacts = [];
    for (let [number, name] of data) {
      number = number.replace(/[^0-9]/g, "");
      let njid = number + "@s.whatsapp.net";
      let biz = (await sock.getBusinessProfile(njid).catch(() => null)) || {};
      let vcard = `
BEGIN:VCARD
VERSION:3.0
FN:${name.replace(/\n/g, "\\n")}
ORG:
item1.TEL;waid=${number}:${PhoneNumber("+" + number).getNumber("international")}
item1.X-ABLabel:Ponsel${
        biz.description
          ? `
item2.EMAIL;type=INTERNET:${(biz.email || "").replace(/\n/g, "\\n")}
item2.X-ABLabel:Email
PHOTO;BASE64:${((await sock.getFile(await sock.profilePictureUrl(njid)).catch(() => ({}))) || {}).number?.toString("base64")}
X-WA-BIZ-DESCRIPTION:${(biz.description || "").replace(/\n/g, "\\n")}
X-WA-BIZ-NAME:${name.replace(/\n/g, "\\n")}
`
          : ""
      }
END:VCARD
`.trim();
      contacts.push({
        vcard,
        displayName: name,
      });
    }
    return sock.sendMessage(
      jid,
      {
        ...options,
        contacts: {
          ...options,
          displayName:
            (contacts.length >= 2
              ? `${contacts.length} contacts`
              : contacts[0].displayName) || null,
          contacts,
        },
      },
      {
        quoted,
        ...options,
        ...ephemeral,
      }
    );
  };

  sock.reply = (jid, text = "", quoted, options = {}) => {
    if (typeof text !== "string" && !Buffer.isBuffer(text)) {
      text = require("util").format(text);
    }
    return Buffer.isBuffer(text)
      ? sock.sendFile(jid, text, "file", "", quoted, false, options)
      : sock.sendMessage(
          jid,
          {
            ...options,
            text,
            mentions: sock.parseMention ? sock.parseMention(text) : [],
          },
          {
            quoted,
            ...options,
            mentions: sock.parseMention ? sock.parseMention(text) : [],
            ...ephemeral,
          }
        );
  };

  sock.downloadM = async (m, type, saveToFile) => {
    if (!m || !(m.url || m.directPath)) return Buffer.alloc(0);
    const stream = await downloadContentFromMessage(m, type);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
    }
    if (saveToFile) {
      var { filename } = await sock.getFile(buffer, true);
    }
    return saveToFile && fs.existsSync(filename) ? filename : buffer;
  };

  sock.downloadAndSaveMediaMessage = async (
    message,
    filename,
    attachExtension = true
  ) => {
    let quoted = message.msg ? message.msg : message;
    let mime = (message.msg || message).mimetype || "";
    let messageType = message.mtype
      ? message.mtype.replace(/Message/gi, "")
      : mime.split("/")[0];
    const stream = await downloadContentFromMessage(quoted, messageType);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
    }
    let type = await FileType.fromBuffer(buffer);
    const trueFileName = attachExtension ? filename + "." + type.ext : filename;
    await fs.writeFileSync(trueFileName, buffer);
    return trueFileName;
  };

  sock.sendReact = async (jid, emoji, key) => {
    return await sock.sendMessage(jid, {
      react: { text: emoji, key: key },
    });
  };

  sock.sendPoll = async (jid, name, options) => {
    const pollMessage = {
      name: name,
      options: (options.options || []).map((opt) => ({
        optionName: typeof opt === "string" ? opt : opt.text || opt.name || "",
      })),
      selectableOptionsCount: options.multiselect === false ? 1 : 0,
    };
    return sock.relayMessage(jid, { pollCreationMessage: pollMessage }, {});
  };

  sock.sendPtv = async (jid, media, quoted) => {
    let buffer = Buffer.isBuffer(media)
      ? media
      : /^https?:\/\//.test(media)
      ? await (await fetch(media)).buffer()
      : fs.existsSync(media)
      ? fs.readFileSync(media)
      : Buffer.alloc(0);
    return await sock.sendMessage(jid, { video: buffer, ptv: true }, { quoted });
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
    if (typeof content === "string") cMsg[mtype] = content;
    else if (content.contextInfo) cMsg[mtype].contextInfo = content.contextInfo;
    if (forceForward) cMsg[mtype].contextInfo = { ...(cMsg[mtype].contextInfo || {}), forwardingScore: forceForward ? 1 : 0, isForwarded: true };
    await sock.relayMessage(jid, { [mtype]: cMsg }, { messageId: msg.key.id, ...options });
    return msg;
  };

  sock.replyButton = async (jid, buttons, msg, options = {}) => {
    return sock.sendIAMessage(jid, buttons, msg, options);
  };

  sock.sendIAMessage = async (jid, buttons, msg, options = {}) => {
    const { header = "", content = options.content ?? options.text ?? "", footer = "", media, multiple, v2, mentions } = options;

    const nfButtons = (Array.isArray(buttons) ? buttons : [])
      .filter((b) => b && typeof b === "object")
      .map((b) => {
        if (b.name && (b.buttonParamsJson || b.params)) {
          return { name: b.name, buttonParamsJson: b.buttonParamsJson || JSON.stringify(b.params) };
        }
        return {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: String(b.text || b.display_text || ""),
            id: String(b.command || b.id || b.text || ""),
          }),
        };
      });

    const readSource = async (source) => {
      if (Buffer.isBuffer(source)) return source;
      if (typeof source === "string" && /^https?:\/\//i.test(source)) {
        const res = await fetch(source);
        return Buffer.from(await res.arrayBuffer());
      }
      if (typeof source === "string" && fs.existsSync(source)) return fs.readFileSync(source);
      return null;
    };

    let hdr = { title: header, hasMediaAttachment: false };

    if (media) {
      const isLocation = typeof media === "object" && !Buffer.isBuffer(media) &&
        (media.location || media.name || media.address || media.buffer || media.latitude !== undefined);
      const loc = isLocation ? media.location || media : null;

      if (loc && (loc.buffer || loc.image || loc.latitude !== undefined || loc.name || loc.address)) {
        const rawSource = loc.buffer ?? loc.image;
        let jpegThumbnail = null;
        if (rawSource) {
          const raw = await readSource(rawSource);
          if (raw) {
            const thumb = await sock.resize(raw, 300, 300);
            if (thumb) jpegThumbnail = thumb.toString("base64");
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
            ...(jpegThumbnail ? { jpegThumbnail } : {}),
          },
        };
      } else if (Buffer.isBuffer(media) || typeof media === "string") {
        const buf = await readSource(media);
        if (buf) {
          const img = await prepareWAMessageMedia({ image: buf }, { upload: sock.waUploadToServer }).catch(() => null);
          if (img?.imageMessage) {
            hdr = { title: header, subtitle: options.subtitle || "", hasMediaAttachment: true, ...img };
          }
        }
      }
    }

    const result = {
      header: hdr,
      body: { text: content },
      footer: { text: footer },
      nativeFlowMessage: {
        buttons: nfButtons,
        ...(multiple
          ? {
              messageParamsJson: JSON.stringify({
                bottom_sheet: {
                  in_thread_buttons_limit: 1,
                  divider_indices: nfButtons.map((_, i) => i),
                  list_title: multiple.list_title || "Select Options",
                  button_title: multiple.button_title || multiple.name || "Select",
                },
              }),
            }
          : {}),
      },
    };
    if (v2) result.nativeFlowMessage.messageVersion = 2;

    if (mentions && Array.isArray(mentions) && mentions.length > 0) {
      result.contextInfo = { mentionedJid: mentions, groupMentions: [], statusAttributions: [] };
    }

    const isGroupJid = typeof jid === "string" && jid.endsWith("@g.us");
    const additionalNodes = [
      {
        tag: "biz",
        attrs: {},
        content: [
          {
            tag: "interactive",
            attrs: { type: "native_flow", v: "1" },
            content: [{ tag: "native_flow", attrs: { name: "mixed", v: "9" } }],
          },
        ],
      },
      ...(isGroupJid ? [] : [{ tag: "bot", attrs: { biz_bot: "1" } }]),
    ];

    const msgContent = { interactiveMessage: result };
    return sock.relayMessage(jid, msgContent, {
      messageId: sock.generateMessageId ? sock.generateMessageId() : crypto.randomBytes(16).toString("hex"),
      additionalNodes,
      ...ephemeral,
    });
  };

  sock.aiRich = () => new AIRich(sock);

  sock.sendCarousel = async (jid, cards, msg, options = {}) => {
    const { content = "", footer = "" } = options;
    const carouselMessage = {
      viewOnceMessage: {
        message: {
          messageContextInfo: { deviceListMetadataVersion: 2, deviceListMetadata: {} },
          interactiveMessage: {
            body: { text: content },
            footer: { text: footer },
            carouselMessage: { cards },
          },
        },
      },
    };
    return sock.relayMessage(jid, carouselMessage, { messageId: sock.generateMessageId ? sock.generateMessageId() : crypto.randomBytes(16).toString("hex"), ...ephemeral });
  };
}

module.exports = { extendMessages };
