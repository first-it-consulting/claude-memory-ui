#!/usr/bin/env bash
# UI image smoke test. Started by the CI smoke job: ui container on :8081,
# stub401 backend on the shared network (MCP_INTERNAL_URL). Faked: the
# backend claude-memory API (stub answers 401 like the real server does for
# unauthenticated calls). Real: the built UI image, SPA assets, proxy path.
set -uo pipefail
BASE=http://localhost:8081

ok() { echo "PASS: $1"; }
die() { echo "FAIL: $1 (${2:-})"; docker logs ui 2>&1 | tail -15; docker logs stub401 2>&1 | tail -5; exit 1; }

for _ in $(seq 1 30); do
  curl -sS -m 5 "$BASE/health" 2>/dev/null | grep -q '"status":"ok"' && break
  sleep 2
done
curl -sS "$BASE/health" | grep -q 'claude-memory-ui' || die "health endpoint" ""
ok "GET /health"

curl -sS -m 10 "$BASE/ui-config.json" | grep -q '"oidc_enabled": *false' || die "ui-config legacy mode" ""
ok "GET /ui-config.json (legacy mode, no Keycloak)"

curl -sS -m 10 "$BASE/" | grep -q 'id="root"' || die "SPA index served" ""
ok "GET / serves the built SPA"

# Browser sends no Authorization; the legacy-mode proxy attaches the shared
# token and must pass the backend's 401 through untouched.
CODE=$(curl -sS -m 10 -o /dev/null -w '%{http_code}' "$BASE/api/memories")
[ "$CODE" = "401" ] || die "backend 401 must pass through" "got $CODE"
ok "proxy forwards /api call -> backend 401 passed through"

echo ALL-SMOKE-PASSED
