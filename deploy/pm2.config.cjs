const path = require("path");

module.exports = {
  apps: [
    {
      name: "akano-bot",
      script: "main.js",
      cwd: path.join(__dirname, ".."),
      args: "--all",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "600M",
      kill_timeout: 8000,
      listen_timeout: 5000,
      min_uptime: 10000,
      restart_delay: 3000,
      exp_backoff_restart_delay: 1000,
      max_restarts: 20,
      node_args: "--expose-gc --max-old-space-size=512 --optimize-for-size --gc-interval=50 --max-semi-space-size=16",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
