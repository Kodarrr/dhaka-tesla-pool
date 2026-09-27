FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Offline fallback font mocking for reproducible builds
ENV NEXT_FONT_GOOGLE_MOCKED_RESPONSES=/app/font-mock.json

ARG NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache wget

ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
COPY next.config.mjs ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
RUN mkdir -p public

EXPOSE 3000

CMD ["npm", "start"]

