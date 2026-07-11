FROM oven/bun:1 AS base
WORKDIR /app
COPY package.json bun.lock ./
COPY packages/schema/package.json packages/schema/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY scripts/package.json scripts/package.json
RUN bun install --frozen-lockfile
COPY packages/schema packages/schema
COPY apps/api apps/api
COPY data/master_data.i18n.json data/master_data.i18n.json
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["bun", "apps/api/src/index.ts"]
