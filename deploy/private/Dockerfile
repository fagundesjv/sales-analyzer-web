FROM node:24-bookworm-slim
WORKDIR /opt/sales-web
COPY --chown=node:node REVISION ./REVISION
COPY --chown=node:node server/ ./server/
COPY --chown=node:node site/ ./site/
USER node
ENV NODE_ENV=production
EXPOSE 4319
CMD ["node", "server/private-web.mjs"]
