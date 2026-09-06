/*
 * Configuration PM2 pour un VPS :  pm2 start ecosystem.config.js
 *
 * Un seul processus Node, qui lance lui-même DOJO_WORKERS workers (node:cluster).
 * Adapte DOJO_ALT_ORIGIN au second nom de domaine servi par ton reverse proxy
 * (nécessaire au défi 15, CORS) et fixe DOJO_SECRET une fois pour toutes.
 */
module.exports = {
  apps: [{
    name: 'debug-frontend',
    script: 'server.js',
    cwd: __dirname,
    instances: 1,
    exec_mode: 'fork',
    max_memory_restart: '400M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      DOJO_WORKERS: 2,
      DOJO_QUIET: 1
      // DOJO_SECRET: 'une-longue-chaine-aleatoire',
      // DOJO_ALT_ORIGIN: 'https://replica.debug.example.com',
      // DOJO_DB_FILE: '/var/lib/debug-frontend/dojo.sqlite'
    }
  }]
};
