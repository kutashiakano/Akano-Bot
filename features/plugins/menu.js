const {
	version
} = require(process.cwd() + "/package.json");
const moment = require("moment-timezone");

module.exports = {
	help: ["menu", "help"],
	command: ["menu", "help"],
	run: async (m, {
		sock,
		usedPrefix
	}) => {
		const commandRegistry = {};
		const categoryMap = new Map();

		Object.entries(plugin)
			.filter(
				([, plugin]) =>
				plugin.help && !(plugin.disabled || (plugin.before && !plugin.run)),
			)
			.forEach(([, plugin]) => {
				const commandCategories = Array.isArray(plugin.category) ?
					plugin.category.flat().filter(Boolean) :
					plugin.tags ?
					Array.isArray(plugin.tags) ?
					plugin.tags :
					[plugin.tags] :
					[];
				const commandHelps = Array.isArray(plugin.help) ?
					plugin.help.filter(Boolean) :
					[plugin.help];

				commandHelps.forEach((helpCmd) => {
					const premiumBadge = plugin.premium ? " [PREMIUM]" : "";
					const commandEntry = plugin.customPrefix ?
						`${helpCmd.replace(/^\./, "")}${premiumBadge}` :
						`${usedPrefix}${helpCmd}${premiumBadge}`;

					commandCategories.forEach((rawCategory) => {
						if (!rawCategory) return;
						const category = String(rawCategory).toUpperCase();
						if (!categoryMap.has(category))
							categoryMap.set(category, new Set());
						categoryMap.get(category).add(commandEntry);
						commandRegistry[helpCmd] = {
							category: category,
							premium: !!plugin.premium,
						};
					});
				});
			});

		const systemInfo = [
			`╭◦ S Y S T E M  - S T A T U S`,
			`│◦ Version    : v${version}`,
			`│◦ Uptime     : ${process.uptime().toFixed(0)}s`,
			`│◦ Users      : ${Object.keys(db.data.users).length}`,
			`│◦ Chats      : ${Object.keys(db.data.chats).length}`,
			`│◦ Commands   : ${Array.from(categoryMap.values()).reduce((a, b) => a + b.size, 0)}`,
			`└◦ User: @${m.sender.split("@")[0]}\n`,
		].join("\n");

		const categorySections = Array.from(categoryMap.entries())
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([category, commands]) => {
				const sortedCommands = Array.from(commands).sort();
				return `┏ \`${category}\`\n${sortedCommands
      .map((cmd, i, arr) => `${i === arr.length - 1 ? "╰◦" : "│◦"} ${cmd}`)
      .join("\n")}`;
			})
			.join("\n\n");

		await sock.sendMessageModify(
			m.chat,
			`${systemInfo}\n${categorySections}`,
			m, {
				thumbnail: await Buffer.from(
					(await sock.getFile("https://files.catbox.moe/0eklgs.jpg")).data,
				),
				body: `Runtime: ${moment().format("DD/MM/YYYY HH:mm:ss")}`,
				title: "Command Interface System",
				largeThumb: false,
				ads: true
			},
		);
	},
};
