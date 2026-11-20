"""
UI backend — static file server + transparent proxy to MCP /api/*.
No mem0 or DB dependency; only httpx for the proxy.

Multi-tenancy: when KEYCLOAK_URL is set the browser authenticates itself
(Keycloak access token, see ui/src/auth.ts) and this proxy forwards the
caller's Authorization header verbatim — it no longer holds a shared secret.
Without KEYCLOAK_URL the old single-tenant behaviour is kept (static
BEARER_TOKEN injection) so dev setups and pre-migration deployments work.
"""
import os
from urllib.parse import quote
from pathlib import Path

import httpx
import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import Response, FileResponse
from fastapi.staticfiles import StaticFiles

MCP_URL = os.environ.get("MCP_INTERNAL_URL", "http://claude-memory:8080")
BEARER_TOKEN = os.environ.get("BEARER_TOKEN", "")
UI_PORT = int(os.environ.get("UI_PORT", "8081"))

# Keycloak browser login. The SPA reads these from /ui-config.json at startup
# (no rebuild needed when the realm changes).
KEYCLOAK_URL = os.environ.get("KEYCLOAK_URL", "").rstrip("/")
KEYCLOAK_REALM = os.environ.get("KEYCLOAK_REALM", "master")
KEYCLOAK_CLIENT_ID = os.environ.get("KEYCLOAK_CLIENT_ID", "claude-memory-ui")
OIDC_ENABLED = bool(KEYCLOAK_URL)

DIST = Path(__file__).parent / "dist"

app = FastAPI(title="claude-memory-ui")


def _auth_headers(request: Request) -> dict:
    """Headers to send upstream: the caller's bearer token when OIDC is on,
    the shared service token otherwise (legacy single-tenant mode)."""
    auth = request.headers.get("authorization", "")
    if OIDC_ENABLED:
        return {"Authorization": auth} if auth else {}
    # An empty BEARER_TOKEN must NOT produce "Bearer " (trailing space) - that
    # is an illegal header value and makes httpx raise -> 500. Send no header;
    # the backend then answers a clean 401, same as the OIDC-empty branch above.
    return {"Authorization": f"Bearer {BEARER_TOKEN}"} if BEARER_TOKEN else {}


@app.get("/health")
async def health():
    return {"status": "ok", "service": "claude-memory-ui"}


@app.get("/ui-config.json")
async def ui_config():
    return {
        "oidc_enabled": OIDC_ENABLED,
        "keycloak_url": KEYCLOAK_URL,
        "realm": KEYCLOAK_REALM,
        "client_id": KEYCLOAK_CLIENT_ID,
    }


@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def proxy(path: str, request: Request) -> Response:
    url = f"{MCP_URL}/api/{path}"
    qs = request.url.query
    if qs:
        url = f"{url}?{qs}"
    body = await request.body()
    content_type = request.headers.get("content-type", "")
    proxy_headers = dict(_auth_headers(request))
    if content_type:
        proxy_headers["content-type"] = content_type
    async with httpx.AsyncClient() as client:
        resp = await client.request(
            method=request.method,
            url=url,
            headers=proxy_headers,
            content=body,
            timeout=30,
        )
    return Response(
        content=resp.content,
        status_code=resp.status_code,
        headers={"content-type": resp.headers.get("content-type", "application/json"),
                 "content-disposition": resp.headers.get("content-disposition", ""),
                 # Token create/list responses carry a one-time plaintext —
                 # nothing under /api may sit in a browser or proxy cache.
                 "cache-control": "no-store"},
    )


# Session checkpoints for the Sessions page. The ingress routes /api/sessions
# straight to the server (bearer token required, used by the harness
# adapters), so the browser reaches them through this separate prefix. Read
# and delete only; checkpoints are written by the agents.
@app.api_route("/ui-api/sessions", methods=["GET"])
@app.api_route("/ui-api/sessions/{session_id:path}", methods=["GET", "DELETE"])
async def sessions_proxy(request: Request, session_id: str = "") -> Response:
    path = "/api/sessions" + (f"/{quote(session_id, safe='')}" if session_id else "")
    url = f"{MCP_URL}{path}"
    if request.url.query:
        url = f"{url}?{request.url.query}"
    async with httpx.AsyncClient() as client:
        resp = await client.request(
            method=request.method, url=url, headers=dict(_auth_headers(request)), timeout=30)
    return Response(
        content=resp.content,
        status_code=resp.status_code,
        headers={"content-type": resp.headers.get("content-type", "application/json")},
    )


# Serve React SPA — must come after API routes
if DIST.exists():
    app.mount("/", StaticFiles(directory=str(DIST), html=True), name="static")
else:
    @app.get("/{full_path:path}")
    async def spa_fallback():
        return {"error": "UI build not found — run: cd ui && npm run build"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=UI_PORT)
