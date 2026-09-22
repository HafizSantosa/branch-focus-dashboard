# ── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
# Required for building native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package*.json ./
RUN npm_config_disturl=https://nodejs.org/download/release npm ci

# ── Stage 2: build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public
RUN npm test
RUN npm run build

# ── Stage 3: production runner ───────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Create non-root system user and prepare data directory for SQLite
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    mkdir -p /app/data /app/scripts /app/public && \
    chown -R nextjs:nodejs /app/data /app/scripts /app/public

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/scripts/create-admin.mjs ./scripts/create-admin.mjs
COPY --from=deps    --chown=nextjs:nodejs /app/node_modules/bcryptjs     ./node_modules/bcryptjs

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health > /dev/null 2>&1 || exit 1

CMD ["node", "server.js"]
