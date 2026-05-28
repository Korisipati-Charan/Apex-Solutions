# Multi-stage secure build for Apex Solutions Backend Service
# Stage 1: Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package descriptors and lockfile
COPY package*.json ./

# Install all dependencies including devDependencies to enable build compiles
RUN npm ci

# Copy codebase assets
COPY . .

# Run production compilation of client Vite assets and bundled esbuild server.cjs
RUN npm run build

# Stage 2: Minimal runtime stage
FROM node:22-alpine AS runner

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

# Create a secure, non-privileged system user and group (UID/GID 10001) to block root execution
RUN addgroup -g 10001 -S apexgroup && \
    adduser -u 10001 -S -G apexgroup apexuser

# Copy built artifacts from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public

# Install ONLY production dependencies to minimize attack surface and dependency vulnerabilities
RUN npm install --omit=dev

# Change file ownership to the secure non-root user
RUN chown -R apexuser:apexgroup /app

# Switch to the secure non-root user context
USER 10001

EXPOSE 3000

# Run the compiled backend Express service
CMD ["node", "dist/server.cjs"]
