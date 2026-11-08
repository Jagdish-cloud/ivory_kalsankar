# Backup and recovery

## PostgreSQL (RDS)

- Enable **automated backups** (retain at least 7 days; 30 days is better).
- Take a **manual snapshot** before every `prisma migrate deploy` on production.
- Point-in-time recovery: restore to a new instance, update `DATABASE_URL`, `pm2 reload ivory-lace-api`.

Local dump (admin machine, never commit the file):

```bash
pg_dump -h YOUR_RDS_HOST -U appuser -d ivory_lace -Fc -f ivory_lace.dump
pg_restore -h YOUR_RDS_HOST -U appuser -d ivory_lace --clean --if-exists ivory_lace.dump
```

`--clean` is destructive. Use it only on a replacement database.

## S3 documents

- Turn **versioning** on for `inventory-billing-prod-documents-2026`.
- Optional: lifecycle rule to expire noncurrent versions after 90 days.
- Metadata lives in PostgreSQL (`Document`). Restoring RDS without S3 (or the reverse) leaves orphan files or dead rows. Restore both to the same point when possible.

Download a single object for support (authorized machine):

```bash
aws s3 cp s3://inventory-billing-prod-documents-2026/documents/shops/... ./file --region ap-south-1
```

## Application host

- Keep `backend/.env.production` in a secrets manager or encrypted volume, not only on the instance.
- After EC2 replacement: install Node 20, Nginx, PM2; copy env; `npm ci --omit=dev`; `npx prisma generate`; `npm run build` or copy `dist`; `pm2 start deploy/ecosystem.config.cjs`.

## Recovery order

1. Restore RDS (or confirm it is healthy): `curl /api/health` → `db: "up"`
2. Confirm instance role can `HeadBucket` the documents bucket (`s3` in health)
3. `pm2 reload ivory-lace-api`
4. CloudFront invalidation if the SPA was also rolled back
