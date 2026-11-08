/** PM2 process file. Copy to the EC2 app directory and run: pm2 start deploy/ecosystem.config.cjs */
module.exports = {
  apps: [
    {
      name: "ivory-lace-api",
      cwd: "./backend",
      script: "dist/index.js",
      instances: 2,
      exec_mode: "cluster",
      watch: false,
      max_memory_restart: "500M",
      kill_timeout: 12000,
      listen_timeout: 8000,
      env: {
        NODE_ENV: "production",
      },
      error_file: "../logs/api-error.log",
      out_file: "../logs/api-out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
