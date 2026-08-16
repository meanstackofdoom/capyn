# Configuration

CAPYN uses environment variables at the API and web process boundaries. `.env.example` is safe to copy for local development; `.env` files are ignored and must not be committed.

## API variables

| Variable | Local default | Required | Purpose |
|---|---|---|---|
| `NODE_ENV` | `development` | No | Selects development, test or production behavior. |
| `HOST` | `0.0.0.0` | No | API listen address. |
| `PORT` | `4000` | No | API listen port. Hosting platforms may supply it. |
| `CAPYN_STORAGE` | `memory` in `.env.example` | No | Selects `memory` or `postgres`. |
| `DATABASE_URL` | Local example only | PostgreSQL mode | Prisma connection URL. |
| `API_KEY_PEPPER` | No safe deployment default | Yes | High-entropy secret used to HMAC agent credentials. |
| `WEB_ORIGIN` | `http://localhost:3010` | No | Exact browser origin allowed by API CORS. |
| `DEMO_HUMAN_AUTH` | `true` locally | No | Enables the development-only `x-capyn-user-id` adapter. Must be `false` outside a demo. |
| `BOOTSTRAP_TOKEN` | Local placeholder | No | Enables organisation bootstrap when present. Omit after controlled onboarding. |

The API refuses to start in PostgreSQL mode without `DATABASE_URL`, or with an `API_KEY_PEPPER` shorter than 32 characters.

## Web variables

| Variable | Local default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | Browser-visible API origin used by the control plane. |
| `NEXT_PUBLIC_DEMO_USER_ID` | `usr_demo_owner` | Development user sent only when demo human auth is intentionally enabled. |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3010` | Canonical origin for metadata, sitemap and social cards. |
| `PORT` | platform supplied in production | Next.js listen port for `pnpm --filter @capyn/web start`. Development stays on `3010`. |
| `CAPYN_SERVICE` | unset locally | Set to `web` or `api` when two hosting services share the root `pnpm start` command. |

`NEXT_PUBLIC_*` values are embedded into the browser bundle at build time. Changing them requires a new web build.

## Persistence modes

### Memory

Use `CAPYN_STORAGE=memory` for the demo, tests and local interface work. State resets when the API process stops. The seeded organisation, users, agent, credential and mandate are recreated on startup.

### PostgreSQL

Use `CAPYN_STORAGE=postgres` with a provisioned PostgreSQL instance for durable state:

```bash
corepack pnpm db:migrate
corepack pnpm db:seed
```

The seed is for local demonstrations only. Do not run it against a production organisation database.

## Secret handling

- generate `API_KEY_PEPPER` and `BOOTSTRAP_TOKEN` with a cryptographically secure secret manager;
- scope secrets per environment;
- never expose the pepper, database URL or bootstrap token through `NEXT_PUBLIC_*` variables;
- rotate agent credentials through CAPYN rather than editing hashes;
- redact authorization and bootstrap headers from every log sink;
- disable demo human authentication before any shared or internet-facing environment.

See [Security](security.md) for the deployment gate and [Deployment](deployment.md) for service-level configuration.
