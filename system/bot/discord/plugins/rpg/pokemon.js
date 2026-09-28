import { card, discord as dcSdk } from "@kutashiakanocanzy/sdk";

import { defineBot as define } from "@kutashiakanocanzy/sdk";

function title(s) {
  return String(s || "").split(/[\s-]+/).map(w => w ? w[0].toUpperCase() + w.slice(1) : w).join(" ");
}
async function jget(url) {
  const r = await fetch(url, { headers: { "User-Agent": "Akano-Bot" } });
  if (!r.ok) throw new Error("http " + r.status);
  return r.json();
}
export default define({
  name: ["pokemon", "pokedex"],
  category: "rpg",
  description: "Look up a monster by name",
  options: [{ name: "name", type: 3, description: "Monster name (example: pikachu)", required: true }],
  run: async ctx => {
    const interaction = ctx.interaction;
    try { await dcSdk.thinking(interaction); } catch (e) { return; }
    const q = String(interaction.options.getString("name") || "").trim().toLowerCase().replace(/\s+/g, "-");
    if (!q) return dcSdk.editReply(interaction, { content: "Usage: /pokemon <name>" }).catch(() => {});
    try {
      const data = await jget("https://pokeapi.co/api/v2/pokemon/" + encodeURIComponent(q));
      let flavor = "";
      try {
        const sp = await jget("https://pokeapi.co/api/v2/pokemon-species/" + encodeURIComponent(String(data.id)));
        const en = (sp.flavor_text_entries || []).find(f => f.language && f.language.name === "en");
        flavor = String((en && en.flavor_text) || "").replace(/[\n\f\r]+/g, " ");
      } catch (e) {}
      const stat = n => {
        const f = (data.stats || []).find(s => s.stat && s.stat.name === n);
        return f ? String(f.base_stat) : "-";
      };
      const types = (data.types || []).map(t => title(t.type && t.type.name)).join(" | ") || "-";
      const img = (data.sprites && data.sprites.other && data.sprites.other["official-artwork"] && data.sprites.other["official-artwork"].front_default) || data.sprites.front_default;
      const e = card().setColor("#EE8130").setTitle("#" + data.id + " " + title(data.name)).setDescription(flavor.slice(0, 300) || "No description.").addFields(
        { name: "Height", value: (data.height / 10) + " m", inline: true },
        { name: "Weight", value: (data.weight / 10) + " kg", inline: true },
        { name: "Type", value: types, inline: true },
        { name: "HP", value: stat("hp"), inline: true },
        { name: "Attack", value: stat("attack"), inline: true },
        { name: "Defense", value: stat("defense"), inline: true },
        { name: "Sp. Atk", value: stat("special-attack"), inline: true },
        { name: "Sp. Def", value: stat("special-defense"), inline: true },
        { name: "Speed", value: stat("speed"), inline: true }
      ).setTimestamp();
      if (img) e.setThumbnail(img);
      return dcSdk.editReply(interaction, { embeds: [e] }).catch(() => {});
    } catch (e) {
      return dcSdk.editReply(interaction, { embeds: [card().setColor("#ED4245").setDescription("No results for `" + q + "`")] }).catch(() => {});
    }
  }
});
