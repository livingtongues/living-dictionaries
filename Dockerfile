FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable pnpm

# Copy workspace config and lockfile
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

# Copy package.json for site and any workspace dependencies it needs
COPY site/package.json site/

RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy site source code
COPY site/ site/

# Copy .env for SvelteKit build (manually maintained on VPS)
COPY .env site/.env

RUN pnpm --filter @living-dictionaries/site build


FROM node:22-alpine AS runner

WORKDIR /workspace

# Recreate workspace structure for pnpm prod install
COPY --from=builder /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/package.json ./
COPY --from=builder /app/site/package.json site/
RUN corepack enable pnpm
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

# Copy build output
COPY --from=builder /app/site/build site/build/

WORKDIR /workspace/site

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "build"]
