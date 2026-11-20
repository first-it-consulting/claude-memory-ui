# Security Policy

## Supported Versions

Pre-1.0: only the **latest release** (and `main`) receive security fixes.

## Reporting a Vulnerability

Use GitHub **private vulnerability reporting**: **Security** tab → **"Report a vulnerability"**.
If the option is not yet visible here, contact the maintainer via the method on their GitHub
profile and mark it as a security report — please do **not** file a public issue.

Include: version/commit, affected area (SPA auth/keycloak-js, token forwarding in the FastAPI
proxy, admin views, XSS via memory content rendering), reproduction steps and impact.
We aim to acknowledge within **7 days**.

## Scope notes

- The proxy forwards the caller's `Authorization` header to the backend; header leakage or
  identity confusion between callers is in scope.
- Memory content is untrusted input; stored XSS in the SPA is in scope.
