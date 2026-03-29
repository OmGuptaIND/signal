SHELL := /bin/zsh

UV ?= uv
PYTHONPATH ?= src
CONFIG ?= config.yaml
ENV_FILE ?= .env
REPLAY_INPUT ?= data/replay_sample.csv

.PHONY: help dev install sync test run-live run-replay run-api check-kite-api \
        generate-access-token check-template-d clean lint lint-fix \
        db-migrate db-upgrade db-downgrade db-history db-current

help:
	@echo "Available targets:"
	@echo ""
	@echo "  Setup:"
	@echo "    make install           - Install dependencies from uv.lock"
	@echo "    make sync              - Alias for install"
	@echo ""
	@echo "  Run:"
	@echo "    make dev               - Start FastAPI dev server (port 8000)"
	@echo "    make run-live          - Run live strategy engine"
	@echo "    make run-replay        - Run replay mode with REPLAY_INPUT"
	@echo ""
	@echo "  Database:"
	@echo "    make db-migrate m=msg  - Create a new migration (autogenerate)"
	@echo "    make db-upgrade        - Apply all pending migrations"
	@echo "    make db-downgrade      - Revert the last migration"
	@echo "    make db-history        - Show migration history"
	@echo "    make db-current        - Show current migration revision"
	@echo ""
	@echo "  Quality:"
	@echo "    make lint              - Run ruff linter"
	@echo "    make lint-fix          - Run ruff linter with auto-fix"
	@echo "    make test              - Run unit tests"
	@echo ""
	@echo "  Kite:"
	@echo "    make check-kite-api    - Call local connectivity endpoint"
	@echo "    make generate-access-token - Generate KITE_ACCESS_TOKEN"
	@echo "    make check-template-d  - Run Template D scenario checks"

install: sync

sync:
	$(UV) sync

test:
	PYTHONPATH=$(PYTHONPATH) $(UV) run python -m unittest discover -s tests -v

# ── Run ─────────────────────────────────────────────────────────────

run-live:
	$(UV) run python -m stock_strategy.main live --config $(CONFIG) --env $(ENV_FILE)

run-replay:
	$(UV) run python -m stock_strategy.main replay --config $(CONFIG) --input $(REPLAY_INPUT)

run-api:
	$(UV) run python -m uvicorn stock_strategy.api:app --host 0.0.0.0 --port 8000 --reload

dev:
	@echo "Killing any existing process on port 8000..."
	@lsof -ti :8000 | xargs kill -9 2>/dev/null || true
	@echo "Starting FastAPI Server..."
	$(UV) run python -m uvicorn stock_strategy.api:app --host 0.0.0.0 --port 8000 --reload

# ── Database Migrations ─────────────────────────────────────────────

db-migrate:
	$(UV) run alembic revision --autogenerate -m "$(m)"

db-upgrade:
	$(UV) run alembic upgrade head

db-downgrade:
	$(UV) run alembic downgrade -1

db-history:
	$(UV) run alembic history --verbose

db-current:
	$(UV) run alembic current

# ── Quality ─────────────────────────────────────────────────────────

lint:
	$(UV) run ruff check src/

lint-fix:
	$(UV) run ruff check --fix src/

format:
	$(UV) run ruff format src/

# ── Kite ────────────────────────────────────────────────────────────

check-kite-api:
	curl -sS "http://127.0.0.1:8000/kite/connectivity?env_path=$(ENV_FILE)&config_path=$(CONFIG)"

generate-access-token:
	$(UV) run python -m stock_strategy.access_token --env $(ENV_FILE) --write-env

check-template-d:
	PYTHONPATH=$(PYTHONPATH) $(UV) run python -m stock_strategy.template_d_cases --config $(CONFIG)

clean:
	rm -f requirements.txt requirements-kite.txt
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
