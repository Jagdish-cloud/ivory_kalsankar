# Production readiness report

**Classification: Deployment Ready with Known Limitations**

This is preparation, not an AWS deploy. No CloudFormation/Terraform was applied. No production data was deleted.

## 1. Initial application audit

See [AUDIT.md](AUDIT.md). Summary: Express 5 + Prisma 6 + React 19 SPA. Two chains share one database. S3 document storage already used AWS SDK v3. Dashboard, Purchases, and Expenses were placeholders.

## 2. Issues identified

Blockers that were fixed: health check without DB, no graceful shutdown, GSTIN written to `.env` on disk, missing Helmet/rate limits/logs/timeouts, 500s leaking internals, demo passwords on the login form, prod S3 bucket as a code default, no PM2/Nginx/env templates, Prisma not used as the production migrate path.

Should-fix items that were addressed: missing indexes, low-stock full-table scan, logout cache/PII, list error states, super-admin invoice `scope=all` crossing chains, public `/uploads` in production, single JS bundle, undebounced inventory search.

## 3. Changes implemented

- Environment separation (`NODE_ENV`, `.env.{NODE_ENV}`, production secret checks, `AWS_S3_BUCKET` alias, comma-separated CORS)
- Helmet, `trust proxy`, rate limits, request timeout, pino JSON logs, safe production 500s
- `GET /api/health` probes PostgreSQL (503 if down); S3 is reported without failing the process
- Graceful SIGINT/SIGTERM; cron only on PM2 instance 0
- Company GSTIN stored in `AppSetting` (no runtime `.env` writes)
- Additive indexes; low-stock filter in SQL
- Frontend: empty login, `VITE_API_BASE_URL`, logout clears token/store/POS draft/query cache, ErrorBoundary, lazy routes, debounce, upload Content-Type fix, list error states
- `deploy/` PM2, Nginx, IAM, CloudFront notes
- Operational documentation listed below

## 4. Files created or modified

Created: `AUDIT.md`, env examples, `deploy/*`, operational markdown docs, `backend/src/config/logger.ts`, health/rate-limit/timeout/request-log middleware, Prisma migration `20261108200000_prod_indexes_app_settings`, frontend `.env.development` / `.env.production`, `ErrorBoundary`.

Modified: backend `app.ts`, `index.ts`, `env.ts`, `errorHandler.ts`, Prisma schema, GSTIN helper, S3/mailer/scheduler/documents, settings/stores/billing controllers, seed (no password print), frontend auth/API/routes/login/inventory/transfers/admin/returns pages, `.gitignore`, `README.md`.

## 5. Database changes

Additive migration only:

- Table `AppSetting` (`key`, `value`, `updatedAt`)
- Indexes: `User.storeId`, `Product.brandId`, `Product.categoryId`, `ProductImage.productId`, `VariantStock.storeId`, `Customer.storeId`, `Invoice.userId`, `StockMovement.storeId`, `ReturnExchange.billedAtStoreId`, `CreditNote.billedAtStoreId`

No tables or business rows were dropped. Local database was **baselined** (it was created from `schema.sql` with no `_prisma_migrations`) then `20261108200000_prod_indexes_app_settings` was applied successfully.

## 6. Security improvements

- Login form no longer ships demo credentials (confirmed absent from `frontend/dist`)
- Production JWT secret strength check; no personal-email / prod-bucket code defaults
- Helmet headers; login and upload rate limits; CORS allow-list
- Production 500 body is generic; Zod no longer returns raw issue objects
- Logs redact tokens/passwords; mail failures do not echo SMTP text in production
- Super-admin invoice `scope=all` limited to the current chain
- `/uploads` static files off unless `ENABLE_LOCAL_UPLOADS=true`
- Document access still JWT + shop/org rules; S3 stays private + presigned GET

Not changed (by design / out of scope): JWT in `localStorage`, shared customers, cashier powers, Gmail SMTP.

## 7. Performance improvements

- Route-level code splitting: main JS **391 KB** (gzip **125 KB**) vs previous single ~717 KB chunk
- Low-stock report filters in SQL instead of loading all `VariantStock` rows
- Indexes for store-scoped queries
- Debounced inventory/out-of-stock/transfer search
- Prisma `connection_limit` documented for RDS (not hardcoded)

Inventory/out-of-stock list pagination is still computed in Node after loading matching products. That remains a limitation.

## 8. Build and test results

| Check | Result |
|---|---|
| `backend` `npm run build` | Success |
| `frontend` `npm run build` | Success; lazy chunks emitted |
| `prisma migrate deploy` (after baseline) | Applied `20261108200000_prod_indexes_app_settings` |
| `GET /api/health` | HTTP 200 `{ status: "degraded", db: "up", s3: "error", ... }` |
| `POST /api/auth/login` bad password | HTTP 401 `Invalid email or password` |
| `GET /api/inventory/products` no token | HTTP 401 |
| Login page in browser | Empty email/password; layout unchanged |
| `/inventory/stock-overview` logged out | Redirects to `/login` |

S3 `error` on health: local AWS credentials could not `HeadBucket` the configured bucket. **Upload/download/IAM were not proven in this pass.** Do that on staging with the EC2 role before go-live.

POS checkout, returns, and transfers were not end-to-end clicked after these changes. Business calculation code was not modified.

No load test was run. Do not treat 300 concurrent users as a measured capacity.

## 9. Remaining issues

- Dashboard, Purchases, Expenses not implemented
- Shared customers / lookups / cross-store POS (intentional)
- JWT in `localStorage` (XSS); no refresh tokens
- Cashiers nearly as powerful as managers
- Inventory list still paginates in memory
- SMTP is still Gmail-style, not SES
- No automated unit/integration suite
- Health `s3` failed in this environment
- Existing local `.env` still contains real mailbox-related values; rotate anything that was ever committed or shared

## 10. AWS deployment prerequisites

1. VPC, EC2 (Node 20 + Nginx + PM2), private RDS PostgreSQL, ACM (us-east-1 for CloudFront), Route 53, two S3 buckets (SPA + private documents)
2. EC2 instance role with `deploy/iam-s3-policy.json.example`
3. Strong `JWT_SECRET`, RDS `DATABASE_URL` with `sslmode=require` and `connection_limit=10`
4. `CORS_ORIGIN` / `APP_PUBLIC_URL` = `https://app.example.com`
5. `S3_BUCKET=inventory-billing-prod-documents-2026`, `AWS_REGION=ap-south-1`
6. CloudFront: `/api*` → EC2, default → S3, 403/404 → `/index.html` 200, forward `Authorization` and `X-Store-Id`
7. `npx prisma migrate deploy` on RDS **after a snapshot**
8. Staging smoke of S3 upload/download with the instance role
9. Optional k6 against staging ([PRODUCTION_TESTING.md](PRODUCTION_TESTING.md))

Follow [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) and [AWS_CONFIGURATION.md](AWS_CONFIGURATION.md). Do not run seed against production.
