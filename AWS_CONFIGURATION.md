# AWS configuration

Nothing in this repository creates AWS resources. Use this as a checklist when you provision them.

Recommended region: **ap-south-1** (except ACM for CloudFront, which must be **us-east-1**).

## Network

- VPC with public subnet (EC2, optional NAT) and private subnet (RDS).
- Security groups:
  - **ALB/CloudFront → EC2:** TCP 80 (and 443 if Nginx terminates TLS).
  - **EC2 → RDS:** TCP 5432 from the EC2 security group only.
  - **RDS:** no public access.
- EC2: Amazon Linux 2023, Node.js 20, Nginx, PM2 (`npm i -g pm2`).

## RDS PostgreSQL

- Engine: PostgreSQL 16.
- Instance size: start with `db.t3.small` (or larger after load tests). Do not size for 300 concurrent users without measuring.
- Multi-AZ: recommended for production.
- Parameter: require SSL. Connection string includes `sslmode=require`.
- `max_connections`: leave headroom. Two PM2 instances × `connection_limit=10` ≈ 20 app connections, plus migrations and admin.

`DATABASE_URL` example (placeholder values):

```
postgresql://appuser:PASSWORD@ivory-lace.xxxxx.ap-south-1.rds.amazonaws.com:5432/ivory_lace?schema=public&connection_limit=10&pool_timeout=20&sslmode=require
```

## S3 — documents (private)

- Bucket: `inventory-billing-prod-documents-2026`
- Region: `ap-south-1`
- Block all public access: **on**
- Versioning: **on**
- Default encryption: SSE-S3 (AES-256) or SSE-KMS
- Attach `deploy/iam-s3-policy.json.example` to the **EC2 instance role**
- Do not put `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` on the instance

The SDK uses the default provider chain (instance role on EC2, `aws configure` locally).

## S3 — frontend hosting

- Separate bucket for `frontend/dist`
- Not public if you use CloudFront Origin Access Control (preferred)
- Default root object on the distribution: `index.html`

## CloudFront + ACM + Route 53

- ACM certificate for `app.example.com` in **us-east-1**
- Distribution: S3 origin (default) + EC2/Nginx origin (`/api*`)
- Custom errors 403 and 404 → `/index.html` response **200**
- Full behavior table: `deploy/cloudfront-behaviors.md`
- Route 53 alias A/AAAA → CloudFront distribution

`APP_PUBLIC_URL` and `CORS_ORIGIN` must be the public https origin, e.g. `https://app.example.com`. Invoice QR codes use `APP_PUBLIC_URL`.

## IAM role (EC2)

Minimum:

- The S3 document policy in `deploy/iam-s3-policy.json.example`
- Optional: `cloudwatch:PutLogEvents` if you use the CloudWatch agent

No console users need application AWS keys.

## CloudWatch

PM2 writes JSON logs to stdout and `logs/api-*.log`. Install the CloudWatch agent (or pipe journald) with a log group such as `/ivory-lace/api`. The app does not call CloudWatch APIs directly.

## SMTP

The app still uses SMTP (Gmail App Password or another provider). AWS SES is not wired in. Keep `SMTP_*` on the EC2 env file.
