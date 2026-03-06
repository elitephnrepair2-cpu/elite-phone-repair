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
COPY --from=builder /app/dist ./dist
COPY server.js ./

# Cloud Run injects the PORT environment variable
ENV PORT=8080
EXPOSE ${PORT}

# Run the native server directly 
CMD ["node", "server.js"]
