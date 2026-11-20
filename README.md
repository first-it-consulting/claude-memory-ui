# claude-memory-ui

A small web UI for **[claude-memory](https://github.com/first-it-consulting/claude-memory)** — the MCP memory server for AI agents. It lets you browse, search and edit stored memories, inspect usage stats, review dedup job runs, and manage auto-tagging rules from a browser.

The app is a **React + Vite TypeScript single-page application** served as static files by a lightweight **FastAPI proxy**. The proxy also transparently forwards `/api/*` requests (with bearer auth) to the claude-memory backend.

---

## Features

- **Keycloak login** — the SPA signs users in via Keycloak (authorization code + PKCE); every API call carries the user's access token and the backend scopes it to their workspace.
- **Multi-tenancy** — each user sees their own memories/sessions plus the admin-published shared space; admins get a workspace scope selector (mine / one tenant / all), the Jobs tab, a **Users** page for workspace management and a **Tokens** page that lists every user's API tokens (masked) for revocation.
- **My tokens** — every user mints, lists and revokes their own API tokens (name, expiry 30/90/365 days, optional default harness; admins can opt a token into admin rights). The secret is shown once, the reveal dialog only closes via its button, and nothing is kept in browser storage. Revoking the shared `legacy-hooks` token needs a typed confirmation because it stops every unmigrated device.
- **Memories** — list, search, filter by category/agent, edit content and tags, delete.
- **Stats** — aggregate views (total memories, by agent, category and tag) with a visual stats bar.
- **Jobs** — inspect past dedup job runs returned by claude-memory's `/api/jobs` (admin).
- **Sessions** — session checkpoints (working memory) of Claude Code, Codex and pi sessions: filter by project/harness, read the checkpoint and the auto-captured notes, delete old sessions.
- **Tag rules** — view and manage keyword→tag auto-classification rules (writes admin-only).
- **Transparent proxy** — the FastAPI layer serves the SPA and proxies API calls to the backend, so there's a single port to expose. With Keycloak configured it forwards the browser's `Authorization` header untouched; without it (legacy single-tenant mode) it injects the shared `BEARER_TOKEN`.

---

## Architecture

```
        Browser
          │
          ▼  http://localhost:8081
   ┌──────────────────────┐
   │  FastAPI proxy        │  src/ui/app.py
   │  • serves SPA (dist/) │
   │  • proxies /api/* ────┼──────────────► claude-memory :8080
   │  • adds Bearer token  │                (MCP server / REST API)
   └──────────┬────────────┘
              │  (dev only) npm run dev → Vite proxy /api → :8080
              ▼
   ┌──────────────────────┐
   │  React + Vite SPA     │  ui/
   │  MUI · react-query    │
   └──────────────────────┘
```

In production the built SPA (`ui/dist`) is baked into the image and served by FastAPI; every `/api/*` request is proxied to `MCP_INTERNAL_URL` (default `http://claude-memory:8080`). With `KEYCLOAK_URL` set, the browser authenticates itself — the SPA does the Keycloak flow and the proxy forwards each caller's `Authorization` header untouched (the backend verifies the JWT, see claude-memory's `auth.py`), so the UI no longer needs oauth2-proxy in front for identification. Without `KEYCLOAK_URL` the proxy attaches the shared `BEARER_TOKEN` for every caller (legacy single-tenant mode; keep the UI behind SSO in that mode). Session checkpoints are reached through `/ui-api/sessions[/{id}]` (GET, DELETE only), because the ingress routes `/api/sessions` and `/api/hooks` straight to the server for the harness adapters. During local development Vite proxies `/api` to `http://localhost:8080`.

The SPA reads its Keycloak settings at runtime from the proxy's `GET /ui-config.json` — realm changes need no rebuild. In the realm, give the UI client a web origin for the SPA host (redirect + CORS) and create the realm role `claude-memory-admin` to grant admins.

---

## Configuration

Runtime settings are environment variables (see `src/ui/app.py`):

| Variable | Default | Description |
|---|---|---|
| `MCP_INTERNAL_URL` | `http://claude-memory:8080` | Backend claude-memory API URL (used by the proxy). |
| `BEARER_TOKEN` | *(empty)* | Legacy mode only: shared token injected when no Keycloak is configured. Match this to claude-memory's `BEARER_TOKEN`. |
| `UI_PORT` | `8081` | Port the proxy/SPA listens on. |
| `KEYCLOAK_URL` | *(empty)* | Keycloak base URL; setting it enables browser login and per-user token forwarding. |
| `KEYCLOAK_REALM` | `master` | Realm the UI logs into (must match claude-memory's `OIDC_ISSUER` realm). |
| `KEYCLOAK_CLIENT_ID` | `claude-memory-ui` | Public OIDC client; its id is the token audience the backend expects. |

The dev server (`vite`) in `ui/vite.config.ts` proxies `/api` → `http://localhost:8080`.

---

## Build & run

### Requirements
- Docker (with `buildx`) for image builds, **or** Node.js 20+ + Python 3.12+ for local development.

### Build the image (Docker Bake)
```bash
# Single-platform to local daemon
docker buildx bake -f docker-bake.hcl image-local

# Multi-platform (amd64 + arm64) to a registry
docker buildx bake -f docker-bake.hcl image-all --push \
  --set "*.tags=registry.example.internal/first-it-consulting/claude-memory-ui:rolling"
```

### Run the container
```bash
docker run --rm -p 8081:8081 \
  -e BEARER_TOKEN=secret \
  -e MCP_INTERNAL_URL="http://claude-memory:8080" \
  claude-memory-ui:rolling
# open http://localhost:8081
```

### Run locally (development)
```bash
# 1. Build the SPA
cd ui && npm ci && npm run build      # output → ui/dist

# 2. Serve + proxy
pip install -r requirements-ui.txt
export BEARER_TOKEN=secret MCP_INTERNAL_URL="http://localhost:8080"
python src/ui/app.py                  # http://localhost:8081

# …or use the Vite dev proxy (no build needed):
cd ui && npm run dev                  # serves SPA, proxies /api → localhost:8080
```

---

## Project layout

```
├── Dockerfile                 # Stage 1: node builder (npm ci + vite build)
                               #   Stage 2: python slim (FastAPI proxy + static dist)
├── docker-bake.hcl            # buildx bake targets (image / image-local / image-all)
├── requirements-ui.txt        # Python deps: fastapi, uvicorn, httpx, aiofiles
├── src/
│   └── ui/
│       └── app.py             # FastAPI: static file server + /api/* proxy
└── ui/                        # React SPA (Vite + TypeScript)
    ├── index.html
    ├── package.json           # react, @mui/material, @tanstack/react-query, vite…
    ├── package-lock.json
    ├── tsconfig.json
    ├── vite.config.ts         # dev proxy /api → localhost:8080
    └── src/
        ├── App.tsx, main.tsx
        ├── api/               # fetch wrappers: memories, jobs, tag-rules
        ├── components/        # MemoryCard, StatsBar
        ├── pages/             # Memories, Stats, Jobs, TagRules
        └── theme/             # MUI theme primitives
```

---

## API surface (proxied)

The proxy forwards everything under `/api/*` to claude-memory. See the
[claude-memory README](https://github.com/first-it-consulting/claude-memory#api-reference)
for the full reference (`GET /api/memories`, `POST/PUT/PATCH/DELETE /api/memories/{id}`,
`/api/stats`, `/api/tag-rules`, `/api/jobs`, export/import, …).

---

## Related projects

- **[claude-memory](https://github.com/first-it-consulting/claude-memory)** — the MCP memory server this UI talks to.
- **[containers-images](https://github.com/first-it-consulting/containers-images)** — the monorepo claude-memory-ui was originally part of (now extracted).

---

## License

Licensed under the Apache License, Version 2.0 — see [LICENSE](LICENSE). Image registry:
`registry.example.internal/first-it-consulting/claude-memory-ui`.
