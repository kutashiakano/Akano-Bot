import database from "../../../../database/index.js";
import sdkFacade from "../../../sdk/index.js";
const { define, ui } = sdkFacade;
import regPlugin from "../tools/register.js";
function isLinked(id) {
  try {
    return !!database.get().discord?.users?.[String(id)]?.registered;
  } catch (e) {
    return false;
  }
}
function cdLeft(u, key, ms) {
  if (!u.rpg.cd || typeof u.rpg.cd !== "object") u.rpg.cd = {};
  const left = (u.rpg.cd[key] || 0) + ms - Date.now();
  if (left > 0) return left;
  u.rpg.cd[key] = Date.now();
  return 0;
}
function duelStake(a, b) {
  const poor = Math.min(a.money || 0, b.money || 0);
  return Math.max(10, Math.min(100, Math.floor(poor * 0.2)));
}
function levelOf(xp) {
  return 1 + Math.floor(Math.max(0, xp) / 300);
}
function maxHpOf(lvl) {
  return 100 + (lvl - 1) * 20;
}
function maxHp(u) {
  return maxHpOf(levelOf(u.rpg.xp)) + ((u.rpg.pet && u.rpg.pet.hp) || 0);
}
function getU(db, id, name) {
  if (!db.discord) db.discord = { servers: {}, users: {} };
  if (!db.discord.users) db.discord.users = {};
  let u = db.discord.users[id];
  if (!u || typeof u !== "object") {
    u = { name: name || "", exp: 0, money: 100, limit: 0, registered: false, premium: false };
    db.discord.users[id] = u;
  }
  if (typeof u.exp !== "number" || isNaN(u.exp)) u.exp = 0;
  if (typeof u.money !== "number" || isNaN(u.money)) u.money = 100;
  if (!u.rpg || typeof u.rpg !== "object") u.rpg = {};
  const r = u.rpg;
  if (typeof r.xp !== "number" || isNaN(r.xp)) r.xp = 0;
  if (typeof r.wins !== "number") r.wins = 0;
  if (typeof r.losses !== "number") r.losses = 0;
  if (typeof r.potions !== "number") r.potions = 0;
  if (typeof r.sword !== "number") r.sword = 0;
  if (typeof r.shield !== "number") r.shield = 0;
  if (typeof r.crates !== "number") r.crates = 0;
  if (typeof r.hunts !== "number") r.hunts = 0;
  if (typeof r.bosses !== "number") r.bosses = 0;
  if (typeof r.cratesOpened !== "number") r.cratesOpened = 0;
  if (typeof r.robs !== "number") r.robs = 0;
  if (!r.cd || typeof r.cd !== "object") r.cd = {};
  if (typeof r.robShieldUntil !== "number") r.robShieldUntil = 0;
  if (!Array.isArray(r.robFails)) r.robFails = [];
  if (!r.giftSent || typeof r.giftSent !== "object") r.giftSent = { day: "", total: 0 };
  if (!r.pet || typeof r.pet !== "object") r.pet = null;
  if (typeof r.hp !== "number" || isNaN(r.hp)) r.hp = maxHpOf(levelOf(r.xp)) + ((r.pet && r.pet.hp) || 0);
  r.hp = Math.max(0, Math.min(maxHpOf(levelOf(r.xp)) + ((r.pet && r.pet.hp) || 0), r.hp));
  return u;
}
function gainXp(u, n) {
  const before = levelOf(u.rpg.xp);
  u.rpg.xp += n;
  u.exp = (u.exp || 0) + n;
  return { before: before, after: levelOf(u.rpg.xp) };
}
function levelLine(g) {
  return g.after > g.before ? " Level up to Lv." + g.after + "." : "";
}
function powerOf(u) {
  return levelOf(u.rpg.xp) * 10 + (u.rpg.sword || 0) * 5 + ((u.rpg.pet && u.rpg.pet.power) || 0) + Math.random() * 20;
}
function hurt(u, raw) {
  const dmg = Math.max(0, Math.round(raw - (u.rpg.shield || 0) * 3));
  u.rpg.hp = Math.max(0, u.rpg.hp - dmg);
  return dmg;
}
function fainted(u) {
  return (u.rpg.hp || 0) <= 0;
}
function drinkPotion(u) {
  const cap = maxHp(u);
  if ((u.rpg.potions || 0) <= 0) return { ok: false, why: "No potions left. Buy one with /rpg buy first." };
  if (u.rpg.hp >= cap) return { ok: false, why: "HP is already full." };
  u.rpg.potions -= 1;
  u.rpg.hp = Math.min(cap, u.rpg.hp + 60);
  return { ok: true, hp: u.rpg.hp, maxHp: cap, left: u.rpg.potions };
}
function titleOf(u) {
  const lvl = levelOf(u.rpg.xp);
  if (fainted(u)) return "Fainted";
  if (u.rpg.bosses >= 5) return "Dragonslayer";
  if (u.rpg.wins >= 15) return "Duel Master";
  if (u.rpg.cratesOpened >= 10) return "Treasure Hunter";
  if (u.rpg.robs >= 10) return "Shadow";
  if (lvl >= 15) return "Veteran";
  if (lvl >= 8) return "Adventurer";
  if (lvl >= 4) return "Wanderer";
  return "Novice";
}
const MOBS = [["Slime", 1], ["Goblin", 2], ["Wolf", 3], ["Orc", 4], ["Golem", 5], ["Dragon", 8]];
const JOBS = ["chopped lumber", "mined stone", "delivered parcels", "repaired gear", "cooked meals", "guarded a caravan"];
const CATCHES = [["Old Boot", 5, 15, 8], ["Goldfish", 30, 60, 12], ["Salmon", 60, 100, 18], ["Shark", 120, 200, 30], ["Golden Fish", 300, 600, 40]];
const ORES = [["Stone", 20, 40, 15], ["Coal", 40, 80, 20], ["Iron", 80, 150, 25], ["Gold", 150, 300, 35], ["Ruby", 400, 700, 50]];
const PETS = [["Wolf Cub", 4, 0], ["Ember Drake", 8, 0], ["Stone Turtle", 0, 25], ["Lucky Cat", 2, 10], ["Shadow Fox", 6, 5]];
const BEGS = ["A stranger tossed you some coins.", "You sang a tune and earned tips.", "A merchant pitied you and shared bread money.", "You found coins in a fountain.", "A kid shared lunch money with you.", "You helped carry bags for tips.", "A bard paid you to stop singing.", "You polished boots all afternoon."];
const SWORD_COST = [300, 800, 1500];
const SHIELD_COST = [250, 700, 1300];
const POTION_COST = 150;
const CRATE_COST = 200;
const EGG_COST = 1000;
const ORACLE = ["It is certain.", "Without a doubt.", "Yes, definitely.", "You may rely on it.", "As I see it, yes.", "Most likely.", "Outlook good.", "Yes.", "Signs point to yes.", "Reply hazy, ask again later.", "Ask again later.", "Better not tell you now.", "Cannot predict now.", "Concentrate and ask again.", "Do not count on it.", "My reply is no.", "Outlook not so good.", "Very doubtful.", "The dungeon whispers no.", "The stars say yes."];
function buyItem(u, item, qty) {
  qty = Math.max(1, Math.min(99, qty || 1));
  if (item === "potion") {
    const total = POTION_COST * qty;
    if ((u.money || 0) < total) return { ok: false, why: "Not enough money. " + qty + " potion(s) cost " + total + "." };
    u.money -= total;
    u.rpg.potions += qty;
    return { ok: true, text: qty + " potion(s) purchased. You own " + u.rpg.potions + ". Balance: " + u.money + "." };
  }
  if (item === "sword") {
    if (u.rpg.sword + qty > 3) return { ok: false, why: "That exceeds max tier (Mk.3). You are at Mk." + u.rpg.sword + "." };
    let total = 0;
    for (let k = 0; k < qty; k++) total += SWORD_COST[u.rpg.sword + k];
    if ((u.money || 0) < total) return { ok: false, why: "Not enough money. That upgrade costs " + total + "." };
    u.money -= total;
    u.rpg.sword += qty;
    return { ok: true, text: "Sword Mk." + u.rpg.sword + " forged. Balance: " + u.money + "." };
  }
  if (item === "shield") {
    if (u.rpg.shield + qty > 3) return { ok: false, why: "That exceeds max tier (Mk.3). You are at Mk." + u.rpg.shield + "." };
    let total = 0;
    for (let k = 0; k < qty; k++) total += SHIELD_COST[u.rpg.shield + k];
    if ((u.money || 0) < total) return { ok: false, why: "Not enough money. That upgrade costs " + total + "." };
    u.money -= total;
    u.rpg.shield += qty;
    u.rpg.hp = Math.min(maxHp(u), u.rpg.hp + 8 * qty);
    return { ok: true, text: "Shield Mk." + u.rpg.shield + " equipped. Balance: " + u.money + "." };
  }
  if (item === "crate") {
    const total = CRATE_COST * qty;
    if ((u.money || 0) < total) return { ok: false, why: "Not enough money. " + qty + " crate(s) cost " + total + "." };
    u.money -= total;
    u.rpg.crates += qty;
    return { ok: true, text: qty + " loot crate(s) purchased. You own " + u.rpg.crates + ". Open with /rpg open. Balance: " + u.money + "." };
  }
  if (item === "egg") {
    if (qty > 1) return { ok: false, why: "One egg at a time. You have room for one pet." };
    if ((u.money || 0) < EGG_COST) return { ok: false, why: "Not enough money. A pet egg costs " + EGG_COST + "." };
    u.money -= EGG_COST;
    const p = PETS[Math.floor(Math.random() * PETS.length)];
    const old = u.rpg.pet ? " Your old " + u.rpg.pet.name + " was released." : "";
    u.rpg.pet = { name: p[0], power: p[1], hp: p[2] };
    u.rpg.hp = Math.min(maxHp(u), u.rpg.hp + p[2]);
    return { ok: true, text: "The egg hatched into " + p[0] + " (+" + p[1] + " power, +" + p[2] + " max HP)." + old + " Balance: " + u.money + "." };
  }
  return { ok: false, why: "Unknown item." };
}
function openCrate(u) {
  const roll = Math.random() * 100;
  if (roll < 5) {
    const gold = 1500 + Math.floor(Math.random() * 1001);
    u.money += gold;
    const g = gainXp(u, 150);
    u.rpg.potions += 2;
    return "LEGENDARY. +" + gold + " money, +150 XP, +2 potions." + levelLine(g);
  }
  if (roll < 20) {
    const gold = 500 + Math.floor(Math.random() * 501);
    u.money += gold;
    const g = gainXp(u, 60);
    u.rpg.potions += 1;
    return "EPIC. +" + gold + " money, +60 XP, +1 potion." + levelLine(g);
  }
  if (roll < 50) {
    const gold = 250 + Math.floor(Math.random() * 251);
    u.money += gold;
    const g = gainXp(u, 30);
    return "RARE. +" + gold + " money, +30 XP." + levelLine(g);
  }
  const gold = 100 + Math.floor(Math.random() * 151);
  u.money += gold;
  const g = gainXp(u, 10);
  return "COMMON. +" + gold + " money, +10 XP." + levelLine(g);
}
const ACT = {
  async profile(id, name, targetId, targetName) {
    const db = database.get();
    const u = targetId && targetId !== id ? getU(db, targetId, targetName) : getU(db, id, name);
    const who = targetId && targetId !== id ? (targetName || "Player") : name;
    const lvl = levelOf(u.rpg.xp);
    const cap = maxHp(u);
    const pet = u.rpg.pet ? u.rpg.pet.name + " (+" + u.rpg.pet.power + " power, +" + u.rpg.pet.hp + " HP)" : "None (hatch one from a pet egg)";
    const e = ui.embed().setColor("#5865F2").setTitle(who + " — Lv." + lvl + " " + titleOf(u)).setDescription(ui.bar(u.rpg.xp - (lvl - 1) * 300, 300, 10) + " XP\n" + ui.bar(u.rpg.hp, cap, 10) + " HP").addFields(
      { name: "Money", value: String(u.money || 0), inline: true },
      { name: "Total XP", value: String(u.rpg.xp), inline: true },
      { name: "Record", value: u.rpg.wins + "W / " + u.rpg.losses + "L", inline: true },
      { name: "Equipment", value: "Sword Mk." + u.rpg.sword + " / Shield Mk." + u.rpg.shield + " / " + u.rpg.potions + " potion(s)", inline: false },
      { name: "Pet", value: pet, inline: false },
      { name: "Journey", value: u.rpg.hunts + " hunts, " + u.rpg.bosses + " bosses, " + u.rpg.cratesOpened + " crates, " + u.rpg.robs + " robs", inline: false }
    ).setTimestamp();
    await database.write(db).catch(() => {});
    return { embed: e, art: "profile" };
  },
  async daily(id, name, createdTs) {
    if (createdTs && Date.now() - createdTs < 86400000) return { text: "Your Discord account must be at least 24 hours old to claim daily rewards." };
    const db = database.get();
    const me = getU(db, id, name);
    if (Date.now() - (me.rpg.lastDaily || 0) < 86400000) return { text: "Daily reward already claimed. Come back in " + ui.fmtTime(me.rpg.lastDaily + 86400000 - Date.now()) + "." };
    me.rpg.lastDaily = Date.now();
    me.money = (me.money || 0) + 500;
    const g = gainXp(me, 50);
    me.rpg.hp = maxHp(me);
    await database.write(db).catch(() => {});
    return { embed: ui.embed().setColor("#57F287").setTitle("Daily Reward").setDescription("Received 500 money and 50 XP." + levelLine(g) + " HP fully restored. Balance: " + me.money + "."), art: "daily" };
  },
  async weekly(id, name) {
    const db = database.get();
    const me = getU(db, id, name);
    if (Date.now() - (me.rpg.lastWeekly || 0) < 604800000) return { text: "Weekly reward already claimed. Come back in " + ui.fmtTime(me.rpg.lastWeekly + 604800000 - Date.now()) + "." };
    me.rpg.lastWeekly = Date.now();
    me.money = (me.money || 0) + 2000;
    const g = gainXp(me, 200);
    me.rpg.potions += 2;
    me.rpg.hp = maxHp(me);
    await database.write(db).catch(() => {});
    return { embed: ui.embed().setColor("#57F287").setTitle("Weekly Reward").setDescription("Received 2000 money, 200 XP, and 2 potions." + levelLine(g) + " HP fully restored. Balance: " + me.money + "."), art: "daily" };
  },
  async work(id, name) {
    const db = database.get();
    const me = getU(db, id, name);
    if (cdLeft(me, "work", 300000) > 0) return { text: "You are tired. Rest before the next shift." };
    const job = JOBS[Math.floor(Math.random() * JOBS.length)];
    const pay = 80 + Math.floor(Math.random() * 71);
    me.money += pay;
    const g = gainXp(me, 10);
    await database.write(db).catch(() => {});
    return { embed: ui.embed().setColor("#57F287").setTitle("Work Complete").setDescription("You " + job + " and earned " + pay + " money and 10 XP." + levelLine(g)), art: "work" };
  },
  async beg(id, name) {
    const db = database.get();
    const me = getU(db, id, name);
    if (cdLeft(me, "beg", 60000) > 0) return { text: "Nobody left to beg from. Try again soon." };
    const line = BEGS[Math.floor(Math.random() * BEGS.length)];
    if (Math.random() < 0.15) {
      await database.write(db).catch(() => {});
      return { text: line + " Nobody gave you anything this time." };
    }
    const coins = 5 + Math.floor(Math.random() * 46);
    me.money += coins;
    gainXp(me, 5);
    await database.write(db).catch(() => {});
    return { embed: ui.embed().setColor("#57F287").setTitle("Begging").setDescription(line + " Received " + coins + " money and 5 XP."), art: "beg" };
  },
  async hunt(id, name) {
    const db = database.get();
    const me = getU(db, id, name);
    if (fainted(me)) return { faint: true, embed: ui.embed().setColor("#ED4245").setTitle("Fainted").setDescription("You have fainted. Drink a potion to recover."), art: "heal" };
    if (cdLeft(me, "hunt", 60000) > 0) return { text: "The wilds are quiet. Hunt again soon." };
    const mob = MOBS[Math.floor(Math.random() * MOBS.length)];
    if (powerOf(me) >= mob[1] * 8 + Math.random() * 15) {
      const gold = 50 + Math.floor(Math.random() * 151) + mob[1] * 20;
      const xp = 20 + Math.floor(Math.random() * 41) + mob[1] * 5;
      me.money += gold;
      const g = gainXp(me, xp);
      me.rpg.hunts += 1;
      const dmg = hurt(me, Math.random() * (mob[1] * 3 + 5));
      await database.write(db).catch(() => {});
      return { embed: ui.embed().setColor("#57F287").setTitle("Hunt — " + mob[0] + " defeated").setDescription("Loot: +" + gold + " money, +" + xp + " XP." + levelLine(g) + " You took " + dmg + " damage."), art: "hunt" };
    }
    const lost = Math.min(me.money || 0, 10 + Math.floor(Math.random() * 41));
    me.money = Math.max(0, (me.money || 0) - lost);
    const dmg = hurt(me, 15 + Math.random() * 16);
    gainXp(me, 5);
    await database.write(db).catch(() => {});
    return { faint: fainted(me), embed: ui.embed().setColor("#ED4245").setTitle("Hunt — escaped from " + mob[0]).setDescription("Lost " + lost + " money and took " + dmg + " damage. Consolation: +5 XP." + (fainted(me) ? " You fainted." : "")), art: "hunt" };
  },
  async fish(id, name) {
    const db = database.get();
    const me = getU(db, id, name);
    if (fainted(me)) return { text: "You have fainted. Recover first." };
    if (cdLeft(me, "fish", 90000) > 0) return { text: "The fish are not biting. Cast again soon." };
    const roll = Math.random() * 100;
    let pick = CATCHES[0];
    if (roll > 95) pick = CATCHES[4]; else if (roll > 80) pick = CATCHES[3]; else if (roll > 55) pick = CATCHES[2]; else if (roll > 25) pick = CATCHES[1];
    const gold = pick[1] + Math.floor(Math.random() * (pick[2] - pick[1] + 1));
    me.money += gold;
    const g = gainXp(me, pick[3]);
    await database.write(db).catch(() => {});
    return { embed: ui.embed().setColor("#57F287").setTitle("Fishing — caught " + pick[0]).setDescription("Sold for +" + gold + " money, +" + pick[3] + " XP." + levelLine(g)), art: "fish" };
  },
  async mine(id, name) {
    const db = database.get();
    const me = getU(db, id, name);
    if (fainted(me)) return { text: "You have fainted. Recover first." };
    if (cdLeft(me, "mine", 300000) > 0) return { text: "The cave echoes empty. Dig again soon." };
    const roll = Math.random() * 100;
    let pick = ORES[0];
    if (roll > 92) pick = ORES[4]; else if (roll > 75) pick = ORES[3]; else if (roll > 50) pick = ORES[2]; else if (roll > 25) pick = ORES[1];
    const gold = pick[1] + Math.floor(Math.random() * (pick[2] - pick[1] + 1));
    me.money += gold;
    const g = gainXp(me, pick[3]);
    await database.write(db).catch(() => {});
    return { embed: ui.embed().setColor("#57F287").setTitle("Mining — struck " + pick[0]).setDescription("Sold for +" + gold + " money, +" + pick[3] + " XP." + levelLine(g)), art: "mine" };
  },
  async quest(id, name) {
    const db = database.get();
    const me = getU(db, id, name);
    if (fainted(me)) return { faint: true, embed: ui.embed().setColor("#ED4245").setTitle("Fainted").setDescription("You have fainted. Drink a potion to recover."), art: "heal" };
    if (me.rpg.hp < 30) return { text: "You need at least 30 HP to enter the dungeon. Current HP: " + me.rpg.hp + "." };
    if (cdLeft(me, "quest", 600000) > 0) return { text: "The dungeon gate is sealed. Return soon." };
    const lvl = levelOf(me.rpg.xp);
    const boss = 40 + lvl * 8 + Math.random() * 25;
    if (powerOf(me) >= boss) {
      const gold = 150 + Math.floor(Math.random() * 201);
      const xp = 40 + Math.floor(Math.random() * 41);
      me.money += gold;
      const g = gainXp(me, xp);
      me.rpg.bosses += 1;
      const dmg = hurt(me, 10 + Math.random() * 20);
      await database.write(db).catch(() => {});
      return { embed: ui.embed().setColor("#57F287").setTitle("Quest — Dungeon Boss slain").setDescription("Grand loot: +" + gold + " money, +" + xp + " XP." + levelLine(g) + " You took " + dmg + " damage."), art: "boss" };
    }
    const dmg = hurt(me, 20 + Math.random() * 16);
    gainXp(me, 5);
    await database.write(db).catch(() => {});
    return { faint: fainted(me), embed: ui.embed().setColor("#ED4245").setTitle("Quest — defeated by the Dungeon Boss").setDescription("You took " + dmg + " damage and retreated with +5 XP." + (fainted(me) ? " You fainted." : "")), art: "boss" };
  },
  async heal(id, name) {
    const db = database.get();
    const me = getU(db, id, name);
    const r = drinkPotion(me);
    if (!r.ok) return { text: r.why };
    await database.write(db).catch(() => {});
    return { embed: ui.embed().setColor("#57F287").setTitle("Healed").setDescription("Restored to " + r.hp + "/" + r.maxHp + " HP. Potions left: " + r.left + "."), art: "heal" };
  },
  async open(id, name) {
    const db = database.get();
    const me = getU(db, id, name);
    if ((me.rpg.crates || 0) <= 0) return { text: "No crates to open. Buy one with /rpg buy first." };
    me.rpg.crates -= 1;
    me.rpg.cratesOpened += 1;
    const result = openCrate(me);
    await database.write(db).catch(() => {});
    return { embed: ui.embed().setColor("#FEE75C").setTitle("Loot Crate Opened").setDescription(result + " Crates left: " + me.rpg.crates + "."), art: "crate", again: me.rpg.crates > 0 };
  },
  async inventory(id, name, targetId, targetName) {
    const db = database.get();
    const u = targetId && targetId !== id ? getU(db, targetId, targetName) : getU(db, id, name);
    const who = targetId && targetId !== id ? (targetName || "Player") : name;
    const pet = u.rpg.pet ? u.rpg.pet.name + " (+" + u.rpg.pet.power + " power, +" + u.rpg.pet.hp + " HP)" : "None";
    const e = ui.embed().setColor("#5865F2").setTitle(who + " — Inventory").addFields(
      { name: "Potions", value: String(u.rpg.potions) + " (restores 60 HP each)", inline: true },
      { name: "Loot Crates", value: String(u.rpg.crates) + " (open with /rpg open)", inline: true },
      { name: "Pet", value: pet, inline: true },
      { name: "Sword", value: "Mk." + u.rpg.sword + " (+" + u.rpg.sword * 5 + " power)", inline: true },
      { name: "Shield", value: "Mk." + u.rpg.shield + " (+" + u.rpg.shield * 8 + " max HP, -" + u.rpg.shield * 3 + " damage)", inline: true }
    );
    await database.write(db).catch(() => {});
    return { embed: e, art: "inventory" };
  },
  async leaderboard() {
    const db = database.get();
    const all = Object.entries(db.discord.users || {}).filter(e => e[1] && e[1].rpg && e[1].rpg.xp > 0).sort((a, b) => b[1].rpg.xp - a[1].rpg.xp).slice(0, 10);
    const desc = all.length ? all.map((e, i) => (i + 1) + ". " + (e[1].name || "<@" + e[0] + ">") + " — Lv." + levelOf(e[1].rpg.xp) + " (" + e[1].rpg.xp + " XP, " + e[1].rpg.wins + "W/" + e[1].rpg.losses + "L)").join("\n") : "No hunters yet. Start with /rpg hunt.";
    return { embed: ui.embed().setColor("#5865F2").setTitle("Top Hunters").setDescription(desc), art: "leaderboard" };
  }
};
const MENU_ROWS = [["daily", "weekly", "work", "beg", "heal"], ["hunt", "fish", "mine", "quest", "open"], ["shop", "profile", "inventory", "leaderboard"]];
const MENU_LABELS = { daily: "Daily", weekly: "Weekly", work: "Work", beg: "Beg", heal: "Heal", hunt: "Hunt", fish: "Fish", mine: "Mine", quest: "Quest", open: "Open", shop: "Shop", profile: "Profile", inventory: "Bag", leaderboard: "Top" };
export default define({
  name: ["rpg"],
  category: "rpg",
  description: "Fantasy RPG with button menu: hunt, fish, mine, duel, shop, pets",
  options: [
    { name: "menu", type: 1, description: "Open the button menu, play without typing" },
    { name: "profile", type: 1, description: "Show character sheet", options: [{ name: "user", type: 6, description: "Character to view", required: false }] },
    { name: "daily", type: 1, description: "Claim daily reward and fully recover" },
    { name: "weekly", type: 1, description: "Claim the grand weekly reward" },
    { name: "work", type: 1, description: "Do a shift for steady pay" },
    { name: "beg", type: 1, description: "Beg for spare coins" },
    { name: "hunt", type: 1, description: "Hunt a wild monster for loot" },
    { name: "fish", type: 1, description: "Fish the misty lake, maybe hook a Golden Fish" },
    { name: "mine", type: 1, description: "Dig the caves for ores and rubies" },
    { name: "quest", type: 1, description: "Face the dungeon boss for grand loot" },
    { name: "duel", type: 1, description: "Challenge a player to a duel (dynamic stake, they accept via button)", options: [{ name: "user", type: 6, description: "Opponent", required: true }] },
    { name: "rob", type: 1, description: "Rob another player, high risk", options: [{ name: "user", type: 6, description: "Target", required: true }] },
    { name: "gift", type: 1, description: "Give money to another player", options: [{ name: "user", type: 6, description: "Recipient", required: true }, { name: "amount", type: 4, description: "Amount (min 10)", required: true, min_value: 10 }] },
    { name: "gamble", type: 1, description: "Flip a coin for double or nothing", options: [{ name: "bet", type: 4, description: "Money to bet (10-1000)", required: true, min_value: 10, max_value: 1000 }] },
    { name: "slots", type: 1, description: "Spin the slot machine", options: [{ name: "bet", type: 4, description: "Money to bet (10-500)", required: true, min_value: 10, max_value: 500 }] },
    { name: "oracle", type: 1, description: "Ask the oracle a yes-or-no question", options: [{ name: "question", type: 3, description: "Your question", required: true }] },
    { name: "fate", type: 1, description: "Let fate choose between two options", options: [{ name: "a", type: 3, description: "First option", required: true }, { name: "b", type: 3, description: "Second option", required: true }] },
    { name: "shop", type: 1, description: "Browse the item shop (buy with buttons, no typing)" },
    { name: "buy", type: 1, description: "Buy items in bulk", options: [{ name: "item", type: 3, description: "Type potion, sword, shield, crate, or egg", required: true, choices: [{ name: "potion", value: "potion" }, { name: "sword", value: "sword" }, { name: "shield", value: "shield" }, { name: "crate", value: "crate" }, { name: "egg", value: "egg" }] }, { name: "amount", type: 4, description: "How many (default 1, max 99)", required: false, min_value: 1, max_value: 99 }] },
    { name: "open", type: 1, description: "Open a loot crate" },
    { name: "inventory", type: 1, description: "Show items, pet, and equipment", options: [{ name: "user", type: 6, description: "Character to view", required: false }] },
    { name: "heal", type: 1, description: "Drink a potion to restore 60 HP" },
    { name: "leaderboard", type: 1, description: "Top 10 hunters by level" }
  ],
  run: async ctx => {
    const interaction = ctx.interaction;
    const client = interaction.client;
    try { await interaction.deferReply(); } catch (e) { return; }
    let sub = "menu";
    try { sub = interaction.options.getSubcommand() || "menu"; } catch (e) {}
    const uid = String(interaction.user.id);
    const uname = interaction.user.username;
    if (!isLinked(uid)) {
      const gate = new client.ebuilder().setColor("#5865F2").setTitle("Link Required").setThumbnail(interaction.user.displayAvatarURL({ size: 256 })).setDescription("Link your Discord account to Akano first to play. Pick your age below (this is your consent to join), then run /rpg again.");
      await interaction.editReply({ embeds: [gate], components: [regPlugin.ageRow(client)] }).catch(() => {});
      return;
    }
    const send = (embed, artName, components) => {
      const files = ui.art(artName, embed);
      return interaction.editReply({ embeds: [embed], files: files, components: components || [] }).catch(() => null);
    };
    const sendRes = async res => {
      if (res.text) {
        await interaction.editReply({ content: res.text }).catch(() => {});
        return null;
      }
      await send(res.embed, res.art);
      return true;
    };
    const freshMsg = async () => {
      try { return await interaction.fetchReply(); } catch (e) { return null; }
    };
    const attachHeal = async (embed, artName, userId) => {
      await send(embed, artName, [ui.row([ui.btn("rpg_heal", "Drink Potion (60 HP)", client.ButtonStyle.Success)])]);
      const msg = await freshMsg();
      if (!msg) return;
      const col = await ui.collect(msg, i => i.customId === "rpg_heal" && i.user.id === userId && !i.user.bot, 120000, ui.strip);
      if (!col) return;
      col.on("collect", async i => {
        const d2 = database.get();
        const u2 = getU(d2, String(i.user.id), i.user.username);
        const r = drinkPotion(u2);
        if (!r.ok) {
          try { await i.reply({ content: r.why, flags: 64 }); } catch (e) {}
          return;
        }
        await database.write(d2).catch(() => {});
        const e2 = ui.embed().setColor("#57F287").setTitle("Healed").setDescription("Restored to " + r.hp + "/" + r.maxHp + " HP. Potions left: " + r.left + ".");
        const files = ui.art("heal", e2);
        try { await i.update({ embeds: [e2], files: files, components: [] }); } catch (e) {}
        try { col.stop(); } catch (e) {}
      });
    };
    const renderMenu = async () => {
      const db = database.get();
      const me = getU(db, uid, uname);
      const cap = maxHp(me);
      const e = ui.embed().setColor("#5865F2").setTitle("Adventure Menu — " + uname).setDescription("Lv." + levelOf(me.rpg.xp) + " " + titleOf(me) + " | " + me.money + " money | HP " + me.rpg.hp + "/" + cap + "\nTap a button to play. No typing needed.");
      const rows = MENU_ROWS.map(ids => ui.row(ids.map(k => ui.btn("rpg_m_" + k, MENU_LABELS[k], client.ButtonStyle.Secondary))));
      await send(e, "profile", rows);
      const msg = await freshMsg();
      if (!msg) return;
      const col = await ui.collect(msg, i => (i.customId.indexOf("rpg_m_") === 0 || i.customId === "rpg_shop_potion" || i.customId === "rpg_shop_sword" || i.customId === "rpg_shop_shield" || i.customId === "rpg_shop_crate" || i.customId === "rpg_shop_egg" || i.customId === "rpg_open_again") && i.user.id === uid && !i.user.bot, 300000, ui.strip);
      if (!col) return;
      const backRow = [ui.row([ui.btn("rpg_m_menu", "Menu", client.ButtonStyle.Secondary)])];
      const showMenu = async i => {
        const d2 = database.get();
        const u2 = getU(d2, uid, uname);
        const cap2 = maxHp(u2);
        const e2 = ui.embed().setColor("#5865F2").setTitle("Adventure Menu — " + uname).setDescription("Lv." + levelOf(u2.rpg.xp) + " " + titleOf(u2) + " | " + u2.money + " money | HP " + u2.rpg.hp + "/" + cap2 + "\nTap a button to play. No typing needed.");
        const files = ui.art("profile", e2);
        try { await i.update({ embeds: [e2], files: files, components: MENU_ROWS.map(ids => ui.row(ids.map(k => ui.btn("rpg_m_" + k, MENU_LABELS[k], client.ButtonStyle.Secondary)))) }); } catch (e3) {}
      };
      const showRes = async (i, res, extraRows) => {
        if (res.text) {
          const e2 = ui.embed().setColor("#99AAB5").setDescription(res.text);
          try { await i.update({ embeds: [e2], components: backRow }); } catch (e3) {}
          return;
        }
        const files = ui.art(res.art, res.embed);
        try { await i.update({ embeds: [res.embed], files: files, components: (extraRows || []).concat(backRow) }); } catch (e3) {}
      };
      col.on("collect", async i => {
        const key = i.customId;
        if (key === "rpg_m_menu") {
          await showMenu(i);
          return;
        }
        if (key.indexOf("rpg_shop_") === 0) {
          const item = key === "rpg_shop_potion" ? "potion" : key === "rpg_shop_sword" ? "sword" : key === "rpg_shop_shield" ? "shield" : key === "rpg_shop_crate" ? "crate" : "egg";
          const d2 = database.get();
          const u2 = getU(d2, uid, uname);
          const r = buyItem(u2, item, 1);
          if (!r.ok) {
            try { await i.reply({ content: r.why, flags: 64 }); } catch (e2) {}
            return;
          }
          await database.write(d2).catch(() => {});
          try { await i.reply({ content: r.text + " Use /rpg buy for bulk amounts.", flags: 64 }); } catch (e2) {}
          return;
        }
        if (key === "rpg_open_again") {
          const res = await ACT.open(uid, uname);
          await showRes(i, res, res.again ? [ui.row([ui.btn("rpg_open_again", "Open Again", client.ButtonStyle.Primary)])] : []);
          return;
        }
        const act = key.replace("rpg_m_", "");
        if (act === "shop") {
          const d2 = database.get();
          const u2 = getU(d2, uid, uname);
          const e2 = ui.embed().setColor("#5865F2").setTitle("Item Shop").setDescription("Balance: " + (u2.money || 0) + " money.").addFields(
            { name: "Potion — " + POTION_COST, value: "Restores 60 HP. You own " + u2.rpg.potions + ".", inline: false },
            { name: "Sword Mk." + (u2.rpg.sword + 1) + (u2.rpg.sword >= 3 ? " (MAX)" : " — " + SWORD_COST[u2.rpg.sword]), value: "+5 power per tier.", inline: false },
            { name: "Shield Mk." + (u2.rpg.shield + 1) + (u2.rpg.shield >= 3 ? " (MAX)" : " — " + SHIELD_COST[u2.rpg.shield]), value: "+8 max HP and -3 damage taken per tier.", inline: false },
            { name: "Loot Crate — " + CRATE_COST, value: "Random loot up to LEGENDARY. You own " + u2.rpg.crates + ".", inline: false },
            { name: "Pet Egg — " + EGG_COST, value: "Hatches a battle pet." + (u2.rpg.pet ? " Current: " + u2.rpg.pet.name + "." : ""), inline: false }
          );
          const files = ui.art("shop", e2);
          try {
            await i.update({ embeds: [e2], files: files, components: [ui.row([ui.btn("rpg_shop_potion", "Potion", client.ButtonStyle.Success), ui.btn("rpg_shop_sword", "Sword", client.ButtonStyle.Primary), ui.btn("rpg_shop_shield", "Shield", client.ButtonStyle.Secondary)]), ui.row([ui.btn("rpg_shop_crate", "Crate", client.ButtonStyle.Primary), ui.btn("rpg_shop_egg", "Egg", client.ButtonStyle.Secondary), ui.btn("rpg_m_menu", "Menu", client.ButtonStyle.Secondary)])] });
          } catch (e2) {}
          return;
        }
        if (!ACT[act]) return;
        const res = await ACT[act](uid, uname);
        await showRes(i, res, res.again ? [ui.row([ui.btn("rpg_open_again", "Open Again", client.ButtonStyle.Primary)])] : []);
      });
    };
    const runShop = async () => {
      const db = database.get();
      const me = getU(db, uid, uname);
      const e = ui.embed().setColor("#5865F2").setTitle("Item Shop").setDescription("Balance: " + (me.money || 0) + " money. Tap a button to buy one, or use /rpg buy for bulk amounts.").addFields(
        { name: "Potion — " + POTION_COST, value: "Restores 60 HP. You own " + me.rpg.potions + ".", inline: false },
        { name: "Sword Mk." + (me.rpg.sword + 1) + (me.rpg.sword >= 3 ? " (MAX)" : " — " + SWORD_COST[me.rpg.sword]), value: "+5 power per tier.", inline: false },
        { name: "Shield Mk." + (me.rpg.shield + 1) + (me.rpg.shield >= 3 ? " (MAX)" : " — " + SHIELD_COST[me.rpg.shield]), value: "+8 max HP and -3 damage taken per tier.", inline: false },
        { name: "Loot Crate — " + CRATE_COST, value: "Random loot up to LEGENDARY. You own " + me.rpg.crates + ".", inline: false },
        { name: "Pet Egg — " + EGG_COST, value: "Hatches a battle pet." + (me.rpg.pet ? " Current: " + me.rpg.pet.name + "." : ""), inline: false }
      );
      await send(e, "shop", [ui.row([ui.btn("rpg_shop_potion", "Potion " + POTION_COST, client.ButtonStyle.Success), ui.btn("rpg_shop_sword", "Sword", client.ButtonStyle.Primary), ui.btn("rpg_shop_shield", "Shield", client.ButtonStyle.Secondary)]), ui.row([ui.btn("rpg_shop_crate", "Crate " + CRATE_COST, client.ButtonStyle.Primary), ui.btn("rpg_shop_egg", "Egg " + EGG_COST, client.ButtonStyle.Secondary)])]);
      const msg = await freshMsg();
      if (!msg) return;
      const col = await ui.collect(msg, i => i.customId.indexOf("rpg_shop_") === 0 && !i.user.bot, 120000, ui.strip);
      if (!col) return;
      col.on("collect", async i => {
        const item = i.customId === "rpg_shop_potion" ? "potion" : i.customId === "rpg_shop_sword" ? "sword" : i.customId === "rpg_shop_shield" ? "shield" : i.customId === "rpg_shop_crate" ? "crate" : "egg";
        if (!isLinked(i.user.id)) {
          try { await i.reply({ content: "Link your Discord account first with /register, then shop.", flags: 64 }); } catch (e2) {}
          return;
        }
        const d2 = database.get();
        const u2 = getU(d2, String(i.user.id), i.user.username);
        const r = buyItem(u2, item, 1);
        if (!r.ok) {
          try { await i.reply({ content: r.why, flags: 64 }); } catch (e2) {}
          return;
        }
        await database.write(d2).catch(() => {});
        try { await i.reply({ content: r.text + " Use /rpg buy for bulk amounts.", flags: 64 }); } catch (e2) {}
      });
    };
    if (sub === "menu") {
      await renderMenu();
      return;
    }
    if (sub === "profile") {
      const target = interaction.options.getUser("user") || interaction.user;
      const res = target.id === uid ? await ACT.profile(uid, uname) : await ACT.profile(uid, uname, String(target.id), target.username);
      await sendRes(res);
      return;
    }
    if (sub === "daily") {
      await sendRes(await ACT.daily(uid, uname, interaction.user.createdTimestamp));
      return;
    }
    if (sub === "weekly") {
      await sendRes(await ACT.weekly(uid, uname));
      return;
    }
    if (sub === "work") {
      await sendRes(await ACT.work(uid, uname));
      return;
    }
    if (sub === "beg") {
      await sendRes(await ACT.beg(uid, uname));
      return;
    }
    if (sub === "hunt") {
      const res = await ACT.hunt(uid, uname);
      if (res.faint) {
        await attachHeal(res.embed, res.art, uid);
        return;
      }
      await sendRes(res);
      return;
    }
    if (sub === "fish") {
      await sendRes(await ACT.fish(uid, uname));
      return;
    }
    if (sub === "mine") {
      await sendRes(await ACT.mine(uid, uname));
      return;
    }
    if (sub === "quest") {
      const res = await ACT.quest(uid, uname);
      if (res.faint) {
        await attachHeal(res.embed, res.art, uid);
        return;
      }
      await sendRes(res);
      return;
    }
    if (sub === "heal") {
      await sendRes(await ACT.heal(uid, uname));
      return;
    }
    if (sub === "open") {
      const res = await ACT.open(uid, uname);
      if (res.text) {
        await interaction.editReply({ content: res.text }).catch(() => {});
        return;
      }
      if (!res.again) {
        await send(res.embed, res.art);
        return;
      }
      await send(res.embed, res.art, [ui.row([ui.btn("rpg_open_again", "Open Again", client.ButtonStyle.Primary)])]);
      const msg = await freshMsg();
      if (!msg) return;
      const col = await ui.collect(msg, i => i.customId === "rpg_open_again" && i.user.id === uid && !i.user.bot, 60000, ui.strip);
      if (!col) return;
      col.on("collect", async i => {
        const res2 = await ACT.open(uid, uname);
        if (res2.text) {
          try { await i.reply({ content: res2.text, flags: 64 }); } catch (e2) {}
          try { col.stop(); } catch (e2) {}
          return;
        }
        const files = ui.art("crate", res2.embed);
        const comps = res2.again ? [ui.row([ui.btn("rpg_open_again", "Open Again", client.ButtonStyle.Primary)])] : [];
        try { await i.update({ embeds: [res2.embed], files: files, components: comps }); } catch (e2) {}
        if (!res2.again) {
          try { col.stop(); } catch (e2) {}
        }
      });
      return;
    }
    if (sub === "inventory") {
      const target = interaction.options.getUser("user") || interaction.user;
      const res = target.id === uid ? await ACT.inventory(uid, uname) : await ACT.inventory(uid, uname, String(target.id), target.username);
      await sendRes(res);
      return;
    }
    if (sub === "leaderboard") {
      await sendRes(await ACT.leaderboard());
      return;
    }
    if (sub === "duel") {
      const db = database.get();
      const me = getU(db, uid, uname);
      const foe = interaction.options.getUser("user");
      if (!foe) {
        await interaction.editReply({ content: "Choose an opponent first." }).catch(() => {});
        return;
      }
      if (foe.id === uid) {
        await interaction.editReply({ content: "You cannot duel yourself." }).catch(() => {});
        return;
      }
      if (foe.bot) {
        await interaction.editReply({ content: "You cannot duel a bot." }).catch(() => {});
        return;
      }
      if (fainted(me)) {
        await interaction.editReply({ content: "You have fainted. Drink a potion (/rpg heal) or claim /rpg daily to recover." }).catch(() => {});
        return;
      }
      if (cdLeft(me, "duel", 30000) > 0) {
        await interaction.editReply({ content: "Catch your breath before the next duel." }).catch(() => {});
        return;
      }
      await database.write(db).catch(() => {});
      if ((me.money || 0) < 50) {
        await interaction.editReply({ content: "Both duelists need at least 50 money for the stake." }).catch(() => {});
        return;
      }
      const en0 = getU(db, String(foe.id), foe.username);
      if (fainted(en0)) {
        await interaction.editReply({ content: foe.username + " has fainted and cannot duel right now." }).catch(() => {});
        return;
      }
      if ((en0.money || 0) < 50) {
        await interaction.editReply({ content: "Both duelists need at least 50 money for the stake." }).catch(() => {});
        return;
      }
      if (Math.abs(levelOf(me.rpg.xp) - levelOf(en0.rpg.xp)) > 5) {
        await interaction.editReply({ content: "Level gap too big for a fair fight." }).catch(() => {});
        return;
      }
      const stake0 = duelStake(me, en0);
      const e = ui.embed().setColor("#FEE75C").setTitle("Duel Challenge").setDescription(uname + " challenges " + foe.username + " to a duel. Stake: " + stake0 + " money. " + foe.username + ", accept within 60 seconds.");
      await send(e, "duel", [ui.row([ui.btn("rpg_duel_yes", "Accept", client.ButtonStyle.Success), ui.btn("rpg_duel_no", "Decline", client.ButtonStyle.Danger)])]);
      const msg = await freshMsg();
      if (!msg) return;
      const col = await ui.collect(msg, i => (i.customId === "rpg_duel_yes" || i.customId === "rpg_duel_no") && i.user.id === foe.id && !i.user.bot, 60000, ui.strip);
      if (!col) return;
      col.on("collect", async i => {
        if (i.customId === "rpg_duel_no") {
          const e2 = ui.embed().setColor("#99AAB5").setTitle("Duel Declined").setDescription(foe.username + " declined the duel.");
          try { await i.update({ embeds: [e2], components: [] }); } catch (e3) {}
          try { col.stop(); } catch (e3) {}
          return;
        }
        const d2 = database.get();
        const p1 = getU(d2, uid, uname);
        const p2 = getU(d2, String(foe.id), foe.username);
        if (!isLinked(String(foe.id))) {
          const e2 = ui.embed().setColor("#ED4245").setTitle("Duel Cancelled").setDescription(foe.username + " must link their account with /register first.");
          try { await i.update({ embeds: [e2], components: [] }); } catch (e3) {}
          try { col.stop(); } catch (e3) {}
          return;
        }
        if (fainted(p1) || fainted(p2) || (p1.money || 0) < 50 || (p2.money || 0) < 50 || Math.abs(levelOf(p1.rpg.xp) - levelOf(p2.rpg.xp)) > 5) {
          const e2 = ui.embed().setColor("#ED4245").setTitle("Duel Cancelled").setDescription("One side can no longer fight (fainted, broke, or level gap too big).");
          try { await i.update({ embeds: [e2], components: [] }); } catch (e3) {}
          try { col.stop(); } catch (e3) {}
          return;
        }
        const myPow = powerOf(p1);
        const foPow = powerOf(p2);
        const iWin = myPow >= foPow;
        const win = iWin ? p1 : p2;
        const lose = iWin ? p2 : p1;
        const stake = duelStake(p1, p2);
        win.money += stake;
        lose.money = Math.max(0, lose.money - stake);
        gainXp(win, 30);
        gainXp(lose, 10);
        win.rpg.wins = (win.rpg.wins || 0) + 1;
        lose.rpg.losses = (lose.rpg.losses || 0) + 1;
        const dmg = hurt(lose, 15 + Math.random() * 11);
        await database.write(d2).catch(() => {});
        const e2 = ui.embed().setColor("#FEE75C").setTitle("Duel — " + uname + " vs " + foe.username).setDescription("Winner: " + (iWin ? uname : foe.username) + " takes the " + stake + " stake. Power " + myPow.toFixed(0) + " vs " + foPow.toFixed(0) + ". Loser took " + dmg + " damage." + (fainted(lose) ? " " + (iWin ? foe.username : uname) + " fainted." : ""));
        const files = ui.art("duel", e2);
        try { await i.update({ embeds: [e2], files: files, components: [] }); } catch (e3) {}
        try { col.stop(); } catch (e3) {}
      });
      return;
    }
    if (sub === "rob") {
      const db = database.get();
      const me = getU(db, uid, uname);
      const target = interaction.options.getUser("user");
      if (!target) {
        await interaction.editReply({ content: "Choose a target first." }).catch(() => {});
        return;
      }
      if (target.id === uid) {
        await interaction.editReply({ content: "You cannot rob yourself." }).catch(() => {});
        return;
      }
      if (target.bot) {
        await interaction.editReply({ content: "You cannot rob a bot." }).catch(() => {});
        return;
      }
      if (fainted(me)) {
        await interaction.editReply({ content: "You have fainted. Recover first." }).catch(() => {});
        return;
      }
      if (cdLeft(me, "rob", 300000) > 0) {
        await interaction.editReply({ content: "Lay low before your next heist." }).catch(() => {});
        return;
      }
      const victim = getU(db, String(target.id), target.username);
      if ((victim.money || 0) < 500) {
        await interaction.editReply({ content: target.username + " does not carry enough money to rob (needs at least 500)." }).catch(() => {});
        return;
      }
      if ((victim.rpg.robShieldUntil || 0) > Date.now()) {
        await interaction.editReply({ content: target.username + " is shielded from robbery. Try again in " + ui.fmtTime(victim.rpg.robShieldUntil - Date.now()) + "." }).catch(() => {});
        return;
      }
      if (Math.random() < 0.55) {
        let loot = Math.round(Math.min(victim.money * (0.10 + Math.random() * 0.15), 500));
        loot = Math.round(loot * (1 - (victim.rpg.shield || 0) * 0.1));
        loot = Math.max(10, Math.min(loot, victim.money));
        victim.money -= loot;
        me.money += loot;
        me.rpg.robs += 1;
        victim.rpg.robShieldUntil = Date.now() + 3600000;
        const g = gainXp(me, 20);
        await database.write(db).catch(() => {});
        await send(ui.embed().setColor("#57F287").setTitle("Heist Successful").setDescription("You stole " + loot + " money from " + target.username + " and gained 20 XP." + levelLine(g)), "rob");
        return;
      }
      if (!Array.isArray(me.rpg.robFails)) me.rpg.robFails = [];
      me.rpg.robFails = me.rpg.robFails.filter(t => Date.now() - t < 86400000);
      const fine = Math.min(me.money || 0, Math.min(500, 50 + 50 * me.rpg.robFails.length));
      me.money = Math.max(0, (me.money || 0) - fine);
      me.rpg.robFails.push(Date.now());
      gainXp(me, 5);
      await database.write(db).catch(() => {});
      await send(ui.embed().setColor("#ED4245").setTitle("Heist Failed").setDescription(target.username + " caught you. You paid a " + fine + " fine and gained 5 XP."), "rob");
      return;
    }
    if (sub === "gift") {
      const db = database.get();
      const me = getU(db, uid, uname);
      const target = interaction.options.getUser("user");
      const amount = interaction.options.getInteger("amount");
      if (!target || !amount) {
        await interaction.editReply({ content: "Choose a recipient and an amount first." }).catch(() => {});
        return;
      }
      if (target.id === uid) {
        await interaction.editReply({ content: "You cannot gift yourself." }).catch(() => {});
        return;
      }
      if (target.bot) {
        await interaction.editReply({ content: "You cannot gift a bot." }).catch(() => {});
        return;
      }
      if (amount < 10) {
        await interaction.editReply({ content: "Minimum gift is 10 money." }).catch(() => {});
        return;
      }
      if ((me.money || 0) < amount) {
        await interaction.editReply({ content: "Not enough money. Balance: " + (me.money || 0) + "." }).catch(() => {});
        return;
      }
      const day = new Date().toISOString().slice(0, 10);
      if (!me.rpg.giftSent || me.rpg.giftSent.day !== day) me.rpg.giftSent = { day: day, total: 0 };
      if (me.rpg.giftSent.total + amount > 3000) {
        await interaction.editReply({ content: "Daily gift limit reached (3000 money per day)." }).catch(() => {});
        return;
      }
      const createdTs = interaction.user.createdTimestamp || 0;
      if (createdTs && Date.now() - createdTs < 604800000) {
        await interaction.editReply({ content: "Your Discord account must be at least 7 days old to send gifts." }).catch(() => {});
        return;
      }
      const net = Math.floor(amount * 0.9);
      const pal = getU(db, String(target.id), target.username);
      me.money -= amount;
      pal.money += net;
      me.rpg.giftSent.total += amount;
      await database.write(db).catch(() => {});
      await send(ui.embed().setColor("#57F287").setTitle("Gift Sent").setDescription(uname + " gave " + amount + " money to " + target.username + " (" + net + " received after 10 percent tax). Balance: " + me.money + "."), "gift");
      return;
    }
    if (sub === "gamble") {
      const db = database.get();
      const me = getU(db, uid, uname);
      const bet = interaction.options.getInteger("bet");
      if (!bet || bet < 10 || bet > 1000) {
        await interaction.editReply({ content: "Bet must be between 10 and 1000." }).catch(() => {});
        return;
      }
      if ((me.money || 0) < bet) {
        await interaction.editReply({ content: "Not enough money. Balance: " + (me.money || 0) + "." }).catch(() => {});
        return;
      }
      const e = ui.embed().setColor("#FEE75C").setTitle("Coin Flip — " + bet + " on the table").setDescription(uname + ", pick a side. Winner takes " + bet * 2 + ".");
      await send(e, "gamble", [ui.row([ui.btn("rpg_gamble_h", "Heads", client.ButtonStyle.Primary), ui.btn("rpg_gamble_t", "Tails", client.ButtonStyle.Secondary)])]);
      const msg = await freshMsg();
      if (!msg) return;
      const col = await ui.collect(msg, i => (i.customId === "rpg_gamble_h" || i.customId === "rpg_gamble_t") && i.user.id === uid && !i.user.bot, 30000, ui.strip);
      if (!col) return;
      col.on("collect", async i => {
        const d2 = database.get();
        const u2 = getU(d2, uid, uname);
        if ((u2.money || 0) < bet) {
          try { await i.reply({ content: "Not enough money anymore. Balance: " + (u2.money || 0) + ".", flags: 64 }); } catch (e2) {}
          try { col.stop(); } catch (e2) {}
          return;
        }
        const flip = Math.random() < 0.5 ? "Heads" : "Tails";
        const pick = i.customId === "rpg_gamble_h" ? "Heads" : "Tails";
        let e2;
        if (pick === flip) {
          u2.money += bet;
          const g = gainXp(u2, 15);
          e2 = ui.embed().setColor("#57F287").setTitle("Coin Flip — " + flip + ", you win").setDescription("+" + bet + " money (balance " + u2.money + "), +15 XP." + levelLine(g));
        } else {
          u2.money = Math.max(0, u2.money - bet);
          e2 = ui.embed().setColor("#ED4245").setTitle("Coin Flip — " + flip + ", you lose").setDescription("-" + bet + " money (balance " + u2.money + ").");
        }
        await database.write(d2).catch(() => {});
        const files = ui.art("gamble", e2);
        try { await i.update({ embeds: [e2], files: files, components: [] }); } catch (e3) {}
        try { col.stop(); } catch (e3) {}
      });
      return;
    }
    if (sub === "slots") {
      const db = database.get();
      const me = getU(db, uid, uname);
      const bet = interaction.options.getInteger("bet");
      if (!bet || bet < 10 || bet > 500) {
        await interaction.editReply({ content: "Bet must be between 10 and 500." }).catch(() => {});
        return;
      }
      if ((me.money || 0) < bet) {
        await interaction.editReply({ content: "Not enough money. Balance: " + (me.money || 0) + "." }).catch(() => {});
        return;
      }
      if (cdLeft(me, "slots", 10000) > 0) {
        await interaction.editReply({ content: "The machine is cooling down. Spin again soon." }).catch(() => {});
        return;
      }
      const S = ["STAR", "BELL", "COIN", "SKULL"];
      const s = [S[Math.floor(Math.random() * S.length)], S[Math.floor(Math.random() * S.length)], S[Math.floor(Math.random() * S.length)]];
      me.money -= bet;
      let e;
      if (s[0] === s[1] && s[1] === s[2]) {
        me.money += bet * 5;
        const g = gainXp(me, 25);
        e = ui.embed().setColor("#57F287").setTitle("Slots — JACKPOT").setDescription("[ " + s.join(" | ") + " ] Triple match. +" + bet * 5 + " money (balance " + me.money + "), +25 XP." + levelLine(g));
      } else if (s[0] === s[1] || s[1] === s[2] || s[0] === s[2]) {
        me.money += bet * 2;
        const g = gainXp(me, 10);
        e = ui.embed().setColor("#57F287").setTitle("Slots — Pair").setDescription("[ " + s.join(" | ") + " ] Pair match. +" + bet * 2 + " money (balance " + me.money + "), +10 XP." + levelLine(g));
      } else {
        e = ui.embed().setColor("#ED4245").setTitle("Slots — No luck").setDescription("[ " + s.join(" | ") + " ] -" + bet + " money (balance " + me.money + ").");
      }
      await database.write(db).catch(() => {});
      await send(e, "slots");
      return;
    }
    if (sub === "oracle") {
      const q = String(interaction.options.getString("question") || "").trim().slice(0, 200);
      const a = ORACLE[Math.floor(Math.random() * ORACLE.length)];
      await send(ui.embed().setColor("#9B59B6").setTitle("Oracle").setDescription("Question: " + q + "\nAnswer: " + a), "oracle");
      return;
    }
    if (sub === "fate") {
      const a = String(interaction.options.getString("a") || "").trim().slice(0, 100);
      const b = String(interaction.options.getString("b") || "").trim().slice(0, 100);
      const pick = Math.random() < 0.5 ? a : b;
      await send(ui.embed().setColor("#9B59B6").setTitle("Fate Decides").setDescription("Between " + a + " and " + b + ", fate chooses " + pick + "."), "quest");
      return;
    }
    if (sub === "shop") {
      await runShop();
      return;
    }
    if (sub === "buy") {
      const db = database.get();
      const me = getU(db, uid, uname);
      const raw = String(interaction.options.getString("item") || "").trim().toLowerCase();
      const qty = interaction.options.getInteger("amount") || 1;
      const item = raw === "potion" || raw === "sword" || raw === "shield" || raw === "crate" || raw === "egg" ? raw : null;
      if (!item) {
        await interaction.editReply({ content: "Unknown item. Pick potion, sword, shield, crate, or egg — or open /rpg shop and tap a button." }).catch(() => {});
        return;
      }
      if (qty < 1 || qty > 99) {
        await interaction.editReply({ content: "Amount must be between 1 and 99." }).catch(() => {});
        return;
      }
      const r = buyItem(me, item, qty);
      if (!r.ok) {
        await interaction.editReply({ content: r.why }).catch(() => {});
        return;
      }
      await database.write(db).catch(() => {});
      await send(ui.embed().setColor("#57F287").setTitle("Purchase Complete").setDescription(r.text), "shop");
      return;
    }
  }
});
