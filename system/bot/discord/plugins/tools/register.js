import database from "../../../../database/index.js";
import { defineBot as define } from "@kutashiakanocanzy/sdk";
import { ui as makeUi } from "@kutashiakanocanzy/sdk";
import path from "node:path";
const ui = makeUi({ iconsDir: path.join(import.meta.dirname, "../../../website/dashboard/client/icons") });

function ageOptions() {
  return [{
    label: "Random Years",
    value: "random"
  }, ...Array.from({
    length: 22
  }, (_, i) => 30 - i).map(a => ({
    label: `${a} Years`,
    value: String(a)
  }))];
}

function ageRow(client) {
  return (new client.abuilder).addComponents((new client.mbuilder).setCustomId("regAgeSel").setPlaceholder("Select Your Age").addOptions(ageOptions()));
}

function saveAge(userId, username, age) {
  const data = database.get();
  if (!data.discord) data.discord = {};
  if (!data.discord.users) data.discord.users = {};
  if (!data.discord.users[userId]) data.discord.users[userId] = {};
  Object.assign(data.discord.users[userId], {
    name: username || data.discord.users[userId].name || "",
    age: age,
    registered: true,
    regTime: Date.now()
  });
  database.write(data).catch(() => {});
}

function getProfile(userId) {
  const data = database.get();
  return data?.discord?.users?.[userId] || null;
}

const cmd = define({
  name: ["register"],
  category: "tools",
  description: "Link your Discord account to Akano by setting your age",
  options: [{
    name: "age",
    type: 4,
    description: "Your age (5-100). Skip to pick from the menu.",
    required: false,
    min_value: 5,
    max_value: 100
  }],
  run: async ctx => {
    const interaction = ctx.interaction;
    const EB = interaction.client.ebuilder;
    try {
      await interaction.deferReply();
    } catch (e) {
      return;
    }
    const userId = String(interaction.user.id);
    const avatar = interaction.user.displayAvatarURL({ size: 256 });
    const existing = getProfile(userId);
    if (existing?.registered) {
      const e = new EB().setColor("#57F287").setTitle("Account Already Linked").setThumbnail(avatar).addFields(
        { name: "Name", value: interaction.user.username, inline: true },
        { name: "Age", value: String(existing.age || "-"), inline: true },
        { name: "Status", value: "Linked since " + (existing.regTime ? new Date(existing.regTime).toLocaleDateString() : "-"), inline: false }
      ).setTimestamp();
      return interaction.editReply({ embeds: [e] });
    }
    const typed = interaction.options.getInteger("age");
    if (typed && typed >= 5 && typed <= 100) {
      saveAge(userId, interaction.user.username, typed);
      const e = new EB().setColor("#57F287").setTitle("Account Linked").setThumbnail(avatar).setDescription("Your Discord account is now linked to Akano. You can play /rpg right away.").addFields(
        { name: "Name", value: interaction.user.username, inline: true },
        { name: "Age", value: String(typed) + " years", inline: true }
      ).setTimestamp();
      return interaction.editReply({ embeds: [e] });
    }
    const e = new EB().setColor("#5865F2").setTitle("Link Your Account").setDescription("One tap and you are in.\n\n1. Pick your age below, or run /register age:<years>\n2. Your Discord profile is saved to Akano\n3. Play /rpg right away").setThumbnail(avatar).setImage("attachment://shield.png").setFooter({ text: "By linking you agree to play fair" }).setTimestamp();
    await interaction.editReply({ embeds: [e], files: ui.file("shield"), components: [ageRow(interaction.client)] });
  }
});

cmd.ageRow = ageRow;
cmd.saveAge = saveAge;
cmd.getProfile = getProfile;

export default cmd;
