FROM node:24-alpine AS builder

WORKDIR /app

# better-sqlite3 has no prebuild for alpine/musl + node 24, so we compile from source.
# python3/make/g++ are needed at install time; we discard them in the runner stage.
RUN apk add --no-cache python3 make g++ && corepack enable pnpm

# Workspace config + lockfile, then every workspace member's package.json the
# lockfile knows about (`.`, site) so `--frozen-lockfile` sees the exact same
# importer set and doesn't bail. (scripts is a standalone pnpm project, not a
# workspace member; the legacy top-level types package is gone — site uses its
# own `src/lib/types`.)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY site/package.json site/

# `pnpm.onlyBuiltDependencies` in package.json gates which packages may run
# install scripts. Run install WITHOUT --ignore-scripts so better-sqlite3's
# `install` hook (prebuild-install || node-gyp rebuild) compiles the native binary.
RUN pnpm install --frozen-lockfile

# Source: site (self-contained; imports its own `$lib/types`).
COPY site/ site/

# Copy .env for the SvelteKit build (manually maintained on the VPS; copied into
# the build context by deploy.sh). Supplies `$env/static/*` vars baked at build time.
COPY .env site/.env

# Bake the latest DB-backed translations into the build: the image build can't
# see /data, but the OLD container is still serving — fetch its /api/i18n/export
# and overwrite the locale files. Never fails the build (falls back to the
# committed seed files with a loud warning).
RUN node site/scripts/fetch-baked-i18n.mjs

# Bake the latest homepage stats + approved featured word cards the same way
# (fetch from the still-serving old container; never fails the build).
RUN node site/scripts/fetch-homepage-baked.mjs

RUN pnpm --filter=site build


FROM node:24-alpine AS runner

WORKDIR /workspace

# Recreate workspace structure for the prod install.
COPY --from=builder /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/package.json ./
COPY --from=builder /app/site/package.json site/
RUN corepack enable pnpm
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

# Reuse the better-sqlite3 native binary built in the builder stage so we don't
# need build tools (python3/make/g++) in the runner image. Path patterns include
# the `better-sqlite3@` version prefix to avoid matching drizzle-orm's
# `better-sqlite3/` adapter subfolder.
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
# DATA_DIR comes from env_file `.env` on the VPS (set to `/data`, the volume mount).
# Unset → the app falls back to `.data` relative to cwd for non-Docker local dev.

EXPOSE 3000

# env_file `.env` populates process.env at container start; SvelteKit's
# `$env/dynamic/private` reads from there at request time.
CMD ["node", "build"]
