<div align="center">

AKANO-BOT
<img src="https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExY2xlZ3o5aTFmM3Y2ZGw5OGs2N2V2a3V2NmRrbjZsdWp5a3c4dGZuNiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/xT9IgzoKnwFNmISR8I/giphy.gif" alt="Akano Bot Logo" width="200"/>

A powerful WhatsApp Bot with extensive features and customization options
</div>

System Requirements
![Server](https://img.shields.io/badge/Server-1%20vCPU%20%7C%201GB%20RAM-ff69b4?style=flat)
![FFMPEG](https://img.shields.io/badge/FFMPEG-Required-ff69b4?style=flat)
![WhatsApp](https://img.shields.io/badge/WhatsApp-Required-ff69b4?style=flat&logo=whatsapp)
Features
Dynamic Plugin System: Hot-reload plugins tanpa restart bot!
Auto-Download Status WhatsApp: Status otomatis tersimpan saat ada upload baru (bot harus aktif).
Cute Theme: Desain dan pesan dengan nuansa imut dan ramah :3.
Customizable Settings: Sesuaikan bot sesuai kebutuhanmu.
Catatan: Fitur saat ini masih terbatas karena ini base bot mentahan dari Alis. Keunggulan utama ada pada fleksibilitas dan fitur status otomatis!
Configuration
<details>
<summary><b>Lihat Opsi Konfigurasi</b></summary>

javascript
global.owner = ["628xxxxxxx"]; // Nomor WhatsApp kamu

global.settings = {
  cover: "https://file/path.jpg", // Gambar cover custom
  footer: "Akano Bot WhatsApp", // Footer pesan

  packname: { name: "Akano", author: "Canzy" }, // Branding stiker

  version: require(process.cwd() + "/package.json").version, // Versi bot

  message: {
    wait: "```Tunggu bentar ya...```",
    errorF: "Fitur lagi bermasalah, sabar ya!",
    admin: "Hanya untuk admin nih",
    owner: "Khusus owner aja",
    premium: "Buat pengguna premium",
    group: "Cuma di grup",
    private: "Hanya di chat pribadi",
    botadmin: "Bot butuh jadi admin dulu",
  },

  dataname: "database.json", // Nama file database
  sessions: "sessions", // Penyimpanan sesi
  sessionbot: "system/jadibot", // Sesi klon bot
  max_uploud: 50, // Batas ukuran upload (MB)
  dot: "◦", // Penanda daftar
  reactSW: true, // Status reaksi aktif
  emojis: ["❤️", "💛", "💚", "💙", "💜"], // Emot untuk reaksi

  sockection: {
    code_pairing: "AKANOBOT", // Kode pairing
    use_pairing: true, // Aktifkan pairing
    browser: "opera", // Tanda browser
  },

  opts: {
    autoRead: true, // Baca pesan otomatis
    selfMode: false, // Mode sendiri
    dmOnly: false, // Hanya DM
    groupOnly: false, // Hanya grup
    statusOnly: false, // Hanya status
    queque: true, // Antrian pesan
    multiprefix: true, // Multi prefix perintah
    noprefix: false, // Mode tanpa prefix
  },
};
</details>

Plugin Development
<details>
<summary><b>Format Plugin Standar</b></summary>

Cara 1:
javascript
let handler = async (m, { sock, usedPrefix, command, args, text, isOwner }) => {
  m.reply("Hai, aku Akano Bot! :3");
};

handler.command = Array | String; // Pemicu perintah
handler.help = Array | String; // Teks bantuan
handler.example = String; // Contoh penggunaan
handler.wait = Boolean; // Tampilkan pesan tunggu
handler.owner = Boolean; // Khusus owner
handler.rowner = Boolean; // Hanya owner asli
handler.group = Boolean; // Hanya grup
handler.private = Boolean; // Hanya chat pribadi
handler.botAdmin = Boolean; // Butuh admin bot
handler.premium = Boolean; // Khusus premium
handler.admin = Boolean; // Hanya admin
handler.error = Boolean; // Lacak error
handler.customPrefix = String; // Prefix custom
Cara 2:
javascript
module.exports = {
   run: async (m, { sock }) => {
      m.reply("Hai, aku Akano Bot! :3");
   },
   command: Array | String // Pemicu perintah
   help: Array | String // Teks bantuan
   example: String // Contoh penggunaan
   wait: Boolean // Tampilkan pesan tunggu
   owner: Boolean // Khusus owner
   rowner: Boolean // Hanya owner asli
   group: Boolean // Hanya grup
   private: Boolean // Hanya chat pribadi
   botAdmin: Boolean // Butuh admin bot
   premium: Boolean // Khusus premium
   admin: Boolean // Hanya admin
   error: Boolean // Lacak error
   customPrefix: String // Prefix custom
};
</details>

Scraper Integration
![Integration](https://img.shields.io/badge/Module%20System-Dynamic-ff69b4?style=flat) 
Bot ini pakai scraper modul dinamis untuk kelola plugin secara real-time, jadi bisa reload fitur tanpa matiin bot :3.
Installation
<details>
<summary><b>Instalasi Standar</b></summary>

bash
git clone https://github.com/kutashiakano/Akano-Bot
cd Akano-Bot
npm install #--no-bin-links
npm start
</details>

<details>
<summary><b>Instalasi dengan PM2</b></summary>

bash
npm install pm2 -g
npm install
pm2 start index.js && pm2 save && pm2 logs
</details>

Notes
![Status](https://img.shields.io/badge/Development%20Phase-Alpha-ff69b4?style=flat) 
Saat ini, Akano-Bot masih dalam tahap pengembangan. Fitur yang ada masih sedikit karena ini base mentahan dari Alis, tapi akan terus diperbarui. Kalau ada error atau bug, hubungi Admin ya :3.
Credits
Terima kasih buat proyek berikut:
Scraper From NekoBot
(Sumber scraper dari NekoBot)
Base From KaguyaBot
(Dasar utama dari KaguyaBot)
Scraper From myScraper
(Scraper tambahan untuk fitur lebih baik)
Terima kasih juga buat semua kontributor yang bikin ini jadi mungkin :3.
<div align="center">

![Love](https://img.shields.io/badge/Built_with_Love-ff69b4?style=for-the-badge)
![Powered](https://img.shields.io/badge/Powered_by-NodeJS_18-ff69b4?style=for-the-badge&logo=node.js)
© 2025 Canzy. All rights reserved.
</div>