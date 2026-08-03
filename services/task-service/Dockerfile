# ---------- Stage 1: Dependencies ----------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

# ---------- Stage 2: Runtime ----------
FROM node:20-alpine AS final
WORKDIR /app

RUN addgroup -S nodejs && adduser -S nodeuser -G nodejs

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY server.js ./
COPY src ./src

ENV NODE_ENV=production
ENV PORT=4001

USER nodeuser

EXPOSE 4001

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD node -e "require('http').get('http://localhost:4001/healthz', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "server.js"]
