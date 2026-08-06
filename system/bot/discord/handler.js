const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ActivityType } = require("discord.js");
const database = require("../../database");

module.exports = {
  setup(client) {
    client.once("clientReady", async () => {
      try {
        global.discord = client;

        const commandsData = Object.values(global.discordCommands)
          .filter((cmd) => cmd && cmd.name && cmd.execute)
          .filter((cmd) => cmd.options && cmd.options.length > 0)
          .map((cmd) => ({
            name: cmd.name,
            description: cmd.description,
            options: cmd.options || [],
          }));

        if (commandsData.length > 0) {
          await client.application.commands.set(commandsData);
        }

        global.discord.user.setPresence({
          activities: [{
            name: global.settings?.discord?.presence?.name || global.botname,
            type: ActivityType[global.settings?.discord?.presence?.type || "Custom"],
            state: global.settings?.discord?.presence?.state || "Bot Active"
          }],
          status: global.settings?.discord?.presence?.status || "online"
        });
      } catch (error) {
        global.logError("discord.clientReady", error);
      }
    });

    client.on("interactionCreate", async (interaction) => {
      if (interaction.isChatInputCommand()) {
        const command = global.discordCommands[interaction.commandName];
        if (!command) return;

        try {
          const db = database.get();
          const disabled = db.settings?.disabledPlugins?.discord || [];
          if (disabled.includes(command.name)) {
            await interaction.reply({
              content: "Sorry, this feature is currently disabled due to an error!",
              flags: 64,
            }).catch(() => {});
            return;
          }
        } catch (e) {}

        if (interaction.guildId && !client.guilds.cache.has(interaction.guildId)) {
          const inviteLink = `https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot+applications.commands`;
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setLabel("Add Bot to Server")
              .setStyle(ButtonStyle.Link)
              .setURL(inviteLink)
          );
          try {
            await interaction.reply({
              content: "The bot has not officially joined this server. Please click the button below to add me:",
              components: [row],
              flags: 64
            });
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
          await command.execute(interaction);
        } catch (error) {
          const db = database.get();
          if (!db.settings) db.settings = {};
          if (!db.settings.pluginErrors) db.settings.pluginErrors = { telegram: {}, discord: {} };
          if (!db.settings.pluginErrors.discord[cName]) db.settings.pluginErrors.discord[cName] = 0;
          db.settings.pluginErrors.discord[cName] += 1;
          global.logError("discord.plugin", error);
          if (db.settings.pluginErrors.discord[cName] >= 5) {
            delete global.discordCommands[cName];
            if (!db.settings.disabledPlugins) db.settings.disabledPlugins = { telegram: [], discord: [] };
            if (!db.settings.disabledPlugins.discord.includes(cName)) {
              db.settings.disabledPlugins.discord.push(cName);
            }
          }
          database.write(db);
          try {
            await interaction.reply({
              content: "Sorry, an error occurred while running this feature. Please try again later!",
              flags: 64,
            });
          } catch (e) {
            await interaction.followUp({
              content: "Sorry, an error occurred while running this feature. Please try again later!",
              flags: 64,
            }).catch(() => {});
          }
          return;
        }
        return;
      }

      if (interaction.isButton()) {
        if (interaction.replied || interaction.deferred) return;
        const playCmd = global.discordCommands["p"];
        if (playCmd && typeof playCmd.handleButton === "function") {
          try {
            await playCmd.handleButton(interaction);
          } catch (e) {
            global.logError("discord.button", e);
          }
        }
      }
    });
  }
};