<div align="center">

# AKANO-BOT

<img src="https://files.catbox.moe/aonira.jpg" alt="Akano Bot Logo" width="200"/>

_A powerful WhatsApp Bot with extensive features and customization options_

</div>

---

## System Requirements

[![Server](https://img.shields.io/badge/Server-1%20vCPU%20%7C%201GB%20RAM-ff69b4?style=flat)](https://cloud.google.com/)
[![FFMPEG](https://img.shields.io/badge/FFMPEG-Required-ff69b4?style=flat)](https://ffmpeg.org/)
[![WhatsApp](https://img.shields.io/badge/WhatsApp-Required-ff69b4?style=flat&logo=whatsapp)](https://www.whatsapp.com/)

## Configuration

<details>
<summary><b>View Configuration Options</b></summary>

````javascript
global.owner = ["628xxxxxxx"]; // Your WhatsApp number

global.settings = {
  cover: "https://file/path.jpg", // Custom cover image
  footer: "Akano Bot WhatsApp", // Message footer

  packname: { name: "Akano", author: "Canzy" }, // Sticker branding

  version: require(process.cwd() + "/package.json").version, // Bot version

  message: {
    wait: "```Processing...```",
    errorF: "Feature temporarily unavailable due to technical issues",
    admin: "Admin-only feature",
    owner: "Owner-only feature",
    premium: "Premium users only",
    group: "Group-only feature",
    private: "Private chat only",
    botadmin: "Bot needs admin privileges",
  },

  dataname: "database.json", // Database filename
  sessions: "sessions", // Session storage
  sessionbot: "system/jadibot", // Bot clone sessions
  max_uploud: 50, // Max file upload size (MB)
  dot: "◦", // List marker

  sockection: {
    code_pairing: "AKANOBOT", // Pairing code
    use_pairing: true, // Enable pairing
    browser: "opera", // Browser signature
  },

  opts: {
    autoRead: true, // Auto-read messages
    selfMode: false, // Self-mode
    dmOnly: false, // DM-only mode
    groupOnly: false, // Group-only mode
    statusOnly: false, // Status-only mode
    queque: true, // Message queue
    multiprefix: true, // Multiple command prefixes
    noprefix: false, // No-prefix mode
  },
};
````

</details>

## Database

[![Database](https://img.shields.io/badge/Database-Lowdb-ff69b4?style=flat&logo=json)](https://github.com/typicode/lowdb)

| Feature      | Description                           |
| ------------ | ------------------------------------- |
| Access Speed | Quick data access and retrieval       |
| Backup       | Easy backup and restore functionality |
| Persistence  | Reliable data persistence             |
| Structure    | Simple and intuitive data structure   |

## Plugin Development

<details>
<summary><b>Standard Plugin Format</b></summary>

**Method 1:**

```javascript
let handler = async (m, { sock, usedPrefix, command, args, text, isOwner }) => {
  // Your code here
  sock.reply(m.chat, `Command *${command}* received!`, m);
};

handler.command = Array | String; // Command trigger
handler.help = Array | String; // Help text
handler.example = String; // Usage example
handler.wait = Boolean; // Show wait message
handler.owner = Boolean; // Owner-only
handler.rowner = Boolean; // Real owner only
handler.group = Boolean; // Group-only
handler.private = Boolean; // Private chat only
handler.botAdmin = Boolean; // Requires bot admin
handler.premium = Boolean; // Premium users only
handler.admin = Boolean; // Admin-only
handler.error = Boolean; // Error tracking
handler.customPrefix = String; // Custom prefix
```

**Method 2:**

```javascript
module.exports = {
   run: async (m, { sock }) => {
      m.reply("Hi, I'm Akano Bot! :3")
   },
   command: Array|String // Command trigger
   help: Array|String // Help text
   example: String // Usage example
   wait: Boolean // Show wait message
   owner: Boolean // Owner-only
   rowner: Boolean // Real owner only
   group: Boolean // Group-only
   private: Boolean // Private chat only
   botAdmin: Boolean // Requires bot admin
   premium: Boolean // Premium users only
   admin: Boolean // Admin-only
   error: Boolean // Error tracking
   customPrefix: String // Custom prefix
}
```

**Other** :

```Javascript
async run(m, { match, usedPrefix, noPrefix, args, command, text, participants, groupMetadata, user, bot, isROwner, isOwner, isRAdmin, isAdmin, isBotAdmin, isPrems, isBans, chatUpdate })
```

### Event Handler Format

**Method 1:**

```javascript
let handler = (m) => m;
handler.before = async (m, { sock }) => {
  sock.reply(m.chat, `Event detected!`, m);
  return true;
};
module.exports = handler;
```

**Method 2:**

```javascript
module.exports = {
  async before(m, { sock }) {
    sock.reply(m.chat, `Event detected!`, m);
    return true;
  },
};
```

**Other** :

```Javascript
async before(m, { match, participants, groupMetadata, user, bot, isROwner, isOwner, isRAdmin, isAdmin, isBotAdmin, isPrems, isBans, chatUpdate })
```

</details>

## Scraper Integration

[![Integration](https://img.shields.io/badge/Module%20System-Dynamic-ff69b4?style=flat)]()

> The bot utilizes a dynamic module scraper for real-time plugin management, enabling hot-reloading of features without restarting.

## Installation

<details>
<summary><b>Standard Installation</b></summary>

```bash
git clone https://github.com/kutashiakano/Akano-Bot
cd Akano-Bot
npm install #--no-bin-links
npm start
```

</details>

<details>
<summary><b>PM2 Installation</b></summary>

```bash
npm install pm2 -g
npm install
pm2 start index.js && pm2 save && pm2 logs
```

</details>

## Notes

[![Status](https://img.shields.io/badge/Development%20Phase-Alpha-ff69b4?style=flat)]()

Saat ini, Akano-Bot masih dalam tahap pengembangan. Fitur-fitur yang tersedia masih terbatas dan akan terus dikembangkan. Jika menemukan error atau bug, silakan hubungi [Admin](https://wa.me/6285150857272) untuk bantuan lebih lanjut.

---
## Credits

> Thanks to the following projects:

- **[Scraper From NekoBot](https://github.com/AxellNetwork/NekoBot/tree/master/scrapers)**  
  (Scraper source from NekoBot)
- **[Base From KaguyaBot](https://github.com/LT-SYAII/KaguyaBot)**  
  (Main foundation from KaguyaBot)
- **[Scraper From myScraper](https://github.com/SxyzAnother/myScraper)**  
  (Additional scraper to enhance features)

Thanks to all contributors who made this possible.
---
<div align="center">

[![Love](https://img.shields.io/badge/Built_with_♥︎-ff69b4?style=for-the-badge)](https://github.com/kutashiakano)
[![Powered](https://img.shields.io/badge/Powered_by-NodeJS_18-ff69b4?style=for-the-badge&logo=node.js)](https://nodejs.org/)

&copy; 2025 Canzy. All rights reserved.

</div>
