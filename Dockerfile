# Production Dockerfile for LOMS Frontend (Credit Desk)
# Multi-stage build for optimal production image

# === STAGE 1: Build ===
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build for production
RUN npm run build

# === STAGE 2: Production ===
FROM nginx:alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/healthz || exit 1

# Create a simple health check endpoint
RUN echo '{"status":"ok"}' > /usr/share/nginx/html/healthz

# Run nginx in foreground
CMD ["nginx", "-g", "daemon off;"]