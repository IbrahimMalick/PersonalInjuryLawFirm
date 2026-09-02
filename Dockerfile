# Nightshift — single multi-tenant deployment. With DATABASE_URL set the app
# uses that Postgres; without it, an embedded PGlite store lives on /data.

FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-slim AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    PGLITE_DIR=/data/pg
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# Migrations run at boot from this folder; the JSON file feeds demo mode only.
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/data/adverse-parties.json ./data/adverse-parties.json
VOLUME /data
EXPOSE 3000
CMD ["node", "server.js"]
