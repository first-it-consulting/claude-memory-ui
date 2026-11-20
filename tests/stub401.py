"""Stand-in backend for the UI smoke test: every /api/* call answers 401,
like claude-memory does for unauthenticated requests. Tests/ only."""
from http.server import BaseHTTPRequestHandler, HTTPServer


class Handler(BaseHTTPRequestHandler):
    def _reply(self):
        self.send_response(401 if self.path.startswith("/api") else 404)
        self.send_header("Content-Length", "0")
        self.end_headers()

    do_GET = do_POST = do_PUT = do_DELETE = do_PATCH = _reply

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    HTTPServer(("0.0.0.0", 8080), Handler).serve_forever()
