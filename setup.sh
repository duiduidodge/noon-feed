#!/bin/bash

# ============================================
# Crypto News Bot - Setup Script
# ============================================

set -e

echo "🚀 Crypto News Bot Setup"
echo "========================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is running
echo "📦 Checking Docker..."
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed.${NC}"
    echo "Please install Docker Desktop from: https://www.docker.com/products/docker-desktop/"
    exit 1
fi

if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker is not running.${NC}"
    echo "Please start Docker Desktop and try again."
    exit 1
fi

echo -e "${GREEN}✅ Docker is running${NC}"

# Check .env file
echo ""
echo "📝 Checking .env configuration..."
if [ ! -f .env ]; then
    echo -e "${RED}❌ .env file not found.${NC}"
    echo "Please copy .env.example to .env and fill in your credentials."
    exit 1
fi

# Check for placeholder values
if grep -q "REPLACE_ME" .env; then
    echo -e "${YELLOW}⚠️  Your .env file still contains placeholder values.${NC}"
    echo ""
    echo "Please edit .env and replace these values:"
    grep "REPLACE_ME" .env | while read line; do
        echo "  - $line"
    done
    echo ""
    echo "Then run this script again."
    exit 1
fi

echo -e "${GREEN}✅ .env file configured${NC}"

# Start Docker containers
echo ""
echo "🐳 Starting PostgreSQL and Redis..."
docker compose up -d

# Wait for PostgreSQL to be ready
echo ""
echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 5

# Check if PostgreSQL is accepting connections
for i in {1..30}; do
    if docker compose exec -T postgres pg_isready -U postgres &> /dev/null; then
        echo -e "${GREEN}✅ PostgreSQL is ready${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ PostgreSQL failed to start${NC}"
        exit 1
    fi
    sleep 1
done

# Run database migrations
echo ""
echo "🗄️  Running database migrations..."
npm run db:migrate

# Seed the database
echo ""
echo "🌱 Seeding database with default sources..."
npm run db:seed

# Deploy Discord commands
echo ""
echo "🤖 Deploying Discord slash commands..."
npm run --workspace=@crypto-news/bot deploy-commands

echo ""
echo "============================================"
echo -e "${GREEN}✅ Setup complete!${NC}"
echo "============================================"
echo ""
echo "To start the application, run:"
echo ""
echo "  npm run dev"
echo ""
echo "This will start:"
echo "  • Dashboard:  http://localhost:3000"
echo "  • API:        http://localhost:3001"
echo "  • Worker:     Background processing"
echo "  • Bot:        Discord bot"
echo ""
echo "Or start services individually:"
echo "  npm run dev --workspace=@crypto-news/api"
echo "  npm run dev --workspace=@crypto-news/worker"
echo "  npm run dev --workspace=@crypto-news/bot"
echo "  npm run dev --workspace=@crypto-news/dashboard"
echo ""
