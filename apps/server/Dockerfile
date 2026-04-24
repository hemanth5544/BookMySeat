FROM oven/bun:1-slim

WORKDIR /app
ENV NODE_ENV=production

COPY apps/server/package.json ./package.json
RUN bun install --production

COPY apps/server/tsconfig.json ./tsconfig.json
COPY apps/server/src ./src

EXPOSE 3001
CMD ["bun", "run", "src/index.ts"]
