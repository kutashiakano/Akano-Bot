
const database = require("../../../../database");

function ageSelect(client) {
  return new (client.mbuilder)()
    .setCustomId("regAgeSel")
    .setPlaceholder("Select Your Age")
    .addOptions([
      { label: "Random Years", value: "random" },
      ...Array.from({ length: 22 }, (_, i) => 30 - i).map((a) => ({
        label: `${a} Years`,
        value: String(a),
      })),
    ]);
}

function getProfile(userId) {
  const data = database.get();
  return data?.discord?.users?.[userId] || null;
}


const { define } = require("../../../plugin");

module.exports = define({
  name: ["register"],
  category: "tools",
  description: "Register your age",
  options: [],
  run: async (ctx) => {
    const interaction = ctx.interaction;

    
    try {
      await interaction.deferReply();
    } catch (e) {
      return;
    }
    const userId = String(interaction.user.id);
    if (getProfile(userId)?.registered) {
      return interaction.editReply({
        content: "You are already registered.",
      });
    }
    await interaction.editReply({
      content: "Select Your Age",
      components: [new (interaction.client.abuilder)().addComponents(ageSelect(interaction.client))],
    });
  
  },
});
