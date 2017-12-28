FROM mhart/alpine-node:9.3.0

MAINTAINER jeff_e_shaver

ARG PORT=3000

ENV PORT ${PORT}

WORKDIR /opt/logs
WORKDIR /opt/app

COPY src/package.json /opt/app/package.json
COPY src/package-lock.json /opt/app/package-lock.json

RUN npm install --production \
  && rm -rf \
  /root/.npm \
  /tmp/npm

COPY src/. /opt/app/.

EXPOSE $PORT
CMD ["node", "index.js"]
