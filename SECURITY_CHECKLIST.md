# Security checklist

## Secrets

- [ ] `JWT_SECRET` is unique, ≥ 32 characters, not `change-me-in-production`
- [ ] `DATABASE_URL` is not in git
- [ ] No AWS access keys in `.env` or the frontend bundle
- [ ] SMTP app password is an App Password, not a personal mailbox password in source
- [ ] Seed passwords are not used in production
- [ ] Login form does not prefill credentials (verified)

## Network

- [ ] RDS is not publicly reachable
- [ ] EC2 security group allows 80/443 only from CloudFront / your admin IP as designed
- [ ] CloudFront uses HTTPS; HTTP redirects to HTTPS
- [ ] `CORS_ORIGIN` is the production https origin (comma-separated if needed)
- [ ] `trust proxy` is enabled behind Nginx (already in code)

## Application

- [ ] Helmet headers enabled
- [ ] Login rate limit (20 / 15 min / IP) and global API limit
- [ ] Production 500 responses do not include Prisma/AWS messages
- [ ] Health check does not require auth
- [ ] Static `/uploads` is off in production (`ENABLE_LOCAL_UPLOADS=false`)
- [ ] S3 bucket is private; downloads use 5-minute presigned URLs
- [ ] Document APIs require JWT; shop documents cannot be deleted by another store
- [ ] Super-admin invoice `scope=all` is limited to the current chain

## Auth / session

- [ ] JWT is still stored in `localStorage` (XSS risk). Logout and 401 clear token, store, POS draft, and React Query cache
- [ ] There is no refresh-token rotation or server-side denylist; disable the user (`isActive=false`) to revoke access at next request
- [ ] Cashiers remain powerful by design (existing POS workflow)

## Multi-shop model (by design, not a bug)

- Customers and lookups are shared across stores and chains
- Stock in a chain is visible to other branches
- Cross-store barcode billing is allowed
- Returns lookup can find invoices across stores (needed for cross-store returns)

Users from one **chain** should not see the other chain's invoices when using `scope=all`. Report APIs already filter by current chain.

## Logging

- [ ] Passwords, tokens, `Authorization`, and AWS keys are not logged
- [ ] CloudWatch (or PM2 files) retain application JSON logs
