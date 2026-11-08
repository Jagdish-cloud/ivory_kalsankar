# Environment variables

Secrets stay on the server (or in a secrets manager). They are never committed. Frontend variables must be public (`VITE_*` is inlined into the JS bundle).

## Loading order (backend)

1. `.env.{NODE_ENV}` if the file exists (`.env.development` or `.env.production`)
2. `.env` (does not override values already set)

Templates:

- `backend/.env.example`
- `backend/.env.development.example`
- `backend/.env.production.example`

Copy an example to `.env` or `.env.production` on the machine. Git ignores those files.

## Backend

| Name | Required | Notes |
|---|---|---|
| `NODE_ENV` | production: yes | `development` / `production` |
| `DATABASE_URL` | yes | Prisma + pool params on RDS |
| `JWT_SECRET` | yes | Production: ≥ 32 chars, not the example value |
| `JWT_EXPIRES_IN` | no | Default `7d` |
| `PORT` | no | Default `4100` |
| `CORS_ORIGIN` | production: yes | Comma-separated browser origins |
| `APP_PUBLIC_URL` | production: yes | Invoice QR base URL, no trailing slash |
| `LOG_LEVEL` | no | `debug` (dev) / `info` (prod) |
| `REQUEST_TIMEOUT_MS` | no | Default `90000` |
| `ENABLE_LOCAL_UPLOADS` | no | `true` only for legacy local `/uploads` |
| `APP_GSTIN` | no | One-time fallback; runtime value lives in `AppSetting` |
| `SEED_*` | no | Local seed only; do not use on production |
| `SMTP_HOST` / `PORT` / `SECURE` / `USER` / `PASS` | no | Empty host disables mail |
| `EMAIL_FROM` | no | |
| `DEFAULT_EMAIL_RECIPIENT` | no | Used by seed only |
| `LOW_STOCK_CRON` | no | Default `0 21 * * *` |
| `CRON_TZ` | no | Default `Asia/Kolkata` |
| `AWS_REGION` | no | Default `ap-south-1` |
| `S3_BUCKET` or `AWS_S3_BUCKET` | production: yes | Private documents bucket |
| `S3_DOCUMENTS_PREFIX` | no | Default `documents/` |

Do **not** set `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` in app env files.

## Frontend

| Name | Required | Notes |
|---|---|---|
| `VITE_API_BASE_URL` | no | Default `/api`. Same-origin via CloudFront. |

Files: `frontend/.env.development`, `frontend/.env.production`, `frontend/.env.example`.

Never put database URLs, JWT secrets, SMTP passwords, or AWS keys in frontend env files.
