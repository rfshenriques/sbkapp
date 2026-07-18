# Dev-mode image: installs the whole workspace, builds shared deps, then
# runs the backend with hot reload. Build context is the repo root (see
# infra/docker/docker-compose.yml) so pnpm workspace resolution works.
FROM node:22-alpine

WORKDIR /workspace
RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY apps/odds-engine/package.json apps/odds-engine/package.json
COPY apps/backoffice/package.json apps/backoffice/package.json
COPY apps/master-backoffice/package.json apps/master-backoffice/package.json
RUN pnpm install --frozen-lockfile

COPY packages/shared packages/shared
COPY apps/backend apps/backend
RUN pnpm --filter @sportsbook/shared build
RUN pnpm --filter @sportsbook/backend exec prisma generate

WORKDIR /workspace/apps/backend
EXPOSE 3000
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && pnpm dev"]
