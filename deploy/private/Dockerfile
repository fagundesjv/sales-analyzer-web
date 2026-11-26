FROM node:24-bookworm-slim@sha256:01d566e8d94d8c619591d78652babfccd3c6992a3dffa9ed5ab39e11cf6c70e9
WORKDIR /opt/sales-web
COPY --chown=node:node REVISION ./REVISION
COPY --chown=node:node server/ ./server/
COPY --chown=node:node site/ ./site/
USER node
ENV NODE_ENV=production
EXPOSE 4319
CMD ["node", "server/private-web.mjs"]
