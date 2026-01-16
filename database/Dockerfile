FROM node:18-alpine

WORKDIR /app

RUN apk update && apk add --no-cache postgresql-client

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build
RUN npm prune --production

RUN addgroup -g 1001 -S dbgroup && \
    adduser -S -D -H -u 1001 -h /app -s /sbin/nologin -G dbgroup -g dbgroup dbuser

RUN chown -R dbuser:dbgroup /app
USER dbuser

CMD ["node", "dist/database.js"]