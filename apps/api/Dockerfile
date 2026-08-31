FROM node:22-alpine AS build

RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/validation/package.json packages/validation/package.json
RUN pnpm install --frozen-lockfile

COPY apps/api apps/api
COPY packages packages
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build \
  pnpm --filter @wafi/api prisma:generate && pnpm --filter @wafi/api build

FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV API_PORT=3001

COPY --chown=node:node --from=build /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/apps/api ./apps/api
COPY --chown=node:node --from=build /app/packages ./packages
RUN mkdir -p /app/var/documents && chown -R node:node /app/var

EXPOSE 3001
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:' + process.env.API_PORT + '/api/v1/health/ready').then((response) => { if (!response.ok) process.exit(1) }).catch(() => process.exit(1))"

USER node:node
CMD ["sh", "-c", "cd apps/api && ./node_modules/.bin/prisma migrate deploy && exec node dist/src/main.js"]
