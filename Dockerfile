FROM node:22-alpine AS builder

WORKDIR /app

# better-sqlite3 has no prebuild for alpine/musl + node 22, so we compile from source.
# python3/make/g++ are needed at install time; we discard them in the runner stage.
RUN apk add --no-cache python3 make g++ && corepack enable pnpm

# Copy workspace config and lockfile
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

# Copy package.json for site and any workspace dependencies it needs
COPY site/package.json site/

# onlyBuiltDependencies in pnpm-workspace.yaml gates which packages may run
# scripts (better-sqlite3 + esbuild + svelte-look only). Run install WITHOUT
# --ignore-scripts so better-sqlite3's `install` hook (prebuild-install ||
# node-gyp rebuild) actually executes.
RUN pnpm install --frozen-lockfile

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

# Reuse the better-sqlite3 native binary built in the builder stage so we don't
# need build tools (python3/make/g++) in the runner image.
# Path patterns include the `better-sqlite3@` version prefix to avoid matching
# drizzle-orm's `better-sqlite3/` adapter subfolder.
COPY --from=builder /app/node_modules/.pnpm /tmp/builder_pnpm
RUN BSQLITE_BUILT=$(find /tmp/builder_pnpm -path '*/better-sqlite3@*/node_modules/better-sqlite3/build/Release/better_sqlite3.node' | head -1) && \
    if [ -z "$BSQLITE_BUILT" ]; then \
      echo "ERROR: better-sqlite3 binary not found in builder stage. Listing what's there:"; \
      find /tmp/builder_pnpm -path '*/better-sqlite3@*' -type d | head -5; \
      find /tmp/builder_pnpm -name 'better_sqlite3.node' | head -10; \
      exit 1; \
    fi && \
    BSQLITE_DIR=$(find node_modules/.pnpm -path '*/better-sqlite3@*/node_modules/better-sqlite3' -type d | head -1) && \
    if [ -z "$BSQLITE_DIR" ]; then echo "ERROR: runner stage missing better-sqlite3 dir"; exit 1; fi && \
    mkdir -p "$BSQLITE_DIR/build/Release" && \
    cp "$BSQLITE_BUILT" "$BSQLITE_DIR/build/Release/better_sqlite3.node" && \
    echo "Copied better_sqlite3.node to $BSQLITE_DIR/build/Release/" && \
    rm -rf /tmp/builder_pnpm

# Copy build output
COPY --from=builder /app/site/build site/build/

WORKDIR /workspace/site

ENV NODE_ENV=production
ENV PORT=3000
# DATA_DIR is unset → app defaults to `.data` relative to cwd `/workspace/site`,
# resolving to `/workspace/site/.data` which is the volume mount target in
# docker-compose.yml. Override DATA_DIR via env_file only if you want a
# different path (the mount destination must then match).

EXPOSE 3000

# docker-compose's `env_file: .env` populates process.env at container start;
# SvelteKit's `$env/dynamic/private` reads from there at request time.
CMD ["node", "build"]
