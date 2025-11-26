# Basis-Setup mit Python und Supervisor
FROM python:3.10-slim

# WICHTIG: Dieses Beispiel ist nur für CPU und wird SEHR langsam sein.
# Für eine annehmbare Performance ist ein NVIDIA GPU Basis-Image notwendig.
# z.B. FROM nvidia/cuda:11.8.0-cudnn8-runtime-ubuntu22.04

# Systemabhängigkeiten installieren
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsndfile1 \
    supervisor \
    nginx \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python-Abhängigkeiten installieren
COPY backend/requirements.txt .
RUN pip install --no-cache-dir --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# Den gesamten Code kopieren
COPY backend/ ./backend
COPY frontend/ ./frontend
COPY supervisor.conf /etc/supervisor/conf.d/supervisor.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8001

# Supervisor starten, der den Webserver startet
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisor.conf"]
