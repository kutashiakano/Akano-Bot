const {
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    Browsers
} = require('baileys');
const NodeCache = require('node-cache');
const crypto = require('crypto');
const fs = require("fs");
const pino = require('pino');
const {
    makeWASocket
} = require('../../../lib/simple.js');

if (!global.socks) global.socks = [];

let handler = async (m, { sock, args, usedPrefix, command }) => {
    let __sock = args[0] && args[0] == 'plz' ? sock : await global.sock
    if (!((args[0] && args[0] == 'plz') || (await global.sock).user.jid == sock.user.jid)) {
        return m.reply(`Perintah ini hanya bisa digunakan di bot utama! wa.me/${global.sock.user.jid.split`@`[0]}?text=${usedPrefix}codebot`)
    }

    async function initializeBot() {
        let authFolderB = crypto.randomBytes(10).toString('hex').slice(0, 8)
        const sessionPath = `./${settings.sessionbot}/${authFolderB}`;
        if (!fs.existsSync(sessionPath)) {
            fs.mkdirSync(sessionPath, { recursive: true });
        }

        args[0] ? fs.writeFileSync(sessionPath + "/creds.json", JSON.stringify(JSON.parse(Buffer.from(args[0], "base64").toString("utf-8")), null, '\t')) : ""

        const { state, saveCreds } = await useMultiFileAuthState(sessionPath)
        
        const msgRetryCounterCache = new NodeCache()
        const { version } = await fetchLatestBaileysVersion();
        
        let phoneNumber = m.sender.split('@')[0]

        const connectionOptions = {
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            browser: Browsers.windows('Safari'),
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
            },
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: true,
            msgRetryCounterCache,
            defaultQueryTimeoutMs: undefined,
            version
        }

        let sock = makeWASocket(connectionOptions)

        if (!sock.authState.creds.registered) {
            if (!phoneNumber) {
                process.exit(0);
            }
            let cleanedNumber = phoneNumber.replace(/[^0-9]/g, '');
            if (cleanedNumber.length < 10) {
                process.exit(0);
            }

            setTimeout(async () => {
            	let randomPairing = Array.from({ length: 8 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)]).join('');
                let codeBot = await sock.requestPairingCode(cleanedNumber, randomPairing);
                codeBot = codeBot?.match(/.{1,4}/g)?.join("-") || codeBot;
                let txt = `*WhatsApp Pairing Code* \n\n\`Pairing Code: ${codeBot}\` \n\n*Connection Steps:* \n- Step 1: Open WhatsApp \n- Step 2: Tap "Linked Devices" \n- Step 3: Select "Link a Device" \n- Step 4: Enter Pairing Code \n\n*Expires in 20 seconds* \n\n*Note:* Keep this code confidential.`;
                await __sock.reply(m.chat, txt, m);
            }, 3000);
        }

        sock.isInit = false;
        let isInit = true;

        async function connectionUpdate(update) {
            const { connection, lastDisconnect, isNewLogin } = update
            
            if (isNewLogin) sock.isInit = true
            
            const code = lastDisconnect?.error?.output?.statusCode;
            if (code && code !== DisconnectReason.loggedOut && sock?.ws.socket == null) {
                let i = global.socks.indexOf(sock)
                if (i < 0) return console.log(await setupEvents(true).catch(console.error))
                delete global.socks[i]
                global.socks.splice(i, 1)
            }

            if (connection == 'open') {
                sock.isInit = true
                sock.connectTime = new Date()
                sock.authFolder = authFolderB
                global.socks.push(sock)
                await __sock.reply(m.chat, 'Successfully connected to WhatsApp', m)
            }
        }

        let handler = require('../../handler.js')
        let setupEvents = async function(restartConn) {
            if (restartConn) {
                try { sock.ws.close() } catch {}
                sock.ev.removeAllListeners()
                sock = makeWASocket(connectionOptions)
                isInit = true
            }

            if (!isInit) {
                sock.ev.off('messages.upsert', sock.handler)
                sock.ev.off('connection.update', sock.connectionUpdate)
                sock.ev.off('creds.update', sock.credsUpdate)
            }

            sock.handler = handler.handler.bind(sock)
            sock.connectionUpdate = connectionUpdate.bind(sock)
            sock.credsUpdate = saveCreds.bind(sock, true)

            sock.ev.on('messages.upsert', sock.handler)
            sock.ev.on('connection.update', sock.connectionUpdate)
            sock.ev.on('creds.update', sock.credsUpdate)
            
            isInit = false
            return true
        }
        
        setupEvents(false)
    }
    initializeBot()
}

handler.help = handler.command = ['jadibot'];
handler.tags = ['subbot'];
handler.private = true;

module.exports = handler;