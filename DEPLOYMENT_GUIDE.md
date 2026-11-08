# Deployment guide

Do not run these against AWS from a developer laptop until the infrastructure in [AWS_CONFIGURATION.md](AWS_CONFIGURATION.md) exists. This guide is the runbook for EC2 + CloudFront.

## 1. Build artifacts

### Frontend (upload `frontend/dist` to the SPA S3 bucket)

```bash
cd frontend
npm ci
npm run build
```

Output: `frontend/dist/` (`index.html` + hashed `/assets`).

`VITE_API_BASE_URL` must be `/api` so the SPA talks to the same CloudFront hostname.

### Backend (copy the `backend` folder to EC2, or rsync `dist` + `prisma` + `package.json`)

```bash
cd backend
npm ci
npx prisma generate
npm run build
```

Output: `backend/dist/`. Start with `node dist/index.js` or PM2.

## 2. Environment on EC2

```bash
cd backend
cp .env.production.example .env.production
# Edit secrets: DATABASE_URL, JWT_SECRET, CORS_ORIGIN, APP_PUBLIC_URL, S3_BUCKET, SMTP_*
# NODE_ENV=production
```

See [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md). Never commit the filled file.

## 3. Database migration

On EC2, with `DATABASE_URL` pointing at RDS:

```bash
cd backend
npx prisma migrate deploy
```

Details and baselining: [DATABASE_MIGRATION.md](DATABASE_MIGRATION.md).

Do **not** run `prisma migrate dev` or `prisma db seed` against production unless you explicitly want demo users.

## 4. PM2

From the repository root on EC2:

```bash
mkdir -p logs
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup
```

The app listens on `PORT` (default 4100). Cluster mode starts two Node processes. The low-stock cron runs only on PM2 instance `0`.

Restart:

```bash
pm2 reload ivory-lace-api
```

If reload hangs:

```bash
pm2 restart ivory-lace-api
```

Logs (stdout JSON, CloudWatch-friendly):

```bash
pm2 logs ivory-lace-api
```

## 5. Nginx

```bash
sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/ivory-lace
# Edit server_name
sudo ln -s /etc/nginx/sites-available/ivory-lace /etc/nginx/sites-enabled/ivory-lace
sudo nginx -t && sudo systemctl reload nginx
```

Nginx proxies `/api/` to `127.0.0.1:4100`. The SPA is **not** served by Nginx; CloudFront serves it from S3.

## 6. Frontend publish

```bash
aws s3 sync frontend/dist/ s3://YOUR_FRONTEND_BUCKET/ --delete
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

SPA 403/404 → `/index.html` 200: see `deploy/cloudfront-behaviors.md`.

## 7. Health check

```bash
curl -sS http://127.0.0.1:4100/api/health
curl -sS https://app.example.com/api/health
```

Expected JSON:

```json
{ "status": "ok", "db": "up", "s3": "ok", "uptime": 12, "timestamp": "..." }
```

- HTTP **200** if the database is up (`status` may be `degraded` if S3 fails).
- HTTP **503** if PostgreSQL is down (`db: "down"`).

## 8. Restart and recovery

| Event | Action |
|---|---|
| API process crash | PM2 restarts automatically |
| Deploy new backend | `npm run build` then `pm2 reload ivory-lace-api` |
| RDS failover | API reconnects via Prisma; if health stays 503, restart PM2 |
| Host reboot | `pm2 startup` + `pm2 save` bring the process back |
| Bad release | Keep previous `backend/dist` and `pm2 reload` after restoring it |

Graceful shutdown: SIGINT/SIGTERM stop the cron, close HTTP, disconnect Prisma (about 10 seconds).
