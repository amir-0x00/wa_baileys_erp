module.exports = {
  apps: [
    {
      name: 'wa-baileys-erp',
      script: 'dist/index.js', // Built JavaScript file
      cwd: './',
      instances: 1,
      autorestart: true,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
      // PM2 will handle logging
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // Restart on file changes (for development)
      watch: false, // Disabled by default, enable for development
      ignore_watch: ['node_modules', 'logs', 'uploads', 'auth_info_baileys'],
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      // Auto restart on crash
      max_restarts: 10,
      min_uptime: '10s',
    },
  ],
};
