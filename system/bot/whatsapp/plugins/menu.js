const fs = require("fs");
const {version: version} = require(process.cwd() + "/package.json");

const thumbCache = new Map;

function collectCommands(usedPrefix) {
  const map = new Map;
  for (const pl of Object.values(global.plugin || {})) {
    if (!pl || !pl.help || pl.disabled || pl.before && !pl.run) continue;
    const cats = Array.isArray(pl.category) ? pl.category.flat().filter(Boolean) : pl.tags ? Array.isArray(pl.tags) ? pl.tags : [ pl.tags ] : [];
    if (!cats.length) continue;
    if (cats.some(c => String(c).toLowerCase() === "hidden")) continue;
    const helps = Array.isArray(pl.help) ? pl.help.filter(Boolean) : [ pl.help ];
    for (const cmd of helps) {
      const entry = pl.customPrefix ? cmd.replace(/^\./, "") : usedPrefix + cmd;
      for (const c of cats) {
        const key = String(c).toUpperCase();
        if (!map.has(key)) map.set(key, new Set);
        map.get(key).add(entry);
      }
    }
  }
  return map;
}

async function makeThumb(sock, url) {
  try {
    if (thumbCache.has(url)) return thumbCache.get(url);
    const buffer = await sock.resize(url, 300, 200);
    if (buffer) thumbCache.set(url, buffer);
    return buffer;
  } catch (e) {
    return null;
  }
}

module.exports = {
  help: [ "menu", "help" ],
  command: [ "menu", "help" ],
  run: async (m, {sock: sock, usedPrefix: usedPrefix, args: args}) => {
    const categoryMap = collectCommands(usedPrefix);
    const flamingBase = global.fla || global.settings.fla || "https://www.flamingtext.com/net-fu/proxy_form.cgi?&imageoutput=true&script=sketch-name&doScale=true&scaleWidth=800&scaleHeight=500&fontsize=100&fillTextType=1&fillTextPattern=Warning!&fillColor1Color=%23b5b5b5&fillColor2Color=%23b5b5b5&fillColor3Color=%23b5b5b5&fillColor4Color=%23b5b5b5&fillColor5Color=%23b5b5b5&fillColor6Color=%23b5b5b5&fillColor7Color=%23b5b5b5&fillColor8Color=%23b5b5b5&fillColor9Color=%23b5b5b5&fillColor10Color=%23b5b5b5&fillOutlineColor=%23888888&fillOutline2Color=%23888888&backgroundColor=%23101820&text=";
    const thumbmain = await makeThumb(sock, flamingBase + encodeURIComponent("MENU"));
    const totalCommands = Array.from(categoryMap.values()).reduce((a, b) => a + b.size, 0);
    const info = [ "*S Y S T E M  - S T A T U S*", `_Version_    : *v${version}*`, `_Uptime_     : *${process.uptime().toFixed(0)}s*`, `_Users_      : *${Object.keys(db.data.users).length}*`, `_Chats_      : *${Object.keys(db.data.chats).length}*`, `_Commands_   : *${totalCommands}*`, `_User_       : @${m.sender.split("@")[0]}` ].join("\n");
    const quoted = {
      quoted: m
    };
    if (args.length) {
      const key = args[0].toLowerCase();
      if (key === "all") {
        const allCmds = Array.from(categoryMap.values()).flatMap(cmds => Array.from(cmds)).sort().map(c => `• \`${c}\``).join("\n");
        const thumbAll = await makeThumb(sock, flamingBase + encodeURIComponent("ALL FEATURES"));
        return sock.sendMessage(m.chat, {
          location: {
            name: "Akano Interactive",
            address: "Simple WhatsApp Bot",
            jpegThumbnail: thumbAll
          },
          caption: `*[ ALL FEATURES ]*\n${allCmds}`,
          footer: "Simple WhatsApp Bot",
          mentions: [ m.sender ],
          nativeFlow: [ {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "Menu",
              id: ".menu"
            })
          }, {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "Donation",
              id: ".donation"
            })
          } ],
          interactiveAsTemplate: false
        }, quoted);
      }
      const keyUpper = Array.from(categoryMap.keys()).find(k => k.toLowerCase() === key);
      if (!keyUpper) return;
      const thumb = await makeThumb(sock, flamingBase + encodeURIComponent(keyUpper));
      const cmds = Array.from(categoryMap.get(keyUpper)).sort().map(c => `• \`${c}\``).join("\n");
      return sock.sendMessage(m.chat, {
        location: {
          name: "Akano Interactive",
          address: "Simple WhatsApp Bot",
          jpegThumbnail: thumb
        },
        caption: `*[ ${keyUpper} ]*\n${cmds}`,
        footer: "Simple WhatsApp Bot",
        mentions: [ m.sender ],
        nativeFlow: [ {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "Menu",
            id: ".menu"
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "All",
            id: ".menu all"
          })
        } ],
        interactiveAsTemplate: false
      }, quoted);
    }
    const rows = Array.from(categoryMap.keys()).sort().map(cat => ({
      title: cat.charAt(0) + cat.slice(1).toLowerCase(),
      description: `Show ${categoryMap.get(cat).size} commands`,
      id: `.menu ${cat.toLowerCase()}`
    }));
    const allCommands = Array.from(categoryMap.values()).flatMap(cmds => Array.from(cmds));
    rows.unshift({
      title: "All Features",
      description: `Display all ${allCommands.length} commands`,
      id: ".menu all"
    });
    await sock.sendMessage(m.chat, {
      location: {
        name: "Akano Interactive",
        address: "Simple WhatsApp Bot",
        jpegThumbnail: thumbmain
      },
      caption: info,
      footer: "Simple WhatsApp Bot",
      mentions: [ m.sender ],
      nativeFlow: [ {
        name: "cta_url",
        buttonParamsJson: JSON.stringify({
          display_text: "+ Owner",
          url: "https://wa.me/" + (global.owner && global.owner[0] ? global.owner[0] : "628123456789"),
          merchant_url: ""
        })
      }, {
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "Select Menu",
          sections: [ {
            title: "Commands",
            highlight_label: "✨ All Features",
            rows: rows
          } ]
        })
      } ],
      interactiveAsTemplate: false
    }, quoted);
  }
};