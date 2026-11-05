# Production image (Render, any VPS). Development uses Dockerfile.dev.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
# postinstall runs `prisma generate`
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
# The Prisma CLI (a dev dependency) applies the migrations on start, so node_modules stays whole.
COPY --from=build /app/package.json /app/package-lock.json /app/prisma.config.ts ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/dist ./dist
RUN mkdir -p uploads && chown node:node uploads
USER node
EXPOSE 3333
CMD ["npm", "run", "start:render"]
