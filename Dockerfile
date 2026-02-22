FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --production

# Copy source
COPY . .

# Expose port
EXPOSE 3000

# Run
ENV NODE_ENV=production
CMD ["bun", "server/index.ts"]
