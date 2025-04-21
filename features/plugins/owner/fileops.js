const fs = require("fs").promises;
const path = require("path");

module.exports = {
  help: ["savefile", "sf", "delfile", "df"],
  command: ["savefile", "sf", "delfile", "df"],
  tags: ["owner"],
  rowner: true,
  run: async (m, { text, command }) => {
    let filePath = path.resolve(text);

    switch (command) {
      case "savefile":
      case "sf":
        if (!m.quoted || !m.quoted.text) {
          return m.reply(
            "Please reply to the message that contains the JavaScript code.",
          );
        }
        try {
          await fs.writeFile(filePath, m.quoted.text);
          m.reply(`Successfully saved ${filePath} to file!`);
        } catch (err) {
          m.reply(`Failed to save ${filePath} due to an error: ${err.message}`);
        }
        break;

      case "delfile":
      case "df":
        try {
          await fs.unlink(filePath);
          m.reply(`Successfully deleted ${filePath}!`);
        } catch (err) {
          m.reply(
            `Failed to delete ${filePath} due to an error: ${err.message}`,
          );
        }
        break;
    }
  },
  example: "%cmd path/to/file.js",
};
