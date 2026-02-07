module.exports = {
  apps: [
    {
      name: "mc-relay",
      script: "npx",
      args: "tsx server.ts",
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "100M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
