const crypto = require("crypto");
const {prepareWAMessageMedia: prepareWAMessageMedia, wrapToBotForwardedMessage: wrapToBotForwardedMessage, tokenizeCode: tokenizeCode, proto: proto} = require("baileys");

function extractIE(text, {extract: extract = true, hyperlink: hyperlink = true, citation: citation = true, latex: latex = true} = {}) {
  if (!extract) {
    return {
      text: text,
      ie: [],
      inline_entities: []
    };
  }
  const createIE = (type, ie) => {
    if (type == "hyperlink") {
      return {
        key: ie.key,
        metadata: {
          display_name: ie.text,
          is_trusted: ie.is_trusted,
          url: ie.url,
          __typename: "GenAIInlineLinkItem"
        }
      };
    }
    if (type == "citation") {
      return {
        key: ie.key,
        metadata: {
          reference_id: ie.reference_id,
          reference_url: ie.url,
          reference_title: ie.url,
          reference_display_name: ie.url,
          sources: [],
          __typename: "GenAISearchCitationItem"
        }
      };
    }
    if (type == "latex") {
      return {
        key: ie.key,
        metadata: {
          latex_expression: ie.text,
          latex_image: {
            url: ie.url,
            width: Number(ie.width) || 100,
            height: Number(ie.height) || 100
          },
          font_height: Number(ie.font_height) || 83.333333333333,
          padding: Number(ie.padding) || 15,
          __typename: "GenAILatexItem"
        }
      };
    }
  };
  let ie = [];
  let inline_entities = [];
  let result = "";
  let last = 0;
  let citation_index = 1;
  let hyperlink_index = 0;
  let latex_index = 0;
  let stack = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] == "[" && text[i - 1] != "\\") {
      stack.push(i);
    } else if (text[i] == "]" && (text[i + 1] == "(" || text[i + 1] == "<")) {
      let start = stack.pop();
      if (start == null) continue;
      let open = text[i + 1];
      let close = open == "(" ? ")" : ">";
      let type = open == "(" ? "link" : "latex";
      let end = i + 2;
      let depth = 1;
      while (end < text.length && depth) {
        if (text[end] == open && text[end - 1] != "\\") depth++; else if (text[end] == close && text[end - 1] != "\\") depth--;
        end++;
      }
      if (depth) continue;
      let raw = text.slice(start + 1, i).trim();
      let url = text.slice(i + 2, end - 1).trim();
      let key;
      let tag;
      let data;
      if (type == "latex") {
        if (!latex) continue;
        let [txt = "", width = null, height = null, font_height = null, padding = null] = raw.split("|");
        key = `_LATEX_${latex_index++}`;
        tag = `{{${key}}}${txt || "image"}{{/${key}}}`;
        data = {
          type: "latex",
          ie: {
            key: key,
            text: txt,
            url: url,
            width: width,
            height: height,
            font_height: font_height,
            padding: padding
          }
        };
      } else if (raw) {
        if (!hyperlink) continue;
        const trusted = !url.startsWith("!");
        if (!trusted) {
          url = url.slice(1);
        }
        key = `_HYPERLINK_${hyperlink_index++}`;
        tag = `{{${key}}}${url}{{/${key}}}`;
        data = {
          type: "hyperlink",
          ie: {
            key: key,
            text: raw,
            url: url,
            is_trusted: trusted
          }
        };
      } else {
        if (!citation) continue;
        key = `_CITATION_${citation_index - 1}`;
        tag = `{{${key}}}${url}{{/${key}}}`;
        data = {
          type: "citation",
          ie: {
            reference_id: citation_index++,
            key: key,
            text: "",
            url: url
          }
        };
      }
      result += text.slice(last, start) + tag;
      last = end;
      ie.push(data);
      const entity = createIE(data.type, data.ie);
      if (entity) {
        inline_entities.push(entity);
      }
      i = end - 1;
    }
  }
  result += text.slice(last);
  return {
    text: result,
    ie: ie,
    inline_entities: inline_entities
  };
}

class BaseBuilder {
  constructor() {
    this._title = "";
    this._subtitle = "";
    this._body = "";
    this._footer = "";
    this._contextInfo = {};
    this._extraPayload = {};
  }
  setTitle(title) {
    if (typeof title !== "string") {
      throw new TypeError("Title must be a string");
    }
    this._title = title;
    return this;
  }
  setSubtitle(subtitle) {
    if (typeof subtitle !== "string") {
      throw new TypeError("Subtitle must be a string");
    }
    this._subtitle = subtitle;
    return this;
  }
  setBody(body) {
    if (typeof body !== "string") {
      throw new TypeError("Body must be a string");
    }
    this._body = body;
    return this;
  }
  setFooter(footer) {
    if (typeof footer !== "string") {
      throw new TypeError("Footer must be a string");
    }
    this._footer = footer;
    return this;
  }
  setContextInfo(obj) {
    if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
      throw new TypeError("ContextInfo must be a plain object");
    }
    this._contextInfo = obj;
    return this;
  }
  addPayload(obj) {
    if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
      throw new TypeError("Payload must be a plain object");
    }
    Object.assign(this._extraPayload, obj);
    return this;
  }
}

class AIRich extends BaseBuilder {
  #client;
  constructor(client) {
    if (!client) {
      throw new Error("Socket is required");
    }
    super();
    this.#client = client;
    this._contextInfo = {};
    this._items = [];
    this._links = [];
  }
  addText(text, {hyperlink: hyperlink = true, citation: citation = true, latex: latex = true} = {}) {
    if (typeof text != "string") {
      throw new TypeError("Text must be a string");
    }
    const {text: extractedText, inline_entities: inline_entities} = extractIE(text, {
      hyperlink: hyperlink,
      citation: citation,
      latex: latex
    });
    this._items.push({
      type: "text",
      text: extractedText,
      ...inline_entities.length && {
        inlineEntities: inline_entities
      }
    });
    return this;
  }
  addCode(language, code) {
    if (typeof language !== "string" || typeof code !== "string") {
      throw new TypeError("Language and code must be a string");
    }
    this._items.push({
      type: "code",
      language: language,
      code: code
    });
    return this;
  }
  addTable(table) {
    if (!Array.isArray(table) || !table.every(row => Array.isArray(row) && row.every(cell => typeof cell === "string"))) {
      throw new TypeError("Table must be a nested array of strings");
    }
    const maxLen = Math.max(...table.map(r => r.length));
    this._items.push({
      type: "table",
      table: table.map(r => [ ...r, ...Array(maxLen - r.length).fill("") ])
    });
    return this;
  }
  addSource(sources = []) {
    if (!(Array.isArray(sources) && (sources.every(item => typeof item === "string") || sources.every(item => Array.isArray(item) && item.every(v => typeof v === "string"))))) {
      throw new TypeError("Sources must be a string array or an array of string arrays");
    }
    if (sources.every(item => typeof item === "string")) {
      sources = [ sources ];
    }
    for (const [icon, url, text] of sources) {
      this._links.push({
        text: text || "",
        url: url || "",
        title: text || "Source",
        displayName: text || "Source",
        ...icon ? {
          sources: [ {
            source_type: "THIRD_PARTY",
            source_display_name: text || "Source",
            source_subtitle: "AI",
            source_url: url || ""
          } ]
        } : {}
      });
    }
    return this;
  }
  addImage(imageUrl, {resolveUrl: resolveUrl = false} = {}) {
    if (!(typeof imageUrl === "string" || Buffer.isBuffer(imageUrl))) {
      throw new TypeError("imageUrl must be string or buffer");
    }
    this._items.push({
      type: "image",
      image: imageUrl,
      resolveUrl: resolveUrl
    });
    return this;
  }
  addTip(text) {
    if (typeof text !== "string") {
      throw new TypeError("Tip must be a string");
    }
    this._items.push({
      type: "tip",
      text: text
    });
    return this;
  }
  addSuggest(suggestion, {scroll: scroll = true, layout: layout} = {}) {
    if (!(typeof suggestion === "string" || Array.isArray(suggestion) && suggestion.every(v => typeof v === "string"))) {
      throw new TypeError("Suggestion must be a string or array of strings");
    }
    this._items.push({
      type: "suggest",
      suggestion: suggestion,
      scroll: scroll,
      layout: layout
    });
    return this;
  }
  async build({forwarded: forwarded = true, quoted: quoted, quotedParticipant: quotedParticipant, ...options} = {}) {
    const uuid = crypto.randomUUID();
    const submessages = [];
    const sections = [];
    const pushSec = (text, inlineEntities = []) => {
      submessages.push({
        messageType: 2,
        messageText: text,
        ...inlineEntities.length ? {
          inlineEntities: inlineEntities
        } : {}
      });
      sections.push({
        view_model: {
          primitive: {
            text: text,
            ...inlineEntities.length ? {
              inline_entities: inlineEntities
            } : {},
            __typename: "GenAIMarkdownTextUXPrimitive"
          },
          __typename: "GenAISingleLayoutViewModel"
        }
      });
    };
    for (const item of this._items) {
      if (item.type === "text") {
        pushSec(item.text, item.inlineEntities || []);
      } else if (item.type === "code") {
        const blocks = tokenizeCode(item.code, item.language);
        submessages.push({
          messageType: 5,
          codeMetadata: {
            codeLanguage: item.language,
            codeBlocks: blocks
          }
        });
        sections.push({
          view_model: {
            primitive: {
              language: item.language,
              code_blocks: blocks.map(b => ({
                content: b.codeContent,
                type: [ "AI_RICH_RESPONSE_CODE_HIGHLIGHT_DEFAULT", "AI_RICH_RESPONSE_CODE_HIGHLIGHT_KEYWORD", "AI_RICH_RESPONSE_CODE_HIGHLIGHT_METHOD", "AI_RICH_RESPONSE_CODE_HIGHLIGHT_STRING", "AI_RICH_RESPONSE_CODE_HIGHLIGHT_NUMBER", "AI_RICH_RESPONSE_CODE_HIGHLIGHT_COMMENT" ][b.highlightType] || "AI_RICH_RESPONSE_CODE_HIGHLIGHT_DEFAULT"
              })),
              __typename: "GenAICodeUXPrimitive"
            },
            __typename: "GenAISingleLayoutViewModel"
          }
        });
      } else if (item.type === "table") {
        const rows = item.table.map((cells, index) => ({
          isHeading: index === 0,
          items: cells
        }));
        submessages.push({
          messageType: 4,
          tableMetadata: {
            title: "",
            rows: rows
          }
        });
        sections.push({
          view_model: {
            primitive: {
              title: "",
              rows: rows.map(row => ({
                is_header: row.isHeading,
                cells: row.items,
                markdown_cells: row.items.map(cell => ({
                  text: cell
                }))
              })),
              __typename: "GenATableUXPrimitive"
            },
            __typename: "GenAISingleLayoutViewModel"
          }
        });
      } else if (item.type === "tip") {
        pushSec(item.text);
        sections.push({
          view_model: {
            primitive: {
              text: item.text,
              __typename: "GenAIMetadataTextPrimitive"
            },
            __typename: "GenAISingleLayoutViewModel"
          }
        });
      } else if (item.type === "suggest") {
        const suggest = (Array.isArray(item.suggestion) ? item.suggestion : [ item.suggestion ]).map(text => ({
          prompt_text: text,
          prompt_type: "SUGGESTED_PROMPT",
          __typename: "GenAIFollowUpSuggestionPillPrimitive"
        }));
        const type = item.layout ?? (suggest.length === 1 ? "Single" : item.scroll ? "HScroll" : "ActionRow");
        sections.push({
          __typename: "GenAIUnifiedResponseSection",
          view_model: {
            [type === "Single" ? "primitive" : "primitives"]: type === "Single" ? suggest[0] : suggest,
            __typename: `GenAI${type}LayoutViewModel`
          }
        });
      } else if (item.type === "image") {
        let url = item.image;
        if (Buffer.isBuffer(item.image)) {
          const media = await prepareWAMessageMedia({
            image: item.image
          }, {
            upload: this.#client.waUp,
            jid: "@newsletter"
          }).catch(() => null);
          url = media?.imageMessage?.url || null;
        }
        if (url) {
          submessages.push({
            messageType: 3,
            imageMetadata: {
              imageUrl: url,
              imageText: "",
              alignment: 0,
              tapLinkUrl: ""
            }
          });
          sections.push({
            view_model: {
              primitive: {
                media: {
                  url: url,
                  mime_type: "image/png"
                },
                imagine_type: "IMAGE",
                status: {
                  status: "READY"
                },
                __typename: "GenAIImaginePrimitive"
              },
              __typename: "GenAISingleLayoutViewModel"
            }
          });
        }
      }
    }
    this._links.forEach((linkField, index) => {
      const prefix = "SS_" + index;
      const url = linkField.url || "";
      const sources = linkField.sources?.length ? linkField.sources.map(s => ({
        source_type: "THIRD_PARTY",
        source_display_name: s.source_display_name || "Source",
        source_subtitle: "AI",
        source_url: s.source_url || url
      })) : [];
      pushSec(linkField.text + ` {{${prefix}}}¹{{/${prefix}}} `, [ {
        key: prefix,
        metadata: {
          reference_id: index + 1,
          reference_url: url,
          reference_title: linkField.title || "Source",
          reference_display_name: linkField.displayName || "Source",
          sources: sources,
          __typename: "GenAISearchCitationItem"
        }
      } ]);
    });
    if (this._body) {
      submessages.unshift({
        messageType: 2,
        messageText: this._body
      });
      sections.unshift({
        view_model: {
          primitive: {
            text: this._body,
            __typename: "GenAIMarkdownTextUXPrimitive"
          },
          __typename: "GenAISingleLayoutViewModel"
        }
      });
    }
    if (this._footer) {
      submessages.push({
        messageType: 2,
        messageText: this._footer
      });
      sections.push({
        view_model: {
          primitive: {
            text: this._footer,
            __typename: "GenAIMetadataTextPrimitive"
          },
          __typename: "GenAISingleLayoutViewModel"
        }
      });
    }
    const contextInfo = {};
    if (forwarded) {
      contextInfo.forwardingScore = 1;
      contextInfo.isForwarded = true;
      contextInfo.forwardedAiBotMessageInfo = {
        botJid: "0@bot"
      };
      contextInfo.forwardOrigin = 4;
    }
    if (quoted) {
      contextInfo.stanzaId = quoted?.key?.id || quoted?.id;
      contextInfo.participant = quotedParticipant || quoted?.key?.participant || quoted?.key?.remoteJid;
      contextInfo.quotedType = 0;
      contextInfo.quotedMessage = typeof quoted === "object" && quoted !== null ? quoted.message ?? quoted : undefined;
    }
    Object.assign(contextInfo, this._contextInfo);
    const richResponseMessage = proto.AIRichResponseMessage.create({
      messageType: proto.AIRichResponseMessageType.AI_RICH_RESPONSE_TYPE_STANDARD,
      submessages: submessages,
      unifiedResponse: {
        data: Buffer.from(JSON.stringify({
          response_id: uuid,
          sections: sections
        }))
      },
      contextInfo: contextInfo
    });
    const message = wrapToBotForwardedMessage(richResponseMessage);
    if (this._title) message.messageContextInfo.botMetadata.messageDisclaimerText = this._title;
    message.messageContextInfo.botMetadata.botResponseId = uuid;
    Object.assign(message, this._extraPayload);
    return message;
  }
  async send(jid, {forwarded: forwarded = true, quoted: quoted, quotedParticipant: quotedParticipant, ...options} = {}) {
    const msg = await this.build({
      forwarded: forwarded,
      quoted: quoted,
      quotedParticipant: quotedParticipant,
      ...options
    });
    return await this.#client.relayMessage(jid, msg, {
      ...options
    });
  }
}

module.exports = {
  AIRich: AIRich
};