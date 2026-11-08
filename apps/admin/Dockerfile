# SKHPortal admin: the accounts and VAT dashboard, served under /admin.
# Stage 1 builds the React page; stage 2 runs the Python API, which also serves that page.

FROM node:20-bookworm-slim AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 DATA_DIR=/tmp/skh-admin-files COOKIE_SECURE=1
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY api/ ./api/
COPY --from=web /web/dist ./web/dist
WORKDIR /app/api
# Railway sets PORT. Data and files live in PostgreSQL (DATABASE_URL); no volume needed.
CMD ["sh", "-c", "uvicorn server:build_app --factory --host 0.0.0.0 --port ${PORT:-8501} --proxy-headers --forwarded-allow-ips='*'"]
