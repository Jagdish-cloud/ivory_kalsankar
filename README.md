# Ivory Lace / Kalsankar OS — Store Management

Inventory, billing (POS), customers, returns, transfers, reports, and document storage for two branded chains sharing one company database.

This repository is prepared for AWS production (EC2 + RDS + S3 + CloudFront). It is **not** deployed from this codebase automatically.

## Tech stack

- **Frontend:** React 19, TypeScript, Vite 8, Tailwind CSS 4, React Router 7, TanStack Query, Axios
- **Backend:** Node.js, Express 5, TypeScript, Prisma 6, JWT, Zod, AWS SDK v3 (S3)
- **Database:** PostgreSQL
- **Documents:** Private S3 bucket, metadata in PostgreSQL, 5-minute presigned download URLs

## Project layout

```
Ivory Lace/
  backend/     Express API (TypeScript, Prisma)
  frontend/    React SPA (Vite)
  deploy/      PM2, Nginx, IAM, CloudFront examples
  database/    Reference SQL (Prisma migrations are the source of truth)
```

## Implemented modules

- Authentication (JWT) and roles: Super Admin, Manager, Cashier
- Inventory (lingerie + sarees), barcode labels, physical verification
- Billing / POS, invoices, QR lookup
- Customers
- Returns / exchanges / credit notes
- Inter-store transfers
- Reports
- Settings (company GSTIN, email recipients)
- Document upload to S3

## Not implemented (known limitations)

- Dashboard analytics (`/dashboard` is a placeholder)
- Purchases and Expenses (nav placeholders; S3 folders exist only)

Isolation is **store + chain**, not per-shop tenancy. Customers and lookups are shared. Cross-store barcode billing is intentional.

## Local development

Prerequisites: Node.js 18+ and PostgreSQL.

```bash
createdb -U postgres ivory_lace

cd backend
npm install
copy .env.example .env          # Windows; or cp .env.example .env
# Set DATABASE_URL, JWT_SECRET, and optional S3_BUCKET
npx prisma migrate deploy
npm run prisma:generate
npm run prisma:seed
npm run dev                     # http://localhost:4100

cd ../frontend
npm install
npm run dev                     # http://localhost:5173
```

The Vite dev server proxies `/api` to port 4100. Frontend env: `VITE_API_BASE_URL=/api` (see `frontend/.env.development`).

S3: run `aws configure` locally. Do not put AWS access keys in `.env`. Production uses an EC2 instance role.

## Production docs

- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
- [AWS_CONFIGURATION.md](AWS_CONFIGURATION.md)
- [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md)
- [DATABASE_MIGRATION.md](DATABASE_MIGRATION.md)
- [SECURITY_CHECKLIST.md](SECURITY_CHECKLIST.md)
- [PRODUCTION_TESTING.md](PRODUCTION_TESTING.md)
- [BACKUP_AND_RECOVERY.md](BACKUP_AND_RECOVERY.md)
- [AUDIT.md](AUDIT.md)
- [PRODUCTION_READINESS_REPORT.md](PRODUCTION_READINESS_REPORT.md)

## Useful backend scripts

```bash
cd backend
npm run build
npm start
npm run prisma:migrate:deploy
npm run prisma:studio
npm run test:low-stock:dry
```
