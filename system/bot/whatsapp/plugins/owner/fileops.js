const fs = require("fs").promises;

const path = require("path");

const __orig = {
  reg: true,
  help: [ "savefile", "sf", "delfile", "df" ],
  command: [ "savefile", "sf", "delfile", "df" ],
  tags: [ "owner" ],
  rowner: true,
  run: async (m, {text: text, command: command}) => {
    let filePath = path.resolve(text);
    switch (command) {
     case "savefile":
     case "sf":
      if (!m.quoted || !m.quoted.text) {
        return m.reply("Please reply to the message that contains the JavaScript code.");
      }
      try {
        await fs.writeFile(filePath, m.quoted.text);
        m.reply(`Successfully saved ${filePath} to file!`);
      } catch (err) {
        m.reply(`🚩 Failed to save ${filePath} due to an error: ${err.message}`);
      }
      break;

     case "delfile":
     case "df":
      try {
        await fs.unlink(filePath);
        m.reply(`Successfully deleted ${filePath}!`);
      } catch (err) {
        m.reply(`🚩 Failed to delete ${filePath} due to an error: ${err.message}`);
      }
      break;
    }
  },
  example: "%cmd path/to/file.js"
};

const {define: define} = require("../../../plugin");

module.exports = define({
  name: [ "savefile", "sf", "delfile", "df" ],
  category: "owner",
  help: [ "savefile", "sf", "delfile", "df" ][0] || "",
  rowner: true,
  reg: true,
  example: "%cmd path/to/file.js",
  run: async function(c) {
    return __orig.run.call(__orig, c.m, c.props);
  }
});