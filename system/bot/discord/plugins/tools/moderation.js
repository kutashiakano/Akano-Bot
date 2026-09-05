const warnDB = new Map;

function getWarnings(guildId, userId) {
  const key = `${guildId}:${userId}`;
  return warnDB.get(key) || [];
}

function addWarning(guildId, userId, reason, moderator) {
  const key = `${guildId}:${userId}`;
  const warnings = warnDB.get(key) || [];
  warnings.push({
    reason: reason,
    moderator: moderator,
    timestamp: Date.now()
  });
  warnDB.set(key, warnings);
  return warnings;
}

function parseDuration(str) {
  const match = str.match(/^(\d+)(s|m|h|d)$/i);
  if (!match) return null;
  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = {
    s: 1e3,
    m: 6e4,
    h: 36e5,
    d: 864e5
  };
  return value * multipliers[unit];
}

function errEmbed(client, msg) {
  return (new interaction.client.ebuilder).setColor("#ED4245").setDescription(msg);
}

function dmEmbed(client, type, guildName, reason) {
  const titles = {
    kick: "You were Kicked",
    ban: "You were Banned"
  };
  return (new interaction.client.ebuilder).setColor("#ED4245").setTitle(titles[type] || "Moderation").addFields({
    name: "Server",
    value: guildName,
    inline: true
  }, {
    name: "Reason",
    value: reason,
    inline: true
  });
}

const {define: define} = require("../../../plugin");

module.exports = define({
  name: [ "mod" ],
  category: "tools",
  help: "Server moderation commands",
  options: [ {
    name: "kick",
    type: 1,
    description: "Kick a member from the server",
    options: [ {
      name: "user",
      type: 6,
      description: "User to kick",
      required: true
    }, {
      name: "reason",
      type: 3,
      description: "Kick reason",
      required: false
    } ]
  }, {
    name: "ban",
    type: 1,
    description: "Ban a member from the server",
    options: [ {
      name: "user",
      type: 6,
      description: "User to ban",
      required: true
    }, {
      name: "reason",
      type: 3,
      description: "Ban reason",
      required: false
    }, {
      name: "delete_days",
      type: 4,
      description: "Delete messages from last X days (0-7)",
      required: false,
      min_value: 0,
      max_value: 7
    } ]
  }, {
    name: "unban",
    type: 1,
    description: "Unban a user from the server",
    options: [ {
      name: "user_id",
      type: 3,
      description: "ID of user to unban",
      required: true
    } ]
  }, {
    name: "timeout",
    type: 1,
    description: "Timeout a member (temporary mute)",
    options: [ {
      name: "user",
      type: 6,
      description: "User to timeout",
      required: true
    }, {
      name: "duration",
      type: 3,
      description: "Duration (e.g.: 10m, 1h, 1d)",
      required: true
    }, {
      name: "reason",
      type: 3,
      description: "Timeout reason",
      required: false
    } ]
  }, {
    name: "untimeout",
    type: 1,
    description: "Remove timeout from a member",
    options: [ {
      name: "user",
      type: 6,
      description: "User to remove timeout from",
      required: true
    } ]
  }, {
    name: "clear",
    type: 1,
    description: "Delete a certain amount of messages",
    options: [ {
      name: "amount",
      type: 4,
      description: "Number of messages (1-100)",
      required: true,
      min_value: 1,
      max_value: 100
    }, {
      name: "user",
      type: 6,
      description: "Filter messages from a specific user",
      required: false
    } ]
  }, {
    name: "warn",
    type: 1,
    description: "Issue a warning to a member",
    options: [ {
      name: "user",
      type: 6,
      description: "User to warn",
      required: true
    }, {
      name: "reason",
      type: 3,
      description: "Warning reason",
      required: true
    } ]
  }, {
    name: "warnings",
    type: 1,
    description: "View warning history of a member",
    options: [ {
      name: "user",
      type: 6,
      description: "User to view warnings for",
      required: true
    } ]
  }, {
    name: "slowmode",
    type: 1,
    description: "Set channel slowmode",
    options: [ {
      name: "seconds",
      type: 4,
      description: "Delay in seconds (0 = disable)",
      required: true,
      min_value: 0,
      max_value: 21600
    } ]
  }, {
    name: "lock",
    type: 1,
    description: "Lock channel (no one can send messages)",
    options: []
  }, {
    name: "unlock",
    type: 1,
    description: "Unlock channel",
    options: []
  } ],
  run: async ctx => {
    const interaction = ctx.interaction;
    try {
      await interaction.deferReply({
        flags: 64
      });
    } catch (e) {
      return;
    }
    const sub = interaction.options.getSubcommand();
    const member = interaction.member;
    const guild = interaction.guild;
    if (sub === "kick") {
      if (!member.permissions.has(interaction.client.PermissionFlagsBits.KickMembers)) {
        return interaction.editReply({
          embeds: [ errEmbed(interaction.client, "You don't have permission to Kick Members.") ]
        });
      }
      const target = interaction.options.getMember("user");
      const reason = interaction.options.getString("reason") || "No reason";
      if (!target.kickable) {
        return interaction.editReply({
          embeds: [ errEmbed(interaction.client, "Bot cannot kick this user.") ]
        });
      }
      try {
        await target.send({
          embeds: [ dmEmbed(target.client, "kick", guild.name, reason) ]
        }).catch(() => {});
        await target.kick(reason);
        return interaction.editReply({
          embeds: [ (new interaction.client.ebuilder).setColor("#FEE75C").setTitle("Member Kicked").addFields({
            name: "User",
            value: `${target.user.tag}`,
            inline: true
          }, {
            name: "Reason",
            value: reason,
            inline: true
          }, {
            name: "Moderator",
            value: interaction.user.tag,
            inline: true
          }) ]
        });
      } catch (e) {
        return interaction.editReply({
          embeds: [ errEmbed(interaction.client, "🚩 Failed to kick: " + e.message) ]
        });
      }
    }
    if (sub === "ban") {
      if (!member.permissions.has(interaction.client.PermissionFlagsBits.BanMembers)) {
        return interaction.editReply({
          embeds: [ errEmbed(interaction.client, "You don't have permission to Ban Members.") ]
        });
      }
      const target = interaction.options.getMember("user");
      const reason = interaction.options.getString("reason") || "No reason";
      const deleteDays = interaction.options.getInteger("delete_days") || 0;
      if (!target.bannable) {
        return interaction.editReply({
          embeds: [ errEmbed(interaction.client, "Bot cannot ban this user.") ]
        });
      }
      try {
        await target.send({
          embeds: [ dmEmbed(target.client, "ban", guild.name, reason) ]
        }).catch(() => {});
        await target.ban({
          reason: reason,
          deleteMessageDays: deleteDays
        });
        return interaction.editReply({
          embeds: [ (new interaction.client.ebuilder).setColor("#ED4245").setTitle("Member Banned").addFields({
            name: "User",
            value: `${target.user.tag}`,
            inline: true
          }, {
            name: "Reason",
            value: reason,
            inline: true
          }, {
            name: "Moderator",
            value: interaction.user.tag,
            inline: true
          }) ]
        });
      } catch (e) {
        return interaction.editReply({
          embeds: [ errEmbed(interaction.client, "🚩 Failed to ban: " + e.message) ]
        });
      }
    }
    if (sub === "unban") {
      if (!member.permissions.has(interaction.client.PermissionFlagsBits.BanMembers)) {
        return interaction.editReply({
          embeds: [ errEmbed(interaction.client, "You don't have permission to Ban Members.") ]
        });
      }
      const userId = interaction.options.getString("user_id");
      try {
        await guild.members.unban(userId);
        return interaction.editReply({
          embeds: [ (new interaction.client.ebuilder).setColor("#57F287").setDescription(`User \`${userId}\` has been unbanned successfully.`) ]
        });
      } catch (e) {
        return interaction.editReply({
          embeds: [ errEmbed(interaction.client, "🚩 Failed to unban: " + e.message) ]
        });
      }
    }
    if (sub === "timeout") {
      if (!member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return interaction.editReply({
          embeds: [ errEmbed(interaction.client, "You don't have permission to Moderate Members.") ]
        });
      }
      const target = interaction.options.getMember("user");
      const durationStr = interaction.options.getString("duration");
      const reason = interaction.options.getString("reason") || "No reason";
      const ms = parseDuration(durationStr);
      if (!ms) {
        return interaction.editReply({
          embeds: [ errEmbed(interaction.client, "Invalid duration format. Example: `10m`, `1h`, `1d`") ]
        });
      }
      try {
        await target.timeout(ms, reason);
        return interaction.editReply({
          embeds: [ (new interaction.client.ebuilder).setColor("#FEE75C").setTitle("Member Timed Out").addFields({
            name: "User",
            value: `${target.user.tag}`,
            inline: true
          }, {
            name: "Duration",
            value: durationStr,
            inline: true
          }, {
            name: "Reason",
            value: reason,
            inline: true
          }) ]
        });
      } catch (e) {
        return interaction.editReply({
          embeds: [ errEmbed(interaction.client, "🚩 Failed to timeout: " + e.message) ]
        });
      }
    }
    if (sub === "untimeout") {
      if (!member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return interaction.editReply({
          embeds: [ errEmbed(interaction.client, "You don't have permission to Moderate Members.") ]
        });
      }
      const target = interaction.options.getMember("user");
      try {
        await target.timeout(null);
        return interaction.editReply({
          embeds: [ (new interaction.client.ebuilder).setColor("#57F287").setDescription(`Timeout for **${target.user.tag}** has been removed.`) ]
        });
      } catch (e) {
        return interaction.editReply({
          embeds: [ errEmbed(interaction.client, "Failed to remove timeout: " + e.message) ]
        });
      }
    }
    if (sub === "clear") {
      if (!member.permissions.has(interaction.client.PermissionFlagsBits.ManageMessages)) {
        return interaction.editReply({
          embeds: [ errEmbed(interaction.client, "You don't have permission to Manage Messages.") ]
        });
      }
      const amount = interaction.options.getInteger("amount");
      const targetUser = interaction.options.getUser("user");
      try {
        let messages = await interaction.channel.messages.fetch({
          limit: 100
        });
        if (targetUser) {
          messages = messages.filter(m => m.author.id === targetUser.id);
        }
        const toDelete = [ ...messages.values() ].slice(0, amount);
        const filtered = toDelete.filter(m => Date.now() - m.createdTimestamp < 14 * 24 * 60 * 60 * 1e3);
        await interaction.channel.bulkDelete(filtered, true);
        return interaction.editReply({
          embeds: [ (new interaction.client.ebuilder).setColor("#57F287").setDescription(`Successfully deleted **${filtered.length}** messages.`) ]
        });
      } catch (e) {
        return interaction.editReply({
          embeds: [ errEmbed(interaction.client, "Failed to delete messages: " + e.message) ]
        });
      }
    }
    if (sub === "warn") {
      if (!member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return interaction.editReply({
          embeds: [ errEmbed(interaction.client, "You don't have permission to Moderate Members.") ]
        });
      }
      const target = interaction.options.getMember("user");
      const reason = interaction.options.getString("reason");
      const warnings = addWarning(guild.id, target.user.id, reason, interaction.user.tag);
      try {
        await target.send({
          embeds: [ (new interaction.client.ebuilder).setColor("#FEE75C").setTitle(`Warning from ${guild.name}`).addFields({
            name: "Reason",
            value: reason
          }, {
            name: "Total Warning",
            value: `${warnings.length}`
          }) ]
        }).catch(() => {});
      } catch (e) {}
      return interaction.editReply({
        embeds: [ (new interaction.client.ebuilder).setColor("#FEE75C").setTitle("Warning Issued").addFields({
          name: "User",
          value: `${target.user.tag}`,
          inline: true
        }, {
          name: "Reason",
          value: reason,
          inline: true
        }, {
          name: "Total Warning",
          value: `${warnings.length}`,
          inline: true
        }) ]
      });
    }
    if (sub === "warnings") {
      const target = interaction.options.getMember("user");
      const warnings = getWarnings(guild.id, target.user.id);
      if (warnings.length === 0) {
        return interaction.editReply({
          embeds: [ (new interaction.client.ebuilder).setColor("#57F287").setDescription(`**${target.user.tag}** has no warnings.`) ]
        });
      }
      const list = warnings.map((w, i) => `\`${i + 1}.\` **${w.reason}** — by ${w.moderator} (<t:${Math.floor(w.timestamp / 1e3)}:R>)`).join("\n");
      return interaction.editReply({
        embeds: [ (new interaction.client.ebuilder).setColor("#FEE75C").setTitle(`Warnings: ${target.user.tag}`).setDescription(list).setFooter({
          text: `Total: ${warnings.length} warnings`
        }) ]
      });
    }
    if (sub === "slowmode") {
      if (!member.permissions.has(interaction.client.PermissionFlagsBits.ManageChannels)) {
        return interaction.editReply({
          embeds: [ errEmbed(interaction.client, "You don't have permission to Manage Channels.") ]
        });
      }
      const seconds = interaction.options.getInteger("seconds");
      try {
        await interaction.channel.setRateLimitPerUser(seconds);
        return interaction.editReply({
          embeds: [ (new interaction.client.ebuilder).setColor("#57F287").setDescription(seconds === 0 ? "Slowmode disabled." : `Slowmode set to **${seconds}** seconds.`) ]
        });
      } catch (e) {
        return interaction.editReply({
          embeds: [ errEmbed(interaction.client, "Failed to set slowmode: " + e.message) ]
        });
      }
    }
    if (sub === "lock") {
      if (!member.permissions.has(interaction.client.PermissionFlagsBits.ManageChannels)) {
        return interaction.editReply({
          embeds: [ errEmbed(interaction.client, "You don't have permission to Manage Channels.") ]
        });
      }
      try {
        await interaction.channel.permissionOverwrites.edit(guild.roles.everyone, {
          SendMessages: false
        });
        return interaction.editReply({
          embeds: [ (new interaction.client.ebuilder).setColor("#ED4245").setDescription(`Channel **#${interaction.channel.name}** has been locked.`) ]
        });
      } catch (e) {
        return interaction.editReply({
          embeds: [ errEmbed(interaction.client, "Failed to lock channel: " + e.message) ]
        });
      }
    }
    if (sub === "unlock") {
      if (!member.permissions.has(interaction.client.PermissionFlagsBits.ManageChannels)) {
        return interaction.editReply({
          embeds: [ errEmbed(interaction.client, "You don't have permission to Manage Channels.") ]
        });
      }
      try {
        await interaction.channel.permissionOverwrites.edit(guild.roles.everyone, {
          SendMessages: null
        });
        return interaction.editReply({
          embeds: [ (new interaction.client.ebuilder).setColor("#57F287").setDescription(`Channel **#${interaction.channel.name}** has been unlocked.`) ]
        });
      } catch (e) {
        return interaction.editReply({
          embeds: [ errEmbed(interaction.client, "Failed to unlock channel: " + e.message) ]
        });
      }
    }
  }
});