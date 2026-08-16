# Production build: compiles to static assets, then serves them via
# "vite preview" (still proxies /backend per vite.config.ts) rather than
# running the dev server - the dev server serves the whole workspace tree
# as transformable modules, which lets arbitrary paths reach real visitors
# as a broadcast HMR error overlay (and leaks server file paths). Build
# context is the repo root (see infra/docker/docker-compose.yml) so pnpm
# workspace resolution works.
FROM node:22-alpine

WORKDIR /workspace
RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY apps/backoffice/package.json apps/backoffice/package.json
COPY apps/master-backoffice/package.json apps/master-backoffice/package.json
COPY apps/odds-engine/package.json apps/odds-engine/package.json
RUN pnpm install --frozen-lockfile

COPY apps/master-backoffice apps/master-backoffice
RUN pnpm --filter @sportsbook/master-backoffice build

WORKDIR /workspace/apps/master-backoffice
EXPOSE 5175
CMD ["pnpm", "preview", "--host"]
