# Cicada Freedom deployment checklist

## Recommended first launch stack

- Domain/DNS: Cloudflare
- Frontend: Vercel
- API: Render Web Service
- Database, phase 2: Supabase or Neon Postgres

The current API still writes to `server/data/db.json`. That is acceptable for a private demo, but not for real public traffic. Before inviting users, move posts and users into a managed database.

## 1. Prepare GitHub

Push this repository to GitHub. Vercel and Render can both deploy from the same repository.

## 2. Deploy the API on Render

Create a Render Web Service:

- Runtime: Node
- Build Command: `pnpm install`
- Start Command: `pnpm start`
- Instance size: starter paid instance for always-on public use

Set these environment variables in Render:

```bash
PORT=10000
HOST=0.0.0.0
ALLOWED_ORIGINS=https://example.com,https://www.example.com
VERIFICATION_CODE=<private-code>
ADMIN_EMAIL=<your-admin-email>
ADMIN_PASSWORD=<long-random-password>
JWT_SECRET=<long-random-secret>
ADMIN_TOKEN_TTL_MS=86400000
```

After deploy, test:

```bash
curl https://your-render-service.onrender.com/api/health
```

## 3. Deploy the frontend on Vercel

Create a Vercel project from the same GitHub repo:

- Framework preset: Vite
- Build Command: `pnpm build`
- Output Directory: `dist`

Set:

```bash
VITE_API_BASE=https://your-render-service.onrender.com/api
```

When the custom API domain is ready, change it to:

```bash
VITE_API_BASE=https://api.example.com/api
```

## 4. Connect the domain

Recommended DNS layout:

- `example.com` -> Vercel frontend
- `www.example.com` -> Vercel frontend
- `api.example.com` -> Render API

After the domain is active, update Render:

```bash
ALLOWED_ORIGINS=https://example.com,https://www.example.com
```

## 5. Before public traffic

- Replace the JSON file data store with Supabase or Neon Postgres.
- Remove demo credentials from any real seed data.
- Use a private verification flow instead of a shared fixed code.
- Keep `ADMIN_PASSWORD` and `JWT_SECRET` only in hosting environment variables.
- Confirm `/admin` rejects access until the admin logs in.
