# The invitation video worker (app.reels.worker). Build from the repository root:
#   docker build -f backend/reel-worker.Dockerfile -t evoke-reel-worker .
# The tag must match the playwright version in tools/reel/package.json.
FROM mcr.microsoft.com/playwright:v1.63.0-noble

# The system ffmpeg, because ffmpeg-static's binary crashes on https URLs in this image.
RUN apt-get update && apt-get install -y --no-install-recommends python3-venv ffmpeg && rm -rf /var/lib/apt/lists/*
ENV FFMPEG_PATH=/usr/bin/ffmpeg

WORKDIR /srv/evoke

COPY backend/pyproject.toml backend/
COPY backend/app backend/app
RUN python3 -m venv /srv/venv && /srv/venv/bin/pip install --no-cache-dir ./backend

COPY tools/reel/package.json tools/reel/package-lock.json tools/reel/
RUN cd tools/reel && npm ci --omit=dev
COPY tools/reel/make-reel.mjs tools/reel/
COPY tools/reel/lib tools/reel/lib
COPY tools/reel/templates tools/reel/templates
# The films load fonts and read defaults from the templates themselves.
COPY frontend/public/invitation-templates frontend/public/invitation-templates

ENV REEL_TOOL_DIR=/srv/evoke/tools/reel
WORKDIR /srv/evoke/backend
USER pwuser
CMD ["/srv/venv/bin/python", "-m", "app.reels.worker"]
