// pm2 설정 — EC2에서: npm ci && npx prisma migrate deploy && npm run build && pm2 start ecosystem.config.cjs
module.exports = {
  apps: [{
    name: 'localstride-api',
    script: 'dist/index.js',
    instances: 1,
    autorestart: true,
    max_memory_restart: '400M',
    env: { NODE_ENV: 'production', PORT: 4000 },
  }],
};
