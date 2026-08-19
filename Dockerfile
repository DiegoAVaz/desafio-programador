# Imagem única para o Hugging Face Spaces: Nginx entrega o frontend e
# encaminha /api para o processo Express que roda internamente na porta 3000.
FROM node:22-bookworm-slim AS frontend-build

WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend ./
RUN npm run build

FROM node:22-bookworm-slim AS backend-build

WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npx tsc

FROM node:22-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

RUN apt-get update \
  && apt-get install -y --no-install-recommends nginx \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --create-home --uid 1000 user \
  && rm -f /etc/nginx/sites-enabled/default \
  && sed -i 's|pid /run/nginx.pid;|pid /tmp/nginx.pid;|' /etc/nginx/nginx.conf

COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci --omit=dev
COPY --from=backend-build /app/dist ./backend/dist
COPY --from=frontend-build /app/dist /usr/share/nginx/html
COPY deploy/huggingface/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/huggingface/start.sh /app/start.sh

RUN chown -R user:user /app /usr/share/nginx/html /var/cache/nginx /var/log/nginx \
  && chmod 755 /app/start.sh

USER user
EXPOSE 7860
CMD ["/app/start.sh"]
