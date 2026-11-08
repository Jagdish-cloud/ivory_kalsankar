# CloudFront behaviors (SPA + API)

Attach an ACM certificate in **us-east-1** to the distribution. Alternate domain name: `app.example.com`.

## Origins

1. **S3 frontend** — the bucket that holds `frontend/dist` (or a CloudFront OAC origin). Default root object: `index.html`.
2. **API** — the EC2 public hostname or an ALB in front of Nginx. Protocol: HTTPS if Nginx has a cert, otherwise HTTP only inside a private path from CloudFront to EC2.

## Cache behaviors

| Path pattern | Origin | Viewer protocol | Cache policy | Origin request |
|---|---|---|---|---|
| `/api*` | API | Redirect HTTP to HTTPS | CachingDisabled | Forward `Authorization`, `X-Store-Id`, `Content-Type`, all query strings |
| Default `*` | S3 frontend | Redirect HTTP to HTTPS | CachingOptimized for hashed `/assets/*` | none |

Do **not** cache `/api`.

## SPA fallback

Custom error responses:

- HTTP 403 → `/index.html` with response code **200**
- HTTP 404 → `/index.html` with response code **200**

S3 website `error-document` is not enough when CloudFront is in front of S3 REST.

## Headers

The API origin request policy must forward:

- `Authorization`
- `X-Store-Id`
- `Content-Type`

CORS is not required when the SPA and `/api` share the same CloudFront hostname (`VITE_API_BASE_URL=/api`).
