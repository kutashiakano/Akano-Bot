require("../settings");
const simple = require("../lib/simple.js");
const util = require("util");
const moment = require("moment-timezone");
const fs = require("fs");
const fetch = require("node-fetch");
const chalk = require("chalk");
const {
	jidNormalizedUser
} = require("baileys");

module.exports = {
	async handler(chatUpdate) {
		if (global.db.data == null) await global.loadDatabase();
		this.msgqueque = this.msgqueque || [];

		let m = chatUpdate.messages[chatUpdate.messages.length - 1];
		if (!m) return;
		if (m.message?.viewOnceMessageV2)
			m.message = m.message.viewOnceMessageV2.message;
		if (m.message?.documentWithCaptionMessage)
			m.message = m.message.documentWithCaptionMessage.message;
		if (m.message?.viewOnceMessageV2Extension)
			m.message = m.message.viewOnceMessageV2Extension.message;
		if (!m) return;

		try {
			m = simple.smsg(this, m) || m;
			if (!m) return;
			m.exp = 0;
			m.limit = false;

			try {
				require("../lib/database.js")(m);
			} catch (e) {
				console.error(e);
			}

			const isNewsletter = m.sender && m.sender.endsWith('@newsletter');
			if (isNewsletter) return;

			const isROwner = [
				sock.decodeJid(global.sock.user.id),
				...global.owner.map((a) => a + "@s.whatsapp.net"),
			].includes(m.sender);
			const isOwner = isROwner || m.fromMe;
			const isMods = global.db.data.users[m.sender]?.moderator || false;
			const isPrems = global.db.data.users[m.sender]?.premium || false;
			const isBans = global.db.data.users[m.sender]?.banned || false;

			if (m.isGroup) {
				let member = (
					await store.fetchGroupMetadata(m.chat, sock)
				).participants.map((a) => a.id);
				db.data.chats[m.chat].member = member;
				db.data.chats[m.chat].chat += 1;
			}

			if (isROwner) {
				db.data.users[m.sender].premium = true;
				db.data.users[m.sender].limit = "PERMANENT";
				db.data.users[m.sender].moderator = true;
			} else if (isPrems) {
				db.data.users[m.sender].limit = "PERMANENT";
			} else if (!isROwner && isBans) return;

			if (global.settings.opts.queque && m.text && !(isMods || isPrems)) {
				let queque = this.msgqueque,
					time = 1000 * 5;
				const previousID = queque[queque.length - 1];
				queque.push(m.id || m.key.id);
				setInterval(async function() {
					if (queque.indexOf(previousID) === -1) clearInterval(this);
					else await sock.delay(time);
				}, time);
			}

			db.data.users[m.sender].online = Date.now();
			db.data.users[m.sender].hit += 1;
			if (opts["autoRead"]) await this.readMessages([m.key]);

			if (!m.fromMe && !isOwner && !isPrems && !isMods && opts["selfMode"])
				return;
			if (opts["dmOnly"] && m.chat.endsWith("g.us")) return;
			if (opts["statusOnly"] && m.chat !== "status@broadcast") return;

			if (typeof m.text !== "string") m.text = "";
			if (m.isBaileys) return;
			m.exp += Math.ceil(Math.random() * 1000);

			let usedPrefix;
			const groupMetadata = m.isGroup ? await store.fetchGroupMetadata(m.chat, this) : {};
			const participants = (m.isGroup ? groupMetadata.participants : []) || [];
			const user = (m.isGroup ? participants.find((u) => sock.decodeJid(u.id) === m.sender) : {}) || {};
			const bot = (m.isGroup ? participants.find((u) => sock.decodeJid(u.id) == this.user.jid) : {}) || {};
			const isRAdmin = (user && user.admin == "superadmin") || false;
			const isAdmin = isRAdmin || (user && user.admin == "admin") || false;
			const isBotAdmin = (bot && bot.admin) || false;

			let isCommand = false;
			for (let name in global.plugin) {
				let plugins = global.plugin[name];
				if (!plugins) continue;

				if (typeof plugins === "function") {
					plugins = {
						run: plugins,
						command: plugins.command || [],
						help: plugins.help || [],
						example: plugins.example || "",
						wait: plugins.wait || false,
						owner: plugins.owner || false,
						rowner: plugins.rowner || false,
						group: plugins.group || false,
						private: plugins.private || false,
						botAdmin: plugins.botAdmin || false,
						premium: plugins.premium || false,
						admin: plugins.admin || false,
						error: plugins.error || 0,
						before: plugins.before,
						customPrefix: plugins.customPrefix || null,
					};
				}

				const str2Regex = (str) => str.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&");
				let _prefix = plugins.customPrefix ?
					plugins.customPrefix :
					sock.prefix ?
					sock.prefix :
					global.prefix;

				let match = (
					_prefix instanceof RegExp ? [
						[_prefix.exec(m.text), _prefix]
					] :
					Array.isArray(_prefix) ?
					_prefix.map((p) => {
						let re = p instanceof RegExp ? p : new RegExp(str2Regex(p));
						return [re.exec(m.text), re];
					}) :
					typeof _prefix === "string" ? [
						[
							new RegExp(str2Regex(_prefix)).exec(m.text),
							new RegExp(str2Regex(_prefix)),
						],
					] : [
						[
							[], new RegExp()
						]
					]
				).find((p) => p[1]);

				if (!match) continue;

				if (typeof plugins.before === "function") {
					if (
						await plugins.before.call(this, m, {
							match,
							sock: this,
							participants,
							groupMetadata,
							user,
							bot,
							isROwner,
							isOwner,
							isRAdmin,
							isAdmin,
							isBotAdmin,
							isPrems,
							isBans,
							chatUpdate,
						})
					)
						continue;
				}

				if (typeof plugins.run !== "function") continue;

				if (opts && match && m) {
					let result =
						((opts?.["multiprefix"] ?? true) && (match[0] || "")[0]) ||
						((opts?.["noprefix"] ?? false) ? null : (match[0] || "")[0]);
					usedPrefix = result;
					let noPrefix = isOwner ?
						!result ?
						m.text :
						m.text.replace(result, "") :
						!result ?
						"" :
						m.text.replace(result, "").trim();

					let [command, ...args] = noPrefix.trim().split` `.filter((v) => v);
					args = args || [];
					let _args = noPrefix.trim().split` `.slice(1);
					let text = _args.join` `;
					command = (command || "").toLowerCase();

					let fail = plugins.fail || global.dfail;
					const prefixCommand = !result ?
						plugins.customPrefix || plugins.command :
						plugins.command;

					let isAccept =
						(prefixCommand instanceof RegExp && prefixCommand.test(command)) ||
						(Array.isArray(prefixCommand) &&
							prefixCommand.some((cmd) =>
								cmd instanceof RegExp ? cmd.test(command) : cmd === command,
							)) ||
						(typeof prefixCommand === "string" && prefixCommand === command);

					if (!isAccept) continue;

					isCommand = true;
					m.plugins = name;
					m.chatUpdate = chatUpdate;

					if (opts["groupOnly"] && !m.fromMe && !m.chat.endsWith("g.us")) {
						let contactOwner = owner.map((a, i) => `*• Contact ${i + 1} :* wa.me/` + a).join("\n");
						await sock.sendMessage(
							m.chat, {
								text: `We apologize, but the bot is currently only accessible within groups. If you wish to use the bot privately, please upgrade your status. If you are interested, please contact our owner below:\n${contactOwner}`,
							}, {
								quoted: m
							},
						);
						continue;
					}

					if (
						m.chat in global.db.data.chats ||
						m.sender in global.db.data.users
					) {
						let chat = global.db.data.chats[m.chat];
						let user = global.db.data.users[m.sender];

						if (
							name != "owner-unbanchat.js" &&
							chat &&
							chat.isBanned &&
							!isOwner
						)
							return;
						if (
							name != "group-unmute.js" &&
							chat &&
							chat.mute &&
							!isAdmin &&
							!isOwner
						)
							return;
					}

					if (plugins.example && command && !text) {
						let txt = plugins.example.replace("%cmd", usedPrefix + command);
						m.reply(`༚ *Example* :  ${txt}`);
						continue;
					}

					if (plugins.error >= 5) {
						db.data.settings.blockcmd.push(command);
						m.reply(settings.message.errorF);
						continue;
					}

					if (plugins.group && !m.isGroup) {
						m.reply(settings.message.group);
						continue;
					}

					if (plugins.admin && !isAdmin) {
						m.reply(settings.message.admin);
						continue;
					}

					if (plugins.owner && !isOwner) {
						m.reply(settings.message.owner);
						continue;
					}

					if (plugins.rowner && !isROwner) {
						m.reply(settings.message.owner);
						continue;
					}

					if (plugins.premium && !isPrems) {
						m.reply(settings.message.premium);
						continue;
					}

					if (plugins.botAdmin && !isBotAdmin) {
						m.reply(settings.message.botadmin);
						continue;
					}

					m.isCmd = true;
					m.cmd = command;

					if (plugins.wait && m.isCmd) {
						m.react("⌛");
						m.reply(settings.message.wait);
					}

					let xp = "exp" in plugins ? parseInt(plugins.exp) : 17;
					m.exp += xp;

					if (
						(!db.data.users[m.sender].limit > 100) &
						(db.data.users[m.sender].limit < 1)
					) {
						sock.sendMessage(
							m.chat, {
								text: "Your limit has been reached. Please wait until your limit is reset.",
							}, {
								quoted: m
							},
						);
						continue;
					}

					let extra = {
						match,
						usedPrefix,
						noPrefix,
						args,
						command,
						text,
						sock: this,
						participants,
						groupMetadata,
						user,
						bot,
						isROwner,
						isOwner,
						isRAdmin,
						isAdmin,
						isBotAdmin,
						isPrems,
						isBans,
						chatUpdate,
					};

					try {
						await plugins.run.call(this, m, extra);
						if (!isPrems) m.limit = m.limit || plugins.limit || true;
					} catch (e) {
						m.error = e;
						console.error("Error", e);
						if (e) {
							let text = util.format(e);
							sock.logger.error(text);
							if (text.match("rate-overlimit")) return;
							if (e.name) {
								for (let jid of global.owner) {
									let data = (await sock.onWhatsApp(jid))[0] || {};
									if (data.exists) {
										this.reply(
											data.jid,
											`> *[ ERROR DETECTED ]*\n\n* Feature: ${m.cmd}\n* Sender: ${m.name} ${m.isGroup ? `[ Group: ${await sock.getName(m.chat)} ]` : ""}\n\n+ \`ERROR LOG\`\n${text}`.trim(),
											null,
										);
									}
								}
								plugins.error += 1;
								m.reply(
									`> *System Detected an Error* in this Feature\n\nA notification has been sent to the bot owner's number. If this feature encounters an error *5 times*, it will be automatically disabled!`,
								);
							}
							m.reply(e);
						}
					} finally {}
					break;
				}
			}

			if (!isCommand && m.isGroup) return;
		} catch (e) {
			console.log(chalk.red.bold(e));
		} finally {
			if (opts["queque"] && m.text) {
				const quequeIndex = this.msgqueque.indexOf(m.id || m.key.id);
				if (quequeIndex !== -1) this.msgqueque.splice(quequeIndex, 1);
			}

			let user;
			let stats = global.db.data.stats;
			if (m) {
				if (m.sender && (user = global.db.data.users[m.sender])) {
					user.exp += m.exp;
					user.limit -= m.limit * 1;
				}
			}

			try {
				require("../lib/print.js")(m, this, chatUpdate);
			} catch (e) {
				console.log(m, m.quoted, e);
			}

			await this.chatRead(
				m.chat,
				m.isGroup ? m.sender : undefined,
				m.id || m.key.id,
			).catch(() => {});
		}
	},

	async participantsUpdate({
		id,
		author,
		participants,
		action
	}) {
		if (opts["selfMode"]) return;
		if (global.isInit) return;

		let chat = global.db.data.chats[id] || {};
		let metadata = store.groupMetadata[id] || await store.fetchGroupMetadata(id, this);
		let text = "";

		switch (action) {
			case "add":
			case "remove":
				if (action === "add") {
					metadata.participants.push(
						...participants.map((sender) => ({
							id: jidNormalizedUser(sender),
							admin: null,
						})),
					);
				} else if (action === "remove") {
					metadata.participants = metadata.participants.filter(
						(p) => !participants.includes(jidNormalizedUser(p.id)),
					);
				}

				if (chat.welcome) {
					for (let user of participants) {
						let check = author !== user && author.length > 1;
						let reasn = check ?
							`di ${action === "add" ? "tambahkan" : "keluarkan"} oleh @${author.split("@")[0]}` :
							`${action === "add" ? "Bergabung ke dalam" : "Keluar dari"} group`;
						let pp = "https://i.ibb.co/sQTkHLD/ppkosong.png";
						let name = await this.getName(user);
						let gpname = await this.getName(id);

						try {
							pp = await this.profilePictureUrl(user, "image");
						} catch (e) {}

						text =
							action === "add" ?
							db.data.chats[id].welcome
							.replace("%member", "@" + user.split("@")[0])
							.replace("%subject", gpname)
							.replace("%reason", reasn)
							.replace("%time", moment.tz("Asia/Jakarta").format("HH:mm")) :
							global.db.data.chats[id].leave
							.replace("%member", "@" + user.split("@")[0])
							.replace("%subject", gpname)
							.replace("%reason", reasn)
							.replace(
								"%time",
								moment.tz("Asia/Jakarta").format("HH:mm"),
							);

						await sock.sendMessageModify(
							id,
							text,
							null, {
								thumbnail: await Buffer.from(
									(await sock.getFile(pp)).data
								),
								body: action === 'add' ? 'Hewwo~ welcome in, cutie!' : 'Nooo don’t gooo~',
								title: "📍Group Notification",
								largeThumb: false,
								isForwarded: true
							}
						);
					}
				}
				break;

			case "promote":
			case "demote":
				for (const participant of metadata.participants) {
					let mem = jidNormalizedUser(participant.id);
					if (participants.includes(mem)) {
						participant.admin = action === "promote" ? "admin" : null;
					}
				}
				break;
		}
	},
};

let file = require.resolve(__filename);
fs.watchFile(file, () => {
	fs.unwatchFile(file);
	console.log(chalk.redBright("Update : ") + chalk.yellow.bold(file));
	delete require.cache[file];
});