#!/usr/bin/env bash
set -e

echo "==> Akano Bot installer"
echo "    Detect: Termux / Debian-based Linux"

IS_TERMUX=false
if [ -d /data/data/com.termux ] || command -v termux-setup-storage >/dev/null 2>&1; then
  IS_TERMUX=true
fi

if [ "$IS_TERMUX" = true ]; then
  echo "==> Termux detected"
  pkg update -y
  pkg install -y nodejs python python-pip ffmpeg git openssl
  pip3 install -U yt-dlp yt-dlp-ejs gallery-dl
else
  echo "==> Linux detected"
  if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 18 ]; then
    echo "==> Installing Node.js 20 LTS"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
  fi
  apt-get update -y
  apt-get install -y python3 python3-pip ffmpeg git
  pip3 install -U yt-dlp yt-dlp-ejs gallery-dl
fi

echo "==> Installing npm dependencies"
npm install

if [ ! -f ~/.akano-env ]; then
  cp .env.example ~/.akano-env
  echo "==> Created ~/.akano-env from template — edit it with your tokens"
else
  echo "==> ~/.akano-env already exists, keeping it"
fi

echo "==> Done."
echo "    Start with: npm start   (or: node index.js --whatsapp | --telegram | --discord)"
