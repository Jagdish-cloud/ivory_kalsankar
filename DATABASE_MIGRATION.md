# Database migrations

Prisma migrations in `backend/prisma/migrations` are the **source of truth**. `database/schema.sql` is a local reference dump and may lag.

## New / empty database (local or RDS)

```bash
cd backend
npx prisma migrate deploy
npx prisma generate
```

Optional demo data (local only):

```bash
npm run prisma:seed
```

## Existing local database created from `schema.sql`

If `_prisma_migrations` is missing, baseline then deploy:

```bash
cd backend
npx prisma migrate resolve --applied 20260823195623_init
npx prisma migrate resolve --applied 20260824031444_loosen_lookup_fks
npx prisma migrate resolve --applied 20261014000000_customers_billing
npx prisma migrate resolve --applied 20261025000000_multistore_returns
npx prisma migrate resolve --applied 20261029000000_store_chains
npx prisma migrate resolve --applied 20261103000000_saree_lookups_transfers
npx prisma migrate resolve --applied 20261108120000_documents
npx prisma migrate deploy
```

Only mark a migration applied if its SQL is **already** in the database. If a migration was never applied, skip `resolve` and let `deploy` run it.

## Production (RDS)

```bash
cd backend
npx prisma migrate deploy
```

- Take an RDS snapshot first (see [BACKUP_AND_RECOVERY.md](BACKUP_AND_RECOVERY.md)).
- The `20261108200000_prod_indexes_app_settings` migration is additive: `AppSetting` table + indexes. It does not drop data.
- Do not run `prisma migrate dev` or `prisma db push` on RDS.
- Do not run seed on production.

## Rollback policy

Prisma does not auto-rollback. To undo:

1. Restore the previous RDS snapshot, or
2. Write a new forward migration (preferred) rather than editing old SQL.

Index-only failures can be retried after `DROP INDEX IF EXISTS ...` on the failed index; do not drop business tables.

## Connection pooling

Append to `DATABASE_URL` on RDS:

```
&connection_limit=10&pool_timeout=20&sslmode=require
```

Two PM2 cluster workers × 10 connections ≈ 20. Stay well below RDS `max_connections`.
