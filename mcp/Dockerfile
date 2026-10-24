# Build from the repository root: docker build -f mcp/Dockerfile -t orbit-mcp .
FROM node:24-alpine AS dependencies
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production ORBIT_MCP_TRANSPORT=http ORBIT_MCP_HOST=0.0.0.0 ORBIT_MCP_PORT=3100
COPY --from=dependencies /app/node_modules ./node_modules
COPY mcp ./mcp
COPY lib/*.mjs ./lib/
COPY pocketbase/pb_hooks/lib ./pocketbase/pb_hooks/lib
USER node
EXPOSE 3100
CMD ["node", "mcp/index.mjs"]
