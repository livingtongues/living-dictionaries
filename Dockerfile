FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable pnpm

# Copy workspace config and lockfile
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

# Copy package.json for new-site and any workspace dependencies it needs
COPY new-site/package.json new-site/

RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy new-site source code
COPY new-site/ new-site/

# Copy .env for SvelteKit build (manually maintained on VPS)
COPY .env new-site/.env

RUN pnpm --filter @living-dictionaries/new-site build


FROM node:22-alpine AS runner

WORKDIR /workspace

# Recreate workspace structure for pnpm prod install
COPY --from=builder /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/package.json ./
COPY --from=builder /app/new-site/package.json new-site/
RUN corepack enable pnpm
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

# Copy build output
COPY --from=builder /app/new-site/build new-site/build/

WORKDIR /workspace/new-site

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "build"]
