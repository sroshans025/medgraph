FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8000 \
    HOME=/home/app \
    YOLO_CONFIG_DIR=/home/app/.config/Ultralytics

# libGL/glib are needed by the opencv build that ultralytics pulls in
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Non-root user (uid 1000 is what Hugging Face Spaces runs as)
RUN useradd -m -u 1000 app
WORKDIR /app

# CPU-only PyTorch wheels: ~200 MB instead of ~2.5 GB of CUDA libraries
COPY requirements.txt /app/
RUN pip install --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt

COPY backend/ /app/backend/
COPY models/ /app/models/
RUN mkdir -p /app/storage/overlays /app/storage/uploads /app/storage/models /app/data \
    && chown -R app:app /app /home/app

USER app
ENV DATABASE_URL=sqlite+aiosqlite:////app/data/medgraph.db

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s \
    CMD python -c "import urllib.request,os; urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\",\"8000\")}/api/v1/health')"

# PORT is set by the host (Hugging Face uses 7860, Render injects its own)
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT}"]
