FROM node:24-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip python3-venv ffmpeg git ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && python3 -m venv /opt/venv \
  && /opt/venv/bin/pip install --no-cache-dir -U pip yt-dlp yt-dlp-ejs gallery-dl

ENV PATH="/opt/venv/bin:${PATH}"

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

RUN mkdir -p system/database backup data

ENV NODE_ENV=production
ENV AKANO_MEM_LIMIT_MB=768

CMD ["node", "index.js", "--all"]
