const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ActivityType } = require("discord.js");
const database = require("../../database");

module.exports = {
  setup(client) {
    client.once("clientReady", async () => {
      try {
        global.discord = client;

        const commandsData = Object.values(global.discordCommands)
          .filter((cmd) => cmd && cmd.name && cmd.execute && Array.isArray(cmd.options))
          .map((cmd) => ({
            name: cmd.name,
            description: cmd.description,
            options: cmd.options || [],
          }));

        if (commandsData.length > 0) {
          await client.application.commands.set(commandsData);
        }

        try {
          const engine = require("./plugins/music/engine");
          await engine.rstSessions(client);
        } catch (e) {
          global.logError("discord.rstSessions", e);
        }

        const db = database.get();
        const presence = db.settings?.discord?.presence || {};
        global.discord.user.setPresence({
          activities: [
            {
              name: presence.name || global.settings?.discord?.presence?.name || global.botname,
              type:
                ActivityType[presence.type || global.settings?.discord?.presence?.type || "Custom"],
              state: presence.state || global.settings?.discord?.presence?.state || "Bot Active",
            },
          ],
          status: presence.status || global.settings?.discord?.presence?.status || "online",
        });
      } catch (error) {
        global.logError("discord.clientReady", error);
      }
    });

    client.on("interactionCreate", async (interaction) => {
      try {
        require("fs").appendFileSync(
          process.env.HOME + "/.akano-debughandler.log",
          JSON.stringify({
            ts: new Date().toISOString(),
            uid: interaction.user?.id || null,
            type: interaction.type,
            name: interaction.commandName || null,
            isChat: interaction.isChatInputCommand(),
            found: !!global.discordCommands[interaction.commandName || ""],
          }) + "\n"
        );
      } catch {}
      try {
        await require("../print")({ type: "discord", interaction });
      } catch (e) {}

      if (interaction.isAutocomplete()) {
        const command = global.discordCommands[interaction.commandName];
        const focused = interaction.options.getFocused(true);
        if (command && typeof command.autocomplete === "function") {
          try {
            await command.autocomplete(interaction, focused);
          } catch (e) {
            try { await interaction.respond([]); } catch {}
          }
          return;
        }
        if (interaction.commandName === "p" && focused.name === "query") {
          try {
            const q = String(focused.value || "").trim();
            if (!q) {
              await interaction.respond([]).catch(() => {});
              return;
            }
            const uid = interaction.user.id;
            let session = null;
            try {
              const ys = require("../../../scrapers/src/ytsession.js");
              if (ys.has(uid)) session = await ys.getSession(uid);
            } catch {}
            let suggestions = [];
            try {
              const ytm = global.scraper?.ytmusic;
              if (ytm && typeof ytm.searchSuggestions === "function") {
                suggestions = await ytm.searchSuggestions(q, 8);
              }
            } catch {}
            if (!suggestions.length) {
              try {
                const ytm = global.scraper?.ytmusic;
                const s = session;
                const hits = await ytm.searchType(q, "song", 5, s).catch(() => []);
                suggestions = hits.map((h) => `${h.title} — ${h.artist}`);
              } catch {}
            }
            const choices = suggestions.slice(0, 25).map((s) => ({ name: String(s).slice(0, 100), value: String(s).slice(0, 100) }));
            await interaction.respond(choices).catch(() => {});
          } catch {
            try { await interaction.respond([]); } catch {}
          }
          return;
        }
        try { await interaction.respond([]); } catch {}
        return;
      }

      if (interaction.isChatInputCommand()) {
        const command = global.discordCommands[interaction.commandName];
        if (!command) return;

        if (!global.coolCache) global.coolCache = new Map();
        if (!global.limCache) global.limCache = new Map();
        const isExempt = ["settings", "status"].includes(command.name);

        if (interaction.guildId && interaction.user) {
          const uid = interaction.user.id;
          const today = new Date().toISOString().slice(0, 10);

          if (!isExempt) {
            const db = database.get();
            const banned = db.discord?.users?.[uid]?.banned;
            if (banned) {
              await interaction
                .reply({
                  content: "You have been banned for violating bot rules!",
                  flags: 64,
                })
                .catch(() => {});
              return;
            }

            const dayLimit = global.settings?.discord?.dailyLimit || 200;
            const bucket = global.limCache.get(uid);
            if (!bucket || bucket.day !== today) {
              global.limCache.set(uid, { day: today, count: 0 });
            }
            const usage = global.limCache.get(uid);
            if (usage.count >= dayLimit) {
              await interaction
                .reply({
                  content: "You have reached your daily command limit. Try again tomorrow!",
                  flags: 64,
                })
                .catch(() => {});
              return;
            }

            const cooldownKey = uid + ":" + command.name;
            const last = global.coolCache.get(cooldownKey) || 0;
            if (Date.now() - last < 3000) {
              await interaction
                .reply({ content: "Slow down! Please wait a moment before using this command again.", flags: 64 })
                .catch(() => {});
              return;
            }
            global.coolCache.set(cooldownKey, Date.now());
            usage.count += 1;
          }
        }

        try {
          const db = database.get();
          const disabled = db.settings?.disabledPlugins?.discord || [];
          if (disabled.includes(command.name)) {
            await interaction
              .reply({
                content: "Sorry, this feature is currently disabled due to an error!",
                flags: 64,
              })
              .catch(() => {});
            return;
          }
        } catch (e) {}

        const dcUserId = interaction.user?.id || "";
        const isDC = global.settings?.discord?.owner || global.dcOwner || [];
        const isDCOwner = isDC.includes(dcUserId);
        const isDCPrem = (() => {
          try {
            const db = database.get();
            if (isDCOwner) return true;
            return !!(db.discord?.users?.[dcUserId]?.premium);
          } catch {
            return false;
          }
        })();
        const isDCAdmin = (() => {
          const perms = interaction.memberPermissions;
          if (perms) return perms.has(8n);
          try {
            return interaction.member?.permissions?.has(8n) || false;
          } catch {
            return false;
          }
        })();
        const gateFail = command.owner
          ? !isDCOwner
          : command.premium
            ? !isDCPrem
            : command.admin
              ? !isDCAdmin
              : null;
        if (gateFail) {
          const key = command.owner ? "owner" : command.premium ? "premium" : "admin";
          const fmt = require("../format");
          await interaction
            .reply({ content: fmt.texted("bold", fmt.status(key)), flags: 64 })
            .catch(() => {});
          return;
        }
        if (typeof command.cooldown === "number" && command.cooldown > 0 && !isDCOwner) {
          const key = dcUserId + ":" + command.name;
          const last = global.coolCache.get(key) || 0;
          if (Date.now() - last < command.cooldown) {
            const fmt = require("../format");
            await interaction
              .reply({ content: fmt.texted("bold", fmt.status("cooldown")), flags: 64 })
              .catch(() => {});
            return;
          }
          global.coolCache.set(key, Date.now());
        }

        if (interaction.guildId && !client.guilds.cache.has(interaction.guildId)) {
          const inviteLink = `https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot+applications.commands`;
          const embed = new EmbedBuilder()
            .setColor("#5865F2")
            .setTitle("I'm not in this server yet")
            .setDescription(
              "It looks like **" +
                (global.botname) +
                "** has not officially joined this server.\n\nClick the button below to add me, then use the command again!",
            )
            .addFields(
              {
                name: "Permissions",
                value: "Administrator (semua fitur: musik, moderasi, images)",
                inline: true,
              },
              { name: "Scope", value: "`bot` + `applications.commands`", inline: true },
            )
            .setThumbnail("https://cdn-icons-png.flaticon.com/128/3462/3462381.png")
            .setFooter({ text: global.botname })
            .setTimestamp();
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setLabel("Invite Bot to Server")
              .setStyle(ButtonStyle.Link)
              .setURL(inviteLink),
          );
          try {
            await interaction.reply({ embeds: [embed], components: [row], flags: 64 });
          } catch (e) {
            global.logError("discord.inviteReply", e);
          }
          return;
        }

        try {
          interaction._receivedAt = Date.now();
          if (interaction.guildId) {
            try {
              const db = database.get();
              const existed = !!db.discord?.servers?.[interaction.guildId];
              database.ensureDiscord(db, interaction);
              if (!existed) database.write(db);
            } catch (e) {
              global.logError("discord.database", e);
            }
          }
          if (typeof command.before === "function") {
            try {
              const stop = await command.before(interaction, {
                budy: interaction.options?.getString?.("query") || "",
              });
              if (stop === true) return;
            } catch (e) {
              global.logError("discord.before", e);
            }
          }
          await command.execute(interaction);
        } catch (error) {
          const db = database.get();
          if (!db.settings) db.settings = {};
          if (!db.settings.pluginErrors) db.settings.pluginErrors = { telegram: {}, discord: {} };
          if (!db.settings.pluginErrors.discord[command.name])
            db.settings.pluginErrors.discord[command.name] = 0;
          db.settings.pluginErrors.discord[command.name] += 1;
          global.logError("discord.plugin", error);
          if (db.settings.pluginErrors.discord[command.name] >= 5) {
            delete global.discordCommands[command.name];
            if (!db.settings.disabledPlugins)
              db.settings.disabledPlugins = { telegram: [], discord: [] };
            if (!db.settings.disabledPlugins.discord.includes(command.name)) {
              db.settings.disabledPlugins.discord.push(command.name);
            }
          }
          database.write(db);
          try {
            await interaction.reply({
              content:
                "Sorry, an error occurred while running this feature. Please try again later!",
              flags: 64,
            });
          } catch (e) {
            await interaction
              .followUp({
                content:
                  "Sorry, an error occurred while running this feature. Please try again later!",
                flags: 64,
              })
              .catch(() => {});
          }
          return;
        }
        return;
      }

      if (interaction.isButton()) {
        const customId = String(interaction.customId || "");

        if (customId.startsWith("lb|")) {
          const libCmd = global.discordCommands["lib"];
          if (libCmd && typeof libCmd.handleComponent === "function") {
            try {
              await libCmd.handleComponent(interaction);
            } catch (error) {
              global.logError("discord.lib.button", error);
            }
          }
          return;
        }

        const MUSIC_PREFIXES = ["music_", "seek_", "volume_", "filter_", "genre_"];
        if (!MUSIC_PREFIXES.some((p) => customId.startsWith(p))) {
          return;
        }

        const playCmd = global.discordCommands["p"];
        if (playCmd && typeof playCmd.handleButton === "function") {
          try {
            await playCmd.handleButton(interaction);
          } catch (error) {
            global.logError("discord.button", error);
          }
        }
        return;
      }

      if (interaction.isStringSelectMenu()) {
        const userId = String(interaction.user.id);

        if (interaction.customId === "regAgeSel") {
          const val = interaction.values?.[0];
          const age = val === "random" ? 9 + Math.floor(Math.random() * 22) : parseInt(val, 10);
          if (!isNaN(age) && age >= 5 && age <= 30) {
            const data = database.get();
            if (!data.discord) data.discord = {};
            if (!data.discord.users) data.discord.users = {};
            if (!data.discord.users[userId]) data.discord.users[userId] = {};
            Object.assign(data.discord.users[userId], {
              age,
              registered: true,
              regTime: Date.now(),
            });
            database.write(data);
            await interaction
              .reply({
                content: `Registered successfully!\n\nName: ${interaction.user.username}\nAge: ${age} years`,
                flags: 64,
              })
              .catch(() => {});
          }
          return;
        }
      }
    });

    client.on("messageCreate", (message) => {
      if (message.author?.bot) return;
      try {
        require("../print")({ type: "discord", message });
      } catch (e) {}

      if (!message.guild && message.channel?.type === 1) {
        try {
          const data = database.get();
          const user = data?.discord?.users?.[String(message.author.id)];
          if (!user?.registered) {
            if (!global.promptCache) global.promptCache = new Map();
            const key = String(message.author.id);
            const last = global.promptCache.get(key) || 0;
            if (Date.now() - last < 6 * 3600 * 1000) return;
            global.promptCache.set(key, Date.now());
            const { ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
            const ageSelect = new StringSelectMenuBuilder()
              .setCustomId("regAgeSel")
              .setPlaceholder("Select Your Age")
              .addOptions([
                { label: "Random Years", value: "random" },
                ...Array.from({ length: 22 }, (_, i) => 30 - i).map((a) => ({
                  label: `${a} Years`,
                  value: String(a),
                })),
              ]);
            message
              .reply({
                content: "Select Your Age",
                components: [new ActionRowBuilder().addComponents(ageSelect)],
              })
              .catch(() => {});
          }
        } catch (e) {}
      }
    });
  },
};
