console.log("Panel ready. Enter your command.");
require("child_process").spawn("bash", [], {
  stdio: ["inherit", "inherit", "inherit", "ipc"],
});
