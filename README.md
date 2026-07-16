# Sportsbook Platform

Full context, architecture, and working principles: [`docs/PROJECT_BRIEF.md`](docs/PROJECT_BRIEF.md).

## Layout

- `apps/frontend` — React + TypeScript + Vite PWA
- `apps/backend` — NestJS modular monolith (one folder per domain module under `src/modules`)
- `apps/odds-engine` — standalone real-time odds/trading service
- `packages/shared` — shared TypeScript types/DTOs used by frontend, backend, and odds-engine
- `infra/docker` — Docker Compose local dev environment
- `infra/migrations` — database migrations
- `docs/modules` — per-module requirements docs, written just before each module is built

## Local development

Requires Node >= 22 and pnpm.

```bash
pnpm install
docker compose -f infra/docker/docker-compose.yml up -d   # Postgres, Redis
pnpm --filter @sportsbook/backend dev
pnpm --filter @sportsbook/frontend dev
pnpm --filter @sportsbook/odds-engine dev
```
