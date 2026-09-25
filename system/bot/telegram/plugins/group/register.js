import database from "../../../../database/index.js";
import { telegram as tgsdk } from "@kutashiakanocanzy/sdk";

import { defineBot as define } from "@kutashiakanocanzy/sdk";

function ageKeyboard() {
  const ages = Array.from({
    length: 22
  }, (_, i) => 30 - i);
  const rows = [];
  for (let i = 0; i < ages.length; i += 6) {
    rows.push(ages.slice(i, i + 6).map(a => ({
      text: `${a} Years`,
      callback_data: `age:${a}`
    })));
  }
  rows.push([ {
    text: "Random Years",
    callback_data: "age:random"
  }, {
    text: "Cancel",
    callback_data: "reglang:cancel"
  } ]);
  return {
    inline_keyboard: rows
  };
}

function getProfile(userId) {
  const data = database.get();
  return data?.telegram?.users?.[userId] || null;
}

function setProfile(userId, fields) {
  const data = database.get();
  if (!data.telegram) data.telegram = {};
  if (!data.telegram.users) data.telegram.users = {};
  if (!data.telegram.users[userId]) data.telegram.users[userId] = {};
  Object.assign(data.telegram.users[userId], fields);
  database.write(data).catch(() => {});
}

export default define({
  name: [ "register", "daftar", "reg" ],
  category: "settings",
  help: "Register your account",
  onCallback: async ctx => {
    const data = ctx.callbackQuery?.data;
    if (!data) return;
    const userId = String(ctx.from?.id);
    if (data === "reglang:cancel") {
      await ctx.deleteMessage().catch(() => {});
      await tgsdk.answerTap(ctx);
      return;
    }
    if (data.startsWith("age:")) {
      const val = data.split(":")[1];
      const age = val === "random" ? 9 + Math.floor(Math.random() * 22) : parseInt(val, 10);
      if (isNaN(age) || age < 5 || age > 30) {
        await tgsdk.answerTap(ctx, "Age must be between 5 and 30.");
        return;
      }
      setProfile(userId, {
        age: age,
        registered: true,
        regTime: Date.now()
      });
      await ctx.editMessageText(`Registered successfully!\n\nName: ${ctx.from?.first_name || "User"}\nAge: ${age} years`).catch(() => {});
      await tgsdk.answerTap(ctx);
    }
  },
  run: async ctx => {
    const userId = String(ctx.from?.id);
    if (getProfile(userId)?.registered) {
      return ctx.reply("You are already registered.\nUse /unreg to reset your registration.").catch(() => {});
    }
    const text = "Select Your Age";
    await ctx.replyWithPhoto(global.settings.cover, {
      caption: text,
      reply_markup: ageKeyboard()
    }).catch(async () => {
      await ctx.reply(text, {
        reply_markup: ageKeyboard()
      }).catch(() => {});
    });
  }
});
