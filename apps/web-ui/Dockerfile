# ─────────────────────────────────────────────────────────────────────────────
# AURA Web UI — Production & Development Dockerfile
# Supports build-time environment variables for different deployments
# ─────────────────────────────────────────────────────────────────────────────

# ─── Build stage ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci --prefer-offline --no-audit

# Copy source code
COPY . .

# Build arguments for environment configuration
ARG REACT_APP_API_URL=http://localhost:8000
ARG REACT_APP_TENANT_ID=
ARG REACT_APP_CLIENT_ID=
ARG REACT_APP_REDIRECT_URI=http://localhost:3000
ARG REACT_APP_ENABLE_STREAMING=true
ARG REACT_APP_ENABLE_DARK_MODE=true
ARG REACT_APP_NAME=AURA
ARG REACT_APP_VERSION=1.0

# Set environment variables for build
ENV REACT_APP_API_URL=${REACT_APP_API_URL}
ENV REACT_APP_TENANT_ID=${REACT_APP_TENANT_ID}
ENV REACT_APP_CLIENT_ID=${REACT_APP_CLIENT_ID}
ENV REACT_APP_REDIRECT_URI=${REACT_APP_REDIRECT_URI}
ENV REACT_APP_ENABLE_STREAMING=${REACT_APP_ENABLE_STREAMING}
ENV REACT_APP_ENABLE_DARK_MODE=${REACT_APP_ENABLE_DARK_MODE}
ENV REACT_APP_NAME=${REACT_APP_NAME}
ENV REACT_APP_VERSION=${REACT_APP_VERSION}

# Build application
RUN npm run build

# ─── Production stage ───────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Install serve to run production build
RUN npm install -g serve

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start the application
CMD ["serve", "-s", "dist", "-l", "3000"]

# ─────────────────────────────────────────────────────────────────────────────
# BUILD INSTRUCTIONS:
#
# Local Development (development server):
#   docker build -t aura-web-ui:dev .
#   docker run -p 3000:3000 aura-web-ui:dev
#
# Staging Deployment:
#   docker build \
#     --build-arg REACT_APP_API_URL=https://api-staging.aligned.com \
#     --build-arg REACT_APP_CLIENT_ID=staging-client-id \
#     --build-arg REACT_APP_TENANT_ID=staging-tenant-id \
#     -t aura-web-ui:staging .
#
# Production Deployment:
#   docker build \
#     --build-arg REACT_APP_API_URL=https://api.aligned.com \
#     --build-arg REACT_APP_CLIENT_ID=prod-client-id \
#     --build-arg REACT_APP_TENANT_ID=prod-tenant-id \
#     -t aura-web-ui:latest .
#
# Run Production:
#   docker run -p 3000:3000 aura-web-ui:latest
# ─────────────────────────────────────────────────────────────────────────────
