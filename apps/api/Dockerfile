FROM oven/bun:1 AS base
WORKDIR /app
COPY package.json bun.lock ./
COPY packages/schema/package.json packages/schema/package.json
COPY packages/core/package.json packages/core/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY scripts/package.json scripts/package.json
RUN bun install --frozen-lockfile
COPY packages/schema packages/schema
COPY packages/core packages/core
COPY apps/api apps/api
COPY data/master_data.i18n.json data/master_data.i18n.json
COPY data/rag_index.json data/rag_index.json
RUN bun -e "import('./apps/api/src/embeddings.ts').then((m) => m.warmEmbeddingModel())"
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
USER bun
CMD ["bun", "apps/api/src/index.ts"]
