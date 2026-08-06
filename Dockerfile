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

# The commit being built. `svelte.config.js` uses it as `kit.version.name` and
# REFUSES TO BUILD without it (there is no `.git` dir in this stage, so git
# can't answer): a clock-derived version name gives the page shell and the
# client bundle different `__sveltekit_<hash>` globals and serves a blank page
# on every route — the 2026-08-03 poly.education outage. `deploy.sh` exports
# GIT_SHA before `docker compose build` and compose passes it through as
# `${GIT_SHA:-}`, which is why the empty default here must never be accepted as
# a value (see the comment in svelte.config.js).
#
# DELIBERATELY BELOW `pnpm install`: GIT_SHA changes on every deploy and Docker
# invalidates every layer after a changed ENV, so declaring it above the install
# would re-run `pnpm install --frozen-lockfile` (with a from-source
# better-sqlite3 compile) on every single deploy.
ARG GIT_SHA=""
ENV GIT_SHA=$GIT_SHA

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

# The per-build half of `kit.version.name` (`<GIT_SHA>-<BUILD_ID>`, see
# resolve_version_name in site/svelte.config.js). Two builds of ONE commit are
# two different applications here — the two RUN steps above bake in answers
# fetched from the still-running site — and until 2026-08-06 they shipped under
# one name, which blinded the update poll, the stale-build error split and the
# deploy timeline all at once (log review 2026-08-05 §1.1).
#
# Minted in the SAME shell as the build on purpose. `process.env` is inherited by
# SvelteKit's postbuild worker threads while `globalThis` is not, so an env var
# set once here is seen identically by all four config loads; a clock read INSIDE
# the config would give each of them a different answer, which is the outage.
#
# The `date` runs only when this layer is not cached — and a cached layer means a
# byte-identical build, which SHOULD keep its name. `ARG BUILD_ID` lets deploy.sh
# supply its own id later without touching this file; empty is the normal case.
ARG BUILD_ID=""
RUN BUILD_ID="${BUILD_ID:-$(date -u +%Y%m%d%H%M%S)}" && export BUILD_ID && \
    echo "Building with BUILD_ID=$BUILD_ID" && \
    pnpm --filter=site build


FROM node:24-alpine AS runner

WORKDIR /workspace

# ffmpeg: extracts a frame for video thumbnails ($lib/server/video-thumbnails.ts —
# the upload fast path + weekly media-sweep self-heal). Alpine's package is small.
RUN apk add --no-cache ffmpeg

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
# Adapter-node's global ceiling must accommodate a 100 MiB multipart video.
# `hooks.server.ts` retains the 16 MiB ceiling for every non-video route.
ENV BODY_SIZE_LIMIT=105M
# DATA_DIR comes from env_file `.env` on the VPS (set to `/data`, the volume mount).
# Unset → the app falls back to `.data` relative to cwd for non-Docker local dev.

EXPOSE 3000

# env_file `.env` populates process.env at container start; SvelteKit's
# `$env/dynamic/private` reads from there at request time.
CMD ["node", "build"]
