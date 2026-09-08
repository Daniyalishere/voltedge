# syntax=docker/dockerfile:1

# ---------------------------------------------------------------
# 1. Dependencies
# ---------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# ---------------------------------------------------------------
# 2. Build
# ---------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Ensure public/ exists even when the repo ships no static assets, so the
# runner stage's COPY cannot fail.
RUN mkdir -p /app/public

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---------------------------------------------------------------
# 3. Runtime
# ---------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# `output: "standalone"` bundles only what the server needs, so node_modules
# is not copied. public/ and .next/static are not included automatically.
#
# public/ is currently empty (icons live in app/), and git does not track empty
# directories, so it may be absent from the build context. The builder stage
# guarantees it exists (see `mkdir -p /app/public` there) to keep this COPY
# working whether or not the repo ships static assets.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# JSON data lives here. Mount a Render disk at /var/data and set
# DATA_DIR=/var/data for storage that survives redeploys.
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data
VOLUME /app/data

USER nextjs

ENV PORT=3000
ENV HOSTNAME=0.0.0.0
EXPOSE 3000

CMD ["node", "server.js"]
