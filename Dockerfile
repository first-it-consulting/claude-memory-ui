# Stage 1 — build React SPA
FROM node:26-alpine AS builder
WORKDIR /app
COPY ui/package*.json ./
RUN npm ci
COPY ui/ .
RUN npm run build

# Stage 2 — Python proxy + static file server
FROM python:3.15-slim

# Refresh Debian packages: the slim base digest can lag security uploads
# (e.g. zlib1g CVEs); keeps the Trivy CRITICAL gate meaningful.
RUN apt-get update \
 && apt-get upgrade -y --no-install-recommends \
 && rm -rf /var/lib/apt/lists/*

RUN useradd -m -u 1000 appuser

WORKDIR /app

COPY requirements-ui.txt .
# pip is not needed at runtime; its vendored msgpack/urllib3/pkg_resources
# are the image's only HIGH CVEs in Trivy
RUN pip install --no-cache-dir -r requirements-ui.txt \
    && pip uninstall -y pip

COPY src/ui/app.py ./src/ui/
COPY --from=builder /app/dist ./src/ui/dist/

USER appuser

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8081/health')"

EXPOSE 8081

CMD ["python", "src/ui/app.py"]
