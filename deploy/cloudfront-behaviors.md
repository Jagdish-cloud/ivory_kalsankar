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

## Camera (webcam capture)

Product photo capture uses the browser `getUserMedia` API on the SPA origin. CloudFront does **not** proxy the camera stream, but a restrictive response header can block it.

Attach a **Response headers policy** on the default (`*`) behavior (S3 frontend):

| Header | Value |
|---|---|
| `Permissions-Policy` | `camera=(self)` |

Also keep **Viewer protocol policy = Redirect HTTP to HTTPS**. Camera access requires a secure context.

If camera still fails after that:

1. Confirm the site is opened as `https://…` (not `http://` or a raw S3 website endpoint).
2. Allow camera permission in the browser for the CloudFront hostname.
3. Use **Upload** on the SKU form as a fallback.
