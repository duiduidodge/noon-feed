# Quick Setup Guide

## What You Need to Do

### Step 1: ✅ Docker Desktop (Already Done!)
Docker is installed and running.

---

### Step 2: Get Your Discord Webhook URL

This is MUCH simpler than setting up a bot!

1. In Discord, go to the channel where you want news posted
2. Click the **gear icon** (Edit Channel) next to the channel name
3. Go to **"Integrations"** → **"Webhooks"**
4. Click **"New Webhook"** or **"Create Webhook"**
5. (Optional) Give it a name like "Crypto News Bot"
6. (Optional) Upload an icon
7. Click **"Copy Webhook URL"**

The URL will look like:
```
https://discord.com/api/webhooks/1234567890/AbCdEfGhIjKlMnOpQrStUvWxYz
```

---

### Step 3: Get Your LLM API Key

**Option 1: OpenRouter** (Recommended - Access to multiple models including Grok)
1. Go to https://openrouter.ai/
2. Sign up and create an API key
3. Copy the key (starts with `sk-or-v1-`)

**Option 2: OpenAI**
1. Go to https://platform.openai.com/api-keys
2. Click **"Create new secret key"**
3. Copy the key (starts with `sk-`)

**Option 3: Anthropic**
1. Go to https://console.anthropic.com/
2. Create an API key

---

### Step 4: Edit Your .env File

Open the file:
```bash
open "/Users/dodge/Desktop/Vibe Code Project/Content Creator Bot/crypto-news-bot/.env"
```

Replace these values:
```env
# Line ~21 - Discord Webhook URL
DISCORD_WEBHOOK_URL="paste-your-webhook-url-here"

# Optional Telegram hub (for bi-daily + high-impact updates)
TELEGRAM_BOT_TOKEN="paste-your-telegram-bot-token-here"
TELEGRAM_CHAT_ID="paste-your-telegram-chat-id-here"

# Line ~27-29 - LLM Provider Configuration
# For OpenRouter (recommended - includes xAI Grok 4 Fast):
LLM_PROVIDER="openrouter"
OPENROUTER_API_KEY="paste-your-openrouter-key-here"
LLM_MODEL="x-ai/grok-4-fast"
# Alternative: "x-ai/grok-4.1-fast" (better for agentic tasks, free)

# OR for OpenAI:
LLM_PROVIDER="openai"
OPENAI_API_KEY="paste-your-openai-key-here"
LLM_MODEL="gpt-4-turbo-preview"

# OR for Anthropic:
LLM_PROVIDER="anthropic"
ANTHROPIC_API_KEY="paste-your-anthropic-key-here"
LLM_MODEL="claude-3-sonnet-20240229"
```

**That's it!** Configure Discord + LLM, and optionally Telegram.

---

### Step 5: Start the Application

```bash
cd "/Users/dodge/Desktop/Vibe Code Project/Content Creator Bot/crypto-news-bot"
npm run dev
```

Then open:
- **Dashboard**: http://localhost:3000
- **API**: http://localhost:3001

---

## What to Expect

### Automatic News Posting
- Worker fetches RSS feeds every 5 minutes
- Articles are automatically:
  - Fetched and extracted
  - Translated to Thai with AI
  - Posted to your Discord channel

### Dashboard
- View all articles
- Filter by tags, sentiment, source
- Export to CSV/JSON
- Manually post articles to Discord

---

## Quick Commands Reference

| Command | Description |
|---------|-------------|
| `npm run dev` | Start all services |
| `npm run db:studio` | Open database GUI |
| `docker compose logs -f` | View container logs |
| `docker compose down` | Stop containers |
| `docker compose up -d` | Start containers |

---

## Test It Works

1. Wait a few minutes for the worker to fetch and process articles
2. Check your Discord channel - you should see news posts!
3. If Telegram is configured, check your Telegram chat/channel too
4. Open http://localhost:3000 to see the dashboard

---

## Troubleshooting

**No messages appearing in Discord?**
- Make sure the webhook URL is correct in .env
- Check worker logs: `npm run dev --workspace=@crypto-news/worker`
- Verify the webhook wasn't deleted in Discord

**No articles in dashboard?**
- Wait 5-10 minutes for first fetch cycle
- Check worker logs for errors
- Verify your OpenAI API key is valid and has credits

**Database errors?**
- Make sure Docker Desktop is running
- Run: `docker compose up -d`

---

## Advanced: Multiple Channels

To post different topics to different channels:

1. Create multiple webhooks in different Discord channels
2. Modify the worker to route by tags (requires code changes)

For now, all news posts to one channel (simpler setup).
