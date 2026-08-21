module.exports = {
  apps: [
    {
      name: "akano-bot",
      script: "main.js",
      cwd: __dirname,
      args: "--all",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      kill_timeout: 8000,
      restart_delay: 3000,
      exp_backoff_restart_delay: 1000,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};