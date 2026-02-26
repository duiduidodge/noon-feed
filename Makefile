.PHONY: install dev build test lint typecheck clean docker-up docker-down db-migrate db-seed db-studio

# Install dependencies
install:
	npm install

# Development
dev:
	npm run dev

dev-api:
	npm run dev --workspace=@crypto-news/api

dev-worker:
	npm run dev --workspace=@crypto-news/worker

dev-dashboard:
	npm run dev --workspace=@crypto-news/dashboard

dev-bot:
	npm run dev --workspace=@crypto-news/bot

# Build
build:
	npm run build

# Testing
test:
	npm run test

lint:
	npm run lint

typecheck:
	npm run typecheck

format:
	npm run format

# Clean
clean:
	npm run clean

# Docker
docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

docker-logs:
	docker-compose logs -f

# Database
db-generate:
	npm run db:generate

db-migrate:
	npm run db:migrate

db-migrate-prod:
	npm run db:migrate:prod

db-push:
	npm run db:push

db-seed:
	npm run db:seed

db-studio:
	npm run db:studio

# Setup (first time)
setup: docker-up install db-generate db-migrate db-seed
	@echo "Setup complete! Run 'make dev' to start development."

# Help
help:
	@echo "Available commands:"
	@echo "  make install      - Install dependencies"
	@echo "  make dev          - Start all services in development mode"
	@echo "  make dev-api      - Start API server only"
	@echo "  make dev-worker   - Start worker only"
	@echo "  make dev-dashboard - Start dashboard only"
	@echo "  make dev-bot      - Start Discord bot only"
	@echo "  make build        - Build all packages"
	@echo "  make test         - Run tests"
	@echo "  make lint         - Run linter"
	@echo "  make typecheck    - Run TypeScript type checking"
	@echo "  make docker-up    - Start Docker services (postgres, redis)"
	@echo "  make docker-down  - Stop Docker services"
	@echo "  make db-migrate   - Run database migrations"
	@echo "  make db-seed      - Seed the database"
	@echo "  make db-studio    - Open Prisma Studio"
	@echo "  make setup        - Full setup (docker, install, migrate, seed)"
	@echo "  make fly-worker-deploy - Deploy worker to Fly"
	@echo "  make fly-worker-logs   - Tail Fly worker logs"
	@echo "  make fly-feed-deploy   - Deploy feed app to Fly"
	@echo "  make fly-feed-logs     - Tail Fly feed logs"

# Fly.io worker
fly-worker-deploy:
	bash scripts/deploy-worker-fly.sh

fly-worker-logs:
	flyctl logs -a noon-feed-worker

fly-feed-deploy:
	bash scripts/deploy-feed-fly.sh

fly-feed-logs:
	flyctl logs -a noon-feed-web
