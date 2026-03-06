# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=builder /app/dist ./dist

# Cloud Run injects the PORT environment variable (default 8080)
ENV PORT=8080
EXPOSE 8080

# -s forces Single-Page Application mode (routing all traffic to index.html)
# -l explicitly binds to the injected Cloud Run port
CMD ["sh", "-c", "serve -s dist -l ${PORT}"]
