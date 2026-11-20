# Contributing to claude-memory-ui

## Development setup

```bash
cd ui
npm ci
npm run dev        # Vite dev server; /api is proxied to http://localhost:8080
npm run build      # production build into ui/dist (tsc + vite)
```

For manual testing run the [claude-memory](https://github.com/first-it-consulting/claude-memory)
backend locally, or build the container with
`docker buildx bake -f docker-bake.hcl image-local` (the SPA is served by the FastAPI proxy then).

## Ground rules

- Conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:` …); same style for PR titles.
- Keep `npm run build` (typecheck included) green — CI runs it on every pull request.
- Never commit secrets or private hostnames — this is a public repository.
- Memory content is untrusted input; render it through the existing MUI components, never with
  `dangerouslySetInnerHTML`.

## Reporting issues

Bugs and feature requests: use the issue templates. Security issues: see [SECURITY.md](SECURITY.md).
