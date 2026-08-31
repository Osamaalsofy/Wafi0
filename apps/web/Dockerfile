FROM node:22-alpine AS build

RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/web/package.json apps/web/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/types/package.json packages/types/package.json
RUN pnpm install --frozen-lockfile

COPY apps/web apps/web
COPY packages packages
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm --filter @wafi/web build

FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV WEB_PORT=3000

COPY --chown=node:node --from=build /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/apps/web ./apps/web
COPY --chown=node:node --from=build /app/packages ./packages
RUN mkdir -p /app/apps/web/.next/cache && chown -R node:node /app/apps/web/.next/cache

EXPOSE 3000
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:' + process.env.WEB_PORT).then((response) => { if (!response.ok) process.exit(1) }).catch(() => process.exit(1))"

USER node:node
CMD ["sh", "-c", "cd apps/web && exec ./node_modules/.bin/next start --port $WEB_PORT"]
