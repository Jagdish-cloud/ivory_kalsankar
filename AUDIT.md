# Application audit — Ivory Lace / Kalsankar OS

Baseline captured before AWS production-readiness changes. This is a store-management app (inventory, POS billing, customers, returns, transfers, reports, documents), not a greenfield rewrite.

## Architecture

- **Frontend:** React 19 + TypeScript + Vite 8, Tailwind CSS 4, React Router 7, TanStack Query 5, Axios. Entry: `frontend/src/main.tsx`. Routes: `frontend/src/routes/appRoutes.tsx`.
- **Backend:** Node.js + Express 5 + TypeScript, Prisma 6, JWT (HS256), Zod, Multer, AWS SDK v3 S3, Nodemailer, node-cron. Entry: `backend/src/index.ts`, app: `backend/src/app.ts`.
- **Database:** PostgreSQL via Prisma. Dual history: `backend/prisma/migrations` and a hand-maintained `database/schema.sql` (the SQL file lags Prisma and is not the production path).
- **Isolation model (by design):** two chains (`IVORY_LACE`, `KALSANKAR_OS`) share one database. Stock and invoices are per store. Customers and lookups are shared. Cashiers can bill another store’s barcode (cross-store POS). This is not per-shop multi-tenancy.

## What works

Authentication, inventory (including sarees), POS checkout with GST/split bills, customers, returns/exchanges, transfers, reports, settings (GSTIN + email recipients), S3 document storage with presigned GET URLs, nightly low-stock email.

## Not implemented (product, not deploy blockers)

- Dashboard (`/dashboard`) and Purchases (`/purchases`) are placeholder pages.
- Expense and Purchase Order exist only as `DocumentEntityType` / S3 folder names.

## API surface

Public: `GET /api/health`, `POST /api/auth/login`. All other `/api/*` routes require JWT. Super-admin-only: stores CRUD, users CRUD, settings, email recipients, product delete, low-stock send. Manager/super-admin: verification batches, return verification.

## Findings (pre-change)

### Blockers for AWS

1. Health check does not probe PostgreSQL.
2. No graceful shutdown on SIGTERM (PM2/EC2 will kill in-flight checkouts).
3. Settings writes `APP_GSTIN` into `backend/.env` at runtime — fails under PM2, multiple instances, or read-only disks.
4. No Helmet, rate limiting, `trust proxy`, request timeout, or structured logs.
5. 500 responses return raw `err.message` (Prisma/AWS internals).
6. Login form ships demo credentials; seed passwords and a personal Gmail address are code defaults.
7. Production S3 bucket name is the code default.
8. README documents hand-applied `schema.sql`; AWS needs `prisma migrate deploy`.
9. No PM2, Nginx, or production env templates.

### Should-fix

- Missing indexes on `User.storeId`, `Customer.storeId`, `StockMovement.storeId`, `Product.brandId`/`categoryId`, `ProductImage.productId`, `ReturnExchange.billedAtStoreId`, `CreditNote.billedAtStoreId`, `Invoice.userId`.
- Low-stock job loads every `VariantStock` row then filters in JavaScript.
- Inventory/out-of-stock lists load matching products then paginate in memory.
- Logout does not clear React Query cache or POS draft (customer PII).
- Inventory, out-of-stock, transfers, users, stores, verification queue lack error states.
- Super-admin invoice `scope=all` ignores chain (reports already scope to current chain).
- Unauthenticated static `/uploads`.
- Single ~717 KB JS bundle; inventory search is not debounced.

### Security notes (preserved unless listed as a fix)

- JWT in `localStorage` (XSS = session theft). Cookie rewrite is out of scope.
- Cashiers can create products, cancel invoices, and mutate shared lookups (existing workflow).
- Customers and returns lookup are global across stores/chains (existing workflow).
- Prisma parameterizes queries; Zod validates mutating routes. No raw SQL concatenation found in `backend/src`.

## Out of scope for this production-readiness pass

- Building Dashboard, Purchases, or Expenses.
- Changing shared customers, shared lookups, or cross-store billing.
- UI redesign, JWT cookie migration, AWS SES, load testing, or an actual AWS deploy.
