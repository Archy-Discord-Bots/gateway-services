FROM node:22-alpine

RUN apk add --no-cache \
  fontconfig \
  ttf-dejavu \
  freetype \
  freetype-dev \
  fribidi \
  python3 \
  make \
  g++

WORKDIR /app

COPY package.json .
RUN npm install --omit=dev

COPY src ./src

ENV NODE_ENV=production

EXPOSE 7860

CMD ["node", "src/index.js"]
