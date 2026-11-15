"""
UI backend — static file server + transparent proxy to MCP /api/*.
No mem0 or DB dependency; only httpx for the proxy.
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
DIST = Path(__file__).parent / "dist"

app = FastAPI(title="claude-memory-ui")

_HEADERS = {"Authorization": f"Bearer {BEARER_TOKEN}"}


@app.get("/health")
async def health():
    return {"status": "ok", "service": "claude-memory-ui"}


@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def proxy(path: str, request: Request) -> Response:
    url = f"{MCP_URL}/api/{path}"
    qs = request.url.query
    if qs:
        url = f"{url}?{qs}"
    body = await request.body()
    content_type = request.headers.get("content-type", "")
    proxy_headers = dict(_HEADERS)
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
                 "content-disposition": resp.headers.get("content-disposition", "")},
    )


# Session checkpoints for the Sessions page. The ingress routes /api/sessions
# straight to the server (bearer token required, used by the harness
# adapters), so the browser reaches them through this separate prefix, behind
# the UI's SSO. Read and delete only; checkpoints are written by the agents.
@app.api_route("/ui-api/sessions", methods=["GET"])
@app.api_route("/ui-api/sessions/{session_id:path}", methods=["GET", "DELETE"])
async def sessions_proxy(request: Request, session_id: str = "") -> Response:
    path = "/api/sessions" + (f"/{quote(session_id, safe='')}" if session_id else "")
    url = f"{MCP_URL}{path}"
    if request.url.query:
        url = f"{url}?{request.url.query}"
    async with httpx.AsyncClient() as client:
        resp = await client.request(method=request.method, url=url, headers=dict(_HEADERS), timeout=30)
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
