FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules and Prisma
RUN apk add --no-cache openssl libc6-compat python3 make g++

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src/

# Compile TypeScript to dist/
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

# Install runtime dependencies for Prisma and healthcheck
RUN apk add --no-cache openssl libc6-compat wget

ENV NODE_ENV=production
ENV PORT=8000

COPY package*.json ./
COPY prisma ./prisma/

# Copy installed modules (including CLI tools tsx & prisma) and compiled dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 8000

# Push DB schema, run seed data idempotently, then launch the Fastify server
CMD ["sh", "-c", "npx prisma db push && npx tsx prisma/seed.ts && node dist/server.js"]

