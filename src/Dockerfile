# ---- Frontend build ----
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- Backend ----
FROM node:20-alpine AS backend
WORKDIR /app
# ffmpeg: extracts a frame from uploaded videos for their gallery thumbnail
# (see utils/thumbnail.js's generateVideoThumbnail() / Architecture.md#media-thumbnails)
RUN apk add --no-cache ffmpeg
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/ ./
COPY --from=frontend-build /app/frontend/dist ./public

ENV PORT=8000
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:8000/api/health || exit 1

CMD ["node", "src/index.js"]
