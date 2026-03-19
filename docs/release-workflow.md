# Release Workflow

Recommended workflow for `Noon Hub`:

1. Make and verify changes locally.
2. Commit to GitHub.
3. Let Railway deploy from GitHub.
4. Use manual Railway CLI deploys only for emergency rescue/debug work.

## Local checks before commit

```bash
cd "/Users/dodge/Desktop/Vibe Code Project/Content Creator Bot/crypto-news-bot"
npm run db:generate
npm run typecheck --workspace @crypto-news/shared
npm run typecheck --workspace @crypto-news/api
npm run typecheck --workspace @crypto-news/feed
npm run typecheck --workspace @crypto-news/worker
npm --prefix apps/api run build
npm --prefix apps/feed run build
npm --prefix apps/worker run build
```

## Deployment model

- GitHub is the source of truth.
- Railway runs the live services.
- `noon-hub-api`, `noon-hub-web`, `noon-hub-worker`, and `noon-hub-charts-api` should all rebuild from committed code.

## Safe change policy

Do not retire old infrastructure until:

- all Railway services are healthy
- public routes respond correctly
- worker jobs are running against the intended database/redis
- connected bots are visible in `/hub/overview`

## Do not commit

- `.env`
- local secrets
- local deploy-only overrides
- generated artifacts/logs
