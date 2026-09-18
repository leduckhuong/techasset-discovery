# =============================================================
# TechAsset Discovery — image all-in-one
# Stage 1: build frontend (React + Vite)
# Stage 2: backend FastAPI + nuclei + subfinder + httpx, serve frontend/dist
# Chạy:  docker compose up -d --build   →  http://localhost:8000
# =============================================================

# ---------- Stage 1: frontend build ----------
FROM node:20-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ---------- Stage 2: backend + security tools ----------
FROM python:3.13-slim

ARG TARGETARCH=amd64
ARG NUCLEI_VERSION=3.8.0
ARG SUBFINDER_VERSION=2.13.0
ARG HTTPX_VERSION=1.9.0

RUN apt-get update \
    && apt-get install -y --no-install-recommends unzip curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# pip install TRƯỚC: tránh python-httpx ghi đè binary httpx của ProjectDiscovery
WORKDIR /app/backend
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# nuclei — tech/vuln detection engine
RUN curl -fsSL "https://github.com/projectdiscovery/nuclei/releases/download/v${NUCLEI_VERSION}/nuclei_${NUCLEI_VERSION}_linux_${TARGETARCH}.zip" -o /tmp/nuclei.zip \
    && unzip -o /tmp/nuclei.zip -d /usr/local/bin nuclei \
    && chmod +x /usr/local/bin/nuclei

# subfinder — passive subdomain enumeration
RUN curl -fsSL "https://github.com/projectdiscovery/subfinder/releases/download/v${SUBFINDER_VERSION}/subfinder_${SUBFINDER_VERSION}_linux_${TARGETARCH}.zip" -o /tmp/subfinder.zip \
    && unzip -o /tmp/subfinder.zip -d /usr/local/bin subfinder \
    && chmod +x /usr/local/bin/subfinder

# httpx — web port probing + tech detection (cài SAU pip để đè python-httpx CLI nếu có)
RUN curl -fsSL "https://github.com/projectdiscovery/httpx/releases/download/v${HTTPX_VERSION}/httpx_${HTTPX_VERSION}_linux_${TARGETARCH}.zip" -o /tmp/httpx.zip \
    && unzip -o /tmp/httpx.zip -d /usr/local/bin httpx \
    && chmod +x /usr/local/bin/httpx

COPY backend/ .

# Pre-download nuclei templates lúc build để scan đầu tiên không phải chờ
RUN nuclei -update-templates || true

# Frontend build (backend tự serve /app/frontend/dist)
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist

ENV DB_PATH=/app/backend/data/techasset.db \
    HOST=0.0.0.0 \
    PORT=8000

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
