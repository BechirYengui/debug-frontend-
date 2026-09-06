FROM node:24-alpine

ENV NODE_ENV=production PORT=3000
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

# La progression est écrite dans /app/data-store : monte un volume dessus.
RUN mkdir -p /app/data-store && chown -R node:node /app
ENV DOJO_DB_FILE=/app/data-store/dojo.sqlite DOJO_PROGRESS_FILE=/app/data-store/progress.json
USER node
VOLUME ["/app/data-store"]

EXPOSE 3000 3001
CMD ["node", "server.js"]
