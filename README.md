# Conversational Sales Widget

Monorepo scaffold for MVP development.

## Stack
- TypeScript monorepo with pnpm workspaces
- API: Fastify + Prisma + BullMQ
- Dashboard: Next.js
- Widget: Vite
- DB: PostgreSQL
- Queue: Redis

## Quick start
```powershell
docker compose -f infra/docker-compose.yml up -d
Copy-Item .env.example .env
corepack pnpm install
corepack pnpm db:generate
corepack pnpm db:migrate -- --name init_m1
corepack pnpm db:seed
corepack pnpm dev
```

## Docs
- Local runbook: `docs/runbooks.md`
- VPS test deploy: `docs/vps.md`
