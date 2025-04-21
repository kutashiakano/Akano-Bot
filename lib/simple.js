const {
  makeWASocket,
  makeWALegacySocket,
  extractMessageContent,
  makeInMemoryStore,
  proto,
  prepareWAMessageMedia,
  downloadContentFromMessage,
  jidDecode,
  generateWAMessage,
  areJidsSameUser,
  prepareMessageFromContent,
  generateForwardMessageContent,
  generateWAMessageFromContent,
  WAMessageStubType,
  WA_DEFAULT_EPHEMERAL,
} = require("baileys");
const { toAudio, toPTT, toVideo } = require("./converter");
const chalk = require("chalk");
const crypto = require("crypto");
const fetch = require("node-fetch");
const FileType = require("file-type");
const PhoneNumber = require("awesome-phonenumber");
const fs = require("fs");
const path = require("path");
const Jimp = require("jimp");
const pino = require("pino");
const store = makeInMemoryStore({
  logger: pino().child({
    level: "silent",
    stream: "store",
  }),
});
const {
  imageToWebp,
  videoToWebp,
  writeExifImg,
  writeExifVid,
} = require("./exif");
global.ephemeral = {
  ephemeralExpiration: 86400,
};

exports.makeWASocket = (connectionOptions, store, options = {}) => {
  let sock = (global.opts["legacy"] ? makeWALegacySocket : makeWASocket)(
    connectionOptions,
  );

  sock.delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  
  sock.story = async (m) => { return global.status || [] };

  sock.decodeJid = (jid) => {
    if (!jid) return jid;
    if (/:\d+@/gi.test(jid)) {
      const decode = jidDecode(jid) || {};
      return (
        (decode.user && decode.server && decode.user + "@" + decode.server) ||
        jid
      );
    } else return jid;
  };
  if (sock.user && sock.user.id) sock.user.jid = sock.decodeJid(sock.user.id);
  sock.logger = {
    ...sock.logger,
    info(...args) {
      console.log(
        chalk.bold.rgb(
          57,
          183,
          16,
        )(`INFO [${chalk.rgb(255, 255, 255)(new Date())}]:`),
        chalk.cyan(...args),
      );
    },
    error(...args) {
      console.log(
        chalk.bold.rgb(
          247,
          38,
          33,
        )(`ERROR [${chalk.rgb(255, 255, 255)(new Date())}]:`),
        chalk.rgb(255, 38, 0)(...args),
      );
    },
    warn(...args) {
      console.log(
        chalk.bold.rgb(
          239,
          225,
          3,
        )(`WARNING [${chalk.rgb(255, 255, 255)(new Date())}]:`),
        chalk.keyword("orange")(...args),
      );
    },
  };

  sock.appendTextMessage = async (m, text, chatUpdate) => {
    let messages = await generateWAMessage(
      m.chat,
      {
        text: text,
        mentions: m.mentionedJid,
      },
      {
        userJid: sock.user.id,
        quoted: m.quoted && m.quoted.fakeObj,
        ...ephemeral,
      },
    );
    messages.key.fromMe = areJidsSameUser(m.sender, sock.user.id);
    messages.key.id = m.key.id;
    messages.pushName = m.pushName;
    if (m.isGroup) messages.participant = m.sender;
    let msg = {
      ...chatUpdate,
      messages: [proto.WebMessageInfo.fromObject(messages)],
      type: "append",
    };
    sock.ev.emit("messages.upsert", msg);
    return m;
  };

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
            (v) => v[1] + "@s.whatsapp.net",
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

  sock.sizeLimit = async (str, max) => {
    let upperStr = str.toUpperCase();

    if (upperStr.startsWith("HTTP")) {
      try {
        const response = await fetch(str, { method: "HEAD" });
        const fileSize = response.headers.get("content-length");
        if (!fileSize) return { oversize: true, error: "File size not found" };

        const fileSizeMB = parseFloat(
          (parseInt(fileSize, 10) / (1024 * 1024)).toFixed(2),
        );
        return { oversize: fileSizeMB > max, size: `${fileSizeMB}MB` };
      } catch {
        return { oversize: true, error: "Failed to fetch URL" };
      }
    }

    if (/G(B)?|T(B)?/.test(upperStr)) return { oversize: true };

    if (/M(B)?/.test(upperStr)) {
      let first = parseFloat(upperStr.replace(/MB|M|G|T/gi, "").trim());
      if (isNaN(first)) return { oversize: true };
      return { oversize: first > max, size: `${first}MB` };
    }

    return { oversize: false };
  };

  sock.getFile = async (PATH) => {
    let res;
    const data = Buffer.isBuffer(PATH)
      ? PATH
      : /^data:.*?\/.*?;base64,/i.test(PATH)
        ? Buffer.from(PATH.split`,`[1], "base64")
        : /^https?:\/\//.test(PATH)
          ? await (res = await fetch(PATH)).buffer()
          : fs.existsSync(PATH)
            ? fs.readFileSync(PATH)
            : typeof PATH === "string"
              ? PATH
              : Buffer.alloc(0);

    if (!Buffer.isBuffer(data)) throw new TypeError("Result is not a buffer");

    const type = (await FileType.fromBuffer(data)) || {
      mime: "application/octet-stream",
      ext: ".bin",
    };

    return {
      res,
      ...type,
      data,
    };
  };

  sock.mentionStatus = async function (jids, content) {
    const fetchParticipants = async (jid) => {
      const { participants } = await sock.groupMetadata(jid);
      return participants.map(({ id }) => id);
    };

    const msg = await generateWAMessage(STORIES_JID, content, {
      upload: sock.waUploadToServer,
    });

    let statusJidList = [];
    for (const _jid of jids) {
      if (_jid.endsWith("@g.us")) {
        const participants = await fetchParticipants(_jid);
        statusJidList.push(...participants);
      } else {
        statusJidList.push(_jid);
      }
    }
    statusJidList = [...new Set(statusJidList)];

    await sock.relayMessage(msg.key.remoteJid, msg.message, {
      messageId: msg.key.id,
      statusJidList,
      additionalNodes: [
        {
          tag: "meta",
          attrs: {},
          content: [
            {
              tag: "mentioned_users",
              attrs: {},
              content: jids.map((jid) => ({
                tag: "to",
                attrs: {
                  jid,
                },
                content: undefined,
              })),
            },
          ],
        },
      ],
    });

    for (const jid of jids) {
      let type = jid.endsWith("@g.us")
        ? "groupStatusMentionMessage"
        : "statusMentionMessage";
      await sock.relayMessage(
        jid,
        {
          [type]: {
            message: {
              protocolMessage: {
                key: msg.key,
                type: 25,
              },
            },
          },
        },
        {
          additionalNodes: [
            {
              tag: "meta",
              attrs: {
                is_status_mention: "true",
              },
              content: undefined,
            },
          ],
        },
      );
    }
    return msg;
  };

  sock.sendAlbumMessage = async (jid, medias, options = {}) => {
    if (typeof jid !== "string")
      throw new TypeError(
        `jid must be string, received: ${jid} (${jid?.constructor?.name})`,
      );
    for (const media of medias) {
      if (!media.type || (media.type !== "image" && media.type !== "video"))
        throw new TypeError(
          `medias[i].type must be 'image' or 'video', received: ${media.type} (${media.type?.constructor?.name})`,
        );
      if (!media.data || (!media.data.url && !Buffer.isBuffer(media.data)))
        throw new TypeError(
          `medias[i].data must be object with url or buffer, received: ${media.data} (${media.data?.constructor?.name})`,
        );
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
          expectedImageCount: medias.filter((media) => media.type === "image")
            .length,
          expectedVideoCount: medias.filter((media) => media.type === "video")
            .length,
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
      {},
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
          ...(i === "0"
            ? {
                caption,
              }
            : {}),
        },
        {
          upload: sock.waUploadToServer,
        },
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
    options = {},
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

  sock.sendVideoAsSticker = async (jid, path, quoted, options = {}) => {
    let buff = Buffer.isBuffer(path)
      ? path
      : /^data:.*?\/.*?;base64,/i.test(path)
        ? Buffer.from(path.split(",")[1], "base64")
        : /^https?:\/\//.test(path)
          ? await (await fetch(path)).buffer()
          : fs.existsSync(path)
            ? fs.readFileSync(path)
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
      },
    );
    return buffer;
  };

  sock.sendContact = async (jid, data, quoted, options) => {
    if (!Array.isArray(data[0]) && typeof data[0] === "string") data = [data];
    let contacts = [];
    for (let [number, name] of data) {
      number = number.replace(/[^0-9]/g, "");
      let njid = number + "@s.whatsapp.net";
      let biz = (await sock.getBusinessProfile(njid).catch((_) => null)) || {};
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
PHOTO;BASE64:${((await sock.getFile(await sock.profilePictureUrl(njid)).catch((_) => ({}))) || {}).number?.toString("base64")}
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
              ? `${contacts.length} kontak`
              : contacts[0].displayName) || null,
          contacts,
        },
      },
      {
        quoted,
        ...options,
        ...ephemeral,
      },
    );
    enumerable: true;
  };

  sock.reply = (jid, text = "", quoted, options) => {
    return Buffer.isBuffer(text)
      ? sock.sendFile(jid, text, "file", "", quoted, false, options)
      : sock.sendMessage(
          jid,
          {
            ...options,
            text,
            mentions: sock.parseMention(text),
          },
          {
            quoted,
            ...options,
            mentions: sock.parseMention(text),
            ...ephemeral,
          },
        );
  };

  sock.resize = async (image, width, height) => {
    let size = await Jimp.read(image);
    let buffer = await size
      .resize(width, height)
      .getBufferAsync(Jimp.MIME_JPEG);
    return buffer;
  };

  sock.sendGroupV4Invite = async (
    jid,
    participant,
    inviteCode,
    inviteExpiration,
    groupName = "unknown subject",
    caption = "Invitation to join my WhatsApp group",
    options = {},
  ) => {
    let msg = proto.Message.fromObject({
      groupInviteMessage: proto.GroupInviteMessage.fromObject({
        inviteCode,
        inviteExpiration:
          parseInt(inviteExpiration) || +new Date(new Date() + 3 * 86400000),
        groupJid: jid,
        groupName: groupName ? groupName : this.getName(jid),
        caption,
      }),
    });
    let message = await prepareMessageFromContent(participant, msg, options);
    await this.relayWAMessage(message);
    return message;
  };

  sock.cMod = (
    jid,
    message,
    text = "",
    sender = sock.user.jid,
    options = {},
  ) => {
    let copy = message.toJSON();
    let mtype = Object.keys(copy.message)[0];
    let isEphemeral = false;
    if (isEphemeral) {
      mtype = Object.keys(copy.message.ephemeralMessage.message)[0];
    }
    let msg = isEphemeral
      ? copy.message.ephemeralMessage.message
      : copy.message;
    let content = msg[mtype];
    if (typeof content === "string") msg[mtype] = text || content;
    else if (content.caption) content.caption = text || content.caption;
    else if (content.text) content.text = text || content.text;
    if (typeof content !== "string")
      msg[mtype] = {
        ...content,
        ...options,
      };
    if (copy.participant)
      sender = copy.participant = sender || copy.participant;
    else if (copy.key.participant)
      sender = copy.key.participant = sender || copy.key.participant;
    if (copy.key.remoteJid.includes("@s.whatsapp.net"))
      sender = sender || copy.key.remoteJid;
    else if (copy.key.remoteJid.includes("@broadcast"))
      sender = sender || copy.key.remoteJid;
    copy.key.remoteJid = jid;
    copy.key.fromMe = areJidsSameUser(sender, sock.user.id) || false;
    return proto.WebMessageInfo.fromObject(copy);
  };

  sock.copyNForward = async (
    jid,
    message,
    forwardingScore = true,
    options = {},
  ) => {
    let m = generateForwardMessageContent(message, !!forwardingScore);
    let mtype = Object.keys(m)[0];
    if (
      forwardingScore &&
      typeof forwardingScore == "number" &&
      forwardingScore > 1
    )
      m[mtype].contextInfo.forwardingScore += forwardingScore;
    m = generateWAMessageFromContent(jid, m, {
      ...options,
      userJid: sock.user.id,
    });
    await sock.relayMessage(jid, m.message, {
      messageId: m.key.id,
      additionalAttributes: {
        ...options,
      },
    });
    return m;
  };

  sock.downloadM = async (m, type, saveToFile) => {
    if (!m || !(m.url || m.directPath)) return Buffer.alloc(0);
    const stream = await downloadContentFromMessage(m, type);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
    }
    if (saveToFile) var { filename } = await sock.getFile(buffer, true);
    return saveToFile && fs.existsSync(filename) ? filename : buffer;
  };

  sock.downloadAndSaveMediaMessage = async (
    message,
    filename,
    attachExtension = true,
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
    trueFileName = attachExtension ? filename + "." + type.ext : filename;
    await fs.writeFileSync(trueFileName, buffer);
    return trueFileName;
  };

  sock.parseMention = (text = "") => {
    return [...text.matchAll(/@([0-9]{5,16}|0)/g)].map(
      (v) => v[1] + "@s.whatsapp.net",
    );
  };

  sock.chatRead = async (jid, participant = sock.user.jid, messageID) => {
    return await sock.sendReadReceipt(jid, participant, [messageID]);
  };

  sock.getName = async (jid = "", withoutContact = false) => {
    jid = sock.decodeJid(jid);
    withoutContact = this.withoutContact || withoutContact;
    let v;
    if (jid.endsWith("@g.us"))
      return new Promise(async (resolve) => {
        v = (await sock.groupMetadata(jid)) || {};
        if (!(v.name || v.subject)) v = (await sock.groupMetadata(jid)) || {};
        resolve(
          v.name ||
            v.subject ||
            PhoneNumber("+" + jid.replace("@s.whatsapp.net", "")).getNumber(
              "international",
            ),
        );
      });
    else
      v =
        jid === "0@s.whatsapp.net"
          ? {
              jid,
              vname: "WhatsApp",
            }
          : areJidsSameUser(jid, sock.user.id)
            ? sock.user
            : {};
    return (
      (withoutContact ? "" : v.name) ||
      v.subject ||
      v.vname ||
      v.notify ||
      v.verifiedName ||
      PhoneNumber("+" + jid.replace("@s.whatsapp.net", "")).getNumber(
        "international",
      )
    );
  };

  sock.processMessageStubType = async (m) => {
    if (!m.messageStubType) return;
    const chat = sock.decodeJid(
      m.key.remoteJid || m.message?.senderKeyDistributionMessage?.groupId || "",
    );
    if (!chat || chat === "status@broadcast") return;
    const emitGroupUpdate = (update) => {
      sock.ev.emit("groups.update", [
        {
          id: chat,
          ...update,
        },
      ]);
    };
    switch (m.messageStubType) {
      case WAMessageStubType.REVOKE:
      case WAMessageStubType.GROUP_BotGE_INVITE_LINK:
        emitGroupUpdate({
          revoke: m.messageStubParameters[0],
        });
        break;
      case WAMessageStubType.GROUP_BotGE_ICON:
        emitGroupUpdate({
          icon: m.messageStubParameters[0],
        });
        break;
      default: {
        console.log({
          messageStubType: m.messageStubType,
          messageStubParameters: m.messageStubParameters,
          type: WAMessageStubType[m.messageStubType],
        });
        break;
      }
    }
    const isGroup = chat.endsWith("@g.us");
    if (!isGroup) return;
    let chats = sock.chats[chat];
    if (!chats)
      chats = sock.chats[chat] = {
        id: chat,
      };
    chats.isChats = true;
    const metadata = await sock.groupMetadata(chat).catch((_) => null);
    if (!metadata) return;
    chats.subject = metadata.subject;
    chats.metadata = metadata;
  };

  sock.sendPoll = async (jid, name = "", optiPoll, options) => {
    if (!Array.isArray(optiPoll[0]) && typeof optiPoll[0] === "string")
      optiPoll = [optiPoll];
    if (!options) options = {};
    const pollMessage = {
      name: name,
      options: optiPoll.map((btn) => ({
        optionName: btn[0] || "",
      })),
      selectableOptionsCount: 1,
    };
    return sock.relayMessage(
      jid,
      {
        pollCreationMessage: pollMessage,
      },
      {
        ...options,
      },
    );
  };

  sock.setBio = async (status) => {
    return await sock.query({
      tag: "iq",
      attrs: {
        to: "s.whatsapp.net",
        type: "set",
        xmlns: "status",
      },
      content: [
        {
          tag: "status",
          attrs: {},
          content: Buffer.from(status, "utf-8"),
        },
      ],
    });
  };

  sock.serializeM = (m) => {
    return exports.smsg(sock, m);
  };
  Object.defineProperty(sock, "name", {
    value: "WASocket",
    configurable: true,
  });
  return sock;
};

exports.smsg = (sock, m, hasParent) => {
  if (!m) return m;
  let M = proto.WebMessageInfo;
  m = M.fromObject(m);
  if (m.key) {
    m.id = m.key.id;
    m.isBaileys =
      m?.id.startsWith("BAE5") ||
      m?.id.indexOf("-") > 1 ||
      //m?.id.startsWith("3EB0") ||
      false;
    m.chat = sock.decodeJid(
      m.key.remoteJid ||
        message.message?.senderKeyDistributionMessage?.groupId ||
        "",
    );
    m.isGroup = m.chat.endsWith("@g.us");
    m.sender = sock.decodeJid(
      (m.key.fromMe && sock.user.id) ||
        m.participant ||
        m.key.participant ||
        m.chat ||
        "",
    );
    m.fromMe = m.key.fromMe || areJidsSameUser(m.sender, sock.user.id);
  }
  if (m.message) {
    let mtype = Object.keys(m.message);
    m.mtype =
      (!["senderKeyDistributionMessage", "messageContextInfo"].includes(
        mtype[0],
      ) &&
        mtype[0]) ||
      (mtype.length >= 3 && mtype[1] !== "messageContextInfo" && mtype[1]) ||
      mtype[mtype.length - 1];
    m.msg = m.message[m.mtype];
    if (
      m.chat == "status@broadcast" &&
      ["protocolMessage", "senderKeyDistributionMessage"].includes(m.mtype)
    )
      m.chat =
        (m.key.remoteJid !== "status@broadcast" && m.key.remoteJid) || m.sender;
    if (m.mtype == "protocolMessage" && m.msg.key) {
      if (m.msg.key.remoteJid == "status@broadcast")
        m.msg.key.remoteJid = m.chat;
      if (!m.msg.key.participant || m.msg.key.participant == "status_me")
        m.msg.key.participant = m.sender;
      m.msg.key.fromMe =
        sock.decodeJid(m.msg.key.participant) === sock.decodeJid(sock.user.id);
      if (
        !m.msg.key.fromMe &&
        m.msg.key.remoteJid === sock.decodeJid(sock.user.id)
      )
        m.msg.key.remoteJid = m.sender;
    }
    m.text = m.msg.text || m.msg.caption || m.msg.contentText || m.msg || "";
    if (typeof m.text !== "string") {
      if (
        [
          "protocolMessage",
          "messageContextInfo",
          "stickerMessage",
          "audioMessage",
          "senderKeyDistributionMessage",
        ].includes(m.mtype)
      )
        m.text = "";
      else
        m.text =
          m.text.selectedDisplayText ||
          m.text.hydratedTemplate?.hydratedContentText ||
          m.text;
    }
    m.mentionedJid =
      (m.msg?.contextInfo?.mentionedJid?.length &&
        m.msg.contextInfo.mentionedJid) ||
      [];
    let quoted = (m.quoted = m.msg?.contextInfo?.quotedMessage
      ? m.msg.contextInfo.quotedMessage
      : null);
    if (m.quoted) {
      let type = Object.keys(m.quoted)[0];
      m.quoted = m.quoted[type];
      if (typeof m.quoted === "string")
        m.quoted = {
          text: m.quoted,
        };
      m.quoted.mtype = type;
      m.quoted.id = m.msg.contextInfo.stanzaId;
      m.quoted.chat = sock.decodeJid(
        m.msg.contextInfo.remoteJid || m.chat || m.sender,
      );
      m.quoted.isBaileys = m.quoted.id.startsWith("3EB0") || false;
      m.quoted.sender = sock.decodeJid(m.msg.contextInfo.participant);
      m.quoted.fromMe = m.quoted.sender === sock.user.jid;
      m.quoted.text =
        m.quoted.text || m.quoted.caption || m.quoted.contentText || "";
      m.quoted.name = sock.getName(m.quoted.sender);
      m.quoted.mentionedJid =
        (m.quoted.contextInfo?.mentionedJid?.length &&
          m.quoted.contextInfo.mentionedJid) ||
        [];
      let vM = (m.quoted.fakeObj = M.fromObject({
        key: {
          fromMe: m.quoted.fromMe,
          remoteJid: m.quoted.chat,
          id: m.quoted.id,
        },
        message: quoted,
        ...(m.isGroup
          ? {
              participant: m.quoted.sender,
            }
          : {}),
      }));
      m.getQuotedObj = m.getQuotedMessage = async () => {
        if (!m.quoted.id) return null;
        let q = M.fromObject(
          (await store.loadMessage(m.chat, m.quoted.id)) || vM,
        );
        return exports.smsg(sock, q);
      };
      if (m.quoted.url || m.quoted.directPath)
        m.quoted.download = (saveToFile = false) =>
          sock.downloadM(
            m.quoted,
            m.quoted.mtype.replace(/message/i, ""),
            saveToFile,
          );
      m.quoted.reply = (text, chatId, options) =>
        sock.reply(chatId ? chatId : m.chat, text, vM, options);
      m.quoted.copy = () => exports.smsg(sock, M.fromObject(M.toObject(vM)));
      m.quoted.forward = (jid, forceForward = false) =>
        sock.forwardMessage(jid, vM, forceForward);
      m.quoted.copyNForward = (jid, forceForward = true, options = {}) =>
        sock.copyNForward(jid, vM, forceForward, options);
      m.quoted.cMod = (
        jid,
        text = "",
        sender = m.quoted.sender,
        options = {},
      ) => sock.cMod(jid, vM, text, sender, options);
      m.quoted.delete = () =>
        sock.sendMessage(m.quoted.chat, {
          delete: vM.key,
        });
    }
  }
  m.name = m.pushName || sock.getName(m.sender);
  if (m.msg && m.msg.url)
    m.download = (saveToFile = false) =>
      sock.downloadM(m.msg, m.mtype.replace(/message/i, ""), saveToFile);
  m.copy = () => exports.smsg(sock, M.fromObject(M.toObject(m)));
  m.forward = (jid = m.chat, forceForward = false) =>
    sock.copyNForward(jid, m, forceForward, options);
  m.reply = async (pesan, options) => {
    try {
      if (options && pesan) {
        sock.sendFile(m.chat, options, null, pesan, m, null);
      } else {
        if (pesan) {
          sock.reply(m.chat, pesan, m);
        } else {
          sock.reply(m.chat, options, m);
        }
      }
    } catch (e) {
      sock.reply(m.chat, pesan, m);
    }
  };
  m.react = async (emoji) => {
    await sock.sendMessage(m.chat, {
      react: {
        text: emoji,
        key: m.key,
      },
    });
  };
  m.copyNForward = (jid = m.chat, forceForward = true, options = {}) =>
    sock.copyNForward(jid, m, forceForward, options);
  m.cMod = (jid, text = "", sender = m.sender, options = {}) =>
    sock.cMod(jid, m, text, sender, options);
  m.delete = () =>
    sock.sendMessage(m.chat, {
      delete: m.key,
    });
  try {
    if (m.msg && m.mtype == "protocolMessage")
      sock.ev.emit("message.delete", m.msg.key);
  } catch (e) {
    console.error(e);
  }
  return m;
};

function isNumber() {
  const int = parseInt(this);
  return typeof int === "number" && !isNaN(int);
}

function getRandom() {
  if (Array.isArray(this) || this instanceof String)
    return this[Math.floor(Math.random() * this.length)];
  return Math.floor(Math.random() * this);
}

function rand(isi) {
  return isi[Math.floor(Math.random() * isi.length)];
}
