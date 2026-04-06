.PHONY: install run setup clean

# Install dependencies
install:
	uv sync

# Run the analyser
run:
	uv run analyser.py

# First-time setup: copy .env and install
setup:
	@test -f .env || cp .env.example .env
	@echo "Fill in your KITE_API_KEY and KITE_ACCESS_TOKEN in .env"
	uv sync

# Add a new dependency
add:
	uv add $(pkg)

# Remove .venv and lockfile
clean:
	rm -rf .venv uv.lock
