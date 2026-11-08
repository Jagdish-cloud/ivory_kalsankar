# Production testing

No automated test suite ships with this app. Do not claim a concurrent-user number until you have measured it.

## Local smoke (required before calling a build "ready")

Backend:

```bash
cd backend
npm run build
npx prisma migrate deploy
npm start
curl -sS http://127.0.0.1:4100/api/health
```

`db` must be `"up"`. `s3` may be `"skipped"` if `S3_BUCKET` is empty, `"ok"` if credentials work, `"error"` if the bucket/IAM is wrong (API still starts).

Frontend:

```bash
cd frontend
npm run build
```

Manual UI (dev server or `vite preview` behind a proxy to the API):

1. Sign in (empty login fields — use a real seeded user)
2. Inventory list loads; a failed API shows an error, not a blank table
3. Open Billing; confirm protected route bounce when logged out
4. Browser refresh on `/inventory/stock-overview` works on Vite; on CloudFront it requires the SPA 403/404 → `index.html` rule
5. Logout clears the session (next page load is the login screen)

S3 (only if local AWS CLI credentials can use the bucket):

- Upload a product image in Add SKU
- Confirm a presigned URL opens the image
- Delete is exercised when a saree/product image is removed

## Business workflows to click through on staging

- Inventory: add SKU, stock overview, out of stock
- POS: scan, pay, print/email bill
- Invoice cancel (restores stock)
- Customer create + lookup on the bill
- Return / exchange + manager verification
- Transfer draft → dispatch → receive
- Reports date range
- Super admin store switch (`X-Store-Id`)

Do **not** change GST, loyalty, or split-bill math unless a defect is proven.

## Load testing recommendations (not executed here)

Target of **up to 300 concurrent users** is a goal, not a measured capacity.

Suggested k6 scenario against staging (never against production POS hours):

```js
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "2m", target: 50 },
    { duration: "5m", target: 150 },
    { duration: "5m", target: 300 },
    { duration: "2m", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<800"],
  },
};

export default function () {
  const res = http.get(`${__ENV.BASE_URL}/api/health`);
  check(res, { "health 200": (r) => r.status === 200 });
  sleep(1);
}
```

Add authenticated inventory list + checkout only on a disposable staging database.

Watch: RDS CPU and `DatabaseConnections`, EC2 CPU/memory, PM2 restarts, p95 `/api/billing/invoices` and `/api/inventory/products`, S3 4xx/5xx.

Likely bottlenecks before 300 users: in-memory inventory pagination, Prisma pool exhaustion, office NAT sharing one rate-limit IP, large bill-image JSON posts.
