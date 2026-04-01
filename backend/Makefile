SHELL := /bin/zsh

UV ?= uv
PYTHONPATH ?= src
CONFIG ?= config.yaml
ENV_FILE ?= .env
REPLAY_INPUT ?= data/replay_sample.csv

# ── Deploy config (fill these in) ──────────────────────────────────
SERVER_IP    ?= 148.113.4.73
SSH_KEY      ?= ~/.ssh/cloud_key
SSH_USER     ?= ubuntu
DEPLOY_DIR   := deploy
INVENTORY    := $(DEPLOY_DIR)/inventory.ini
SSH_CMD      := ssh -i $(SSH_KEY) $(SSH_USER)@$(SERVER_IP)
REMOTE_DIR   := /opt/monies
ANSIBLE_ARGS := -i $(INVENTORY) -vv
IMAGE_NAME   := monies-backend
VERSION      := $(shell git rev-parse --short HEAD 2>/dev/null || echo "dev")
IMAGE_TAG    := $(IMAGE_NAME):$(VERSION)
IMAGE_TAR    := monies-backend.tar

.PHONY: help dev install sync test run-live run-replay run-api check-kite-api \
        generate-access-token check-template-d clean lint lint-fix \
        db-migrate db-upgrade db-downgrade db-history db-current \
        build push setup deploy images ssh edit-env restart stop up rebuild \
        logs logs-backend logs-caddy \
        status health migrate-prod \
        shell-backend remote-clean nuke

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
	@echo ""
	@echo "  Deploy:"
	@echo "    make build             - Build image (tagged with git hash), keep last 2"
	@echo "    make images            - List local backend images"
	@echo "    make setup             - Build + first-time server provisioning"
	@echo "    make push              - Upload existing tarball + restart (no rebuild)"
	@echo "    make deploy            - Build + push (use when code changed)"
	@echo "    make ssh               - SSH into server"
	@echo "    make edit-env          - Edit .env.prod on the server"
	@echo "    make logs              - Tail all container logs"
	@echo "    make logs-backend      - Tail backend logs"
	@echo "    make logs-caddy        - Tail Caddy logs"
	@echo "    make status            - Container status + health check"
	@echo "    make health            - Quick public health check"
	@echo "    make restart           - Restart all containers"
	@echo "    make rebuild           - Force rebuild backend only"
	@echo "    make migrate-prod      - Run Alembic migrations against prod DB (local)"
	@echo "    make shell-backend     - Shell into backend container"
	@echo "    make remote-clean      - Prune stopped containers/images"
	@echo "    make nuke              - Full teardown (DESTRUCTIVE)"

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

# ── Deploy ─────────────────────────────────────────────────────────

build:
	@echo "Building $(IMAGE_TAG)..."
	docker build --platform linux/amd64 -t $(IMAGE_TAG) -t $(IMAGE_NAME):latest .
	@echo "Saving tarball..."
	docker save $(IMAGE_NAME):latest -o $(IMAGE_TAR)
	@echo "Done: $(IMAGE_TAR) ($$(du -h $(IMAGE_TAR) | cut -f1))"
	@echo "Pruning old images (keeping last 2)..."
	@docker images $(IMAGE_NAME) --format '{{.Tag}}\t{{.ID}}' \
		| grep -v latest | sort -r | tail -n +3 \
		| awk '{print $$2}' | xargs -r docker rmi -f 2>/dev/null || true
	@echo "Local images:"; docker images $(IMAGE_NAME)

setup: build
	ansible-playbook $(ANSIBLE_ARGS) $(DEPLOY_DIR)/playbook.yml
	@rm -f $(IMAGE_TAR)
	@echo "Cleaned up local tarball."

# Push existing tarball + configs to server and restart (no rebuild)
push:
	ansible-playbook $(ANSIBLE_ARGS) $(DEPLOY_DIR)/redeploy.yml
	@rm -f $(IMAGE_TAR)
	@echo "Cleaned up local tarball."

# Build new image then push (use this when code has changed)
deploy: build push

images:
	@docker images $(IMAGE_NAME)

ssh:
	$(SSH_CMD)

edit-env:
	$(SSH_CMD) -t "nano $(REMOTE_DIR)/.env.prod"

restart:
	$(SSH_CMD) "cd $(REMOTE_DIR) && docker compose restart"

stop:
	$(SSH_CMD) "cd $(REMOTE_DIR) && docker compose stop"

up:
	$(SSH_CMD) "cd $(REMOTE_DIR) && docker compose up -d"

rebuild:
	$(SSH_CMD) "cd $(REMOTE_DIR) && docker compose up -d --force-recreate --no-deps backend"

logs:
	$(SSH_CMD) "cd $(REMOTE_DIR) && docker compose logs -f --tail 100"

logs-backend:
	$(SSH_CMD) "cd $(REMOTE_DIR) && docker compose logs -f --tail 100 backend"

logs-caddy:
	$(SSH_CMD) "cd $(REMOTE_DIR) && docker compose logs -f --tail 100 caddy"

status:
	@echo "── Containers ──"
	@$(SSH_CMD) "cd $(REMOTE_DIR) && docker compose ps"
	@echo ""
	@echo "── Health ──"
	@curl -sf https://signal-backend.dataprism.in/health && echo "" || echo "UNHEALTHY"

health:
	@curl -sf https://signal-backend.dataprism.in/health | python3 -m json.tool || echo "UNHEALTHY"

migrate-prod:
	DATABASE_URL=$$(grep DATABASE_URL .env.prod | cut -d= -f2- | tr -d '"') $(UV) run alembic upgrade head

shell-backend:
	$(SSH_CMD) -t "cd $(REMOTE_DIR) && docker compose exec backend bash"

remote-clean:
	$(SSH_CMD) "cd $(REMOTE_DIR) && docker compose down --remove-orphans && docker image prune -f"

nuke:
	@echo "This will destroy ALL data including the database. Ctrl+C to cancel."
	@sleep 5
	$(SSH_CMD) "cd $(REMOTE_DIR) && docker compose down -v --rmi all --remove-orphans"
