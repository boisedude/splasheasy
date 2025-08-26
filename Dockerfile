# Multi-stage build for SplashEasy
FROM node:18-alpine AS frontend-build

# Build frontend
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM node:18-alpine AS backend-build

# Build API
WORKDIR /app/api
COPY api/package*.json ./
RUN npm ci --only=production
COPY api/ .

FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Set working directory
WORKDIR /app

# Copy built frontend
COPY --from=frontend-build --chown=nextjs:nodejs /app/dist ./public

# Copy API and install dependencies
COPY --from=backend-build --chown=nextjs:nodejs /app/api ./api
WORKDIR /app/api
RUN npm ci --only=production && npm cache clean --force

# Copy server setup
WORKDIR /app
COPY --chown=nextjs:nodejs server.js ./

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]