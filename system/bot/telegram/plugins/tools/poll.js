import { telegram as tgsdk } from "@kutashiakanocanzy/sdk";

import { defineBot as define } from "@kutashiakanocanzy/sdk";

function parseArgs(text) {
  const parts = String(text || "").split("|").map(s => s.trim()).filter(Boolean);
  if (parts.length < 3) return null;
  return { question: parts[0].slice(0, 300), options: parts.slice(1, 5).map(s => s.slice(0, 100)) };
}

export default define({
  name: [ "poll" ],
  command: [ "poll" ],
  category: "tools",
  help: "Create a poll: /poll question | option1 | option2",
  run: async ctx => {
    const parsed = parseArgs(ctx.text || "");
    if (!parsed) {
      return ctx.reply("Usage: /poll question | option1 | option2 [| option3] [| option4]");
    }
    try {
      await tgsdk.sendVote(ctx.api, ctx.chat.id, parsed.question, parsed.options, { is_anonymous: false });
    } catch (e) {
      await ctx.reply("Could not create poll. Try again soon.").catch(() => {});
    }
  }
});
