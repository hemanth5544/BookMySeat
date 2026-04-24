FROM node:22-slim AS deps

WORKDIR /app
COPY apps/web/package.json ./package.json
RUN npm install

FROM node:22-slim AS builder

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY --from=deps /app/node_modules ./node_modules
COPY apps/web/package.json ./package.json
COPY apps/web/next.config.ts ./next.config.ts
COPY apps/web/postcss.config.mjs ./postcss.config.mjs
COPY apps/web/tailwind.config.ts ./tailwind.config.ts
COPY apps/web/tsconfig.json ./tsconfig.json
COPY apps/web/public ./public
COPY apps/web/src ./src

RUN npm run build
RUN npm prune --omit=dev

FROM node:22-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["sh", "-c", "npm run start -- -p ${PORT:-3000}"]
