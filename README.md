# claude-memory-ui

A small web UI for **[claude-memory](https://github.com/first-it-consulting/claude-memory)** — the MCP memory server for AI agents. It lets you browse, search and edit stored memories, inspect usage stats, review dedup job runs, and manage auto-tagging rules from a browser.

The app is a **React + Vite TypeScript single-page application** served as static files by a lightweight **FastAPI proxy**. The proxy also transparently forwards `/api/*` requests (with bearer auth) to the claude-memory backend.

---

## Features

- **Memories** — list, search, filter by category/agent, edit content and tags, delete.
- **Stats** — aggregate views (total memories, by agent, category and tag) with a visual stats bar.
- **Jobs** — inspect past dedup job runs returned by claude-memory's `/api/jobs`.
- **Sessions** — session checkpoints (working memory) of Claude Code, Codex and pi sessions: filter by project/harness, read the checkpoint and the auto-captured notes, delete old sessions.
- **Tag rules** — view and manage keyword→tag auto-classification rules.
- **Transparent proxy** — the FastAPI layer serves the SPA and proxies API calls to the backend, so there's a single port to expose.

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

In production the built SPA (`ui/dist`) is baked into the image and served by FastAPI; every `/api/*` request is proxied to `MCP_INTERNAL_URL` (default `http://claude-memory:8080`) with the configured bearer token attached. Session checkpoints are reached through `/ui-api/sessions[/{id}]` (GET, DELETE only), because the ingress routes `/api/sessions` and `/api/hooks` straight to the server for the harness adapters. The proxy attaches the token for every caller, so the UI host must sit behind SSO (example-project: oauth2-proxy + a CiliumNetworkPolicy). During local development Vite proxies `/api` to `http://localhost:8080`.

---

## Configuration

Runtime settings are environment variables (see `src/ui/app.py`):

| Variable | Default | Description |
|---|---|---|
| `MCP_INTERNAL_URL` | `http://claude-memory:8080` | Backend claude-memory API URL (used by the proxy). |
| `BEARER_TOKEN` | *(empty)* | Bearer token forwarded to the backend for `/api/*` proxying. Match this to claude-memory's `BEARER_TOKEN`. |
| `UI_PORT` | `8081` | Port the proxy/SPA listens on. |

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

Internal-use project. Image registry:
`registry.example.internal/first-it-consulting/claude-memory-ui`.
