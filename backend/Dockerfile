FROM python:3.11-slim

WORKDIR /app

# Install system deps for psycopg2
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copy dependency and project files for caching
COPY pyproject.toml uv.lock ./
RUN touch README.md

# Install dependencies only (not the project itself)
RUN uv sync --frozen --no-dev --no-install-project

# Copy application code
COPY . .

# Install the project
RUN uv sync --frozen --no-dev

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "stock_strategy.api:app", "--host", "0.0.0.0", "--port", "8000"]
