FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build
RUN npm prune --production

RUN addgroup -g 1001 -S nodejs && \
    adduser -S wordle -u 1001

RUN chown -R wordle:nodejs /app
USER wordle

EXPOSE 3003

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node src/services/healthcheck.js || exit 1

CMD ["npm", "start"]