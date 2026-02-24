# Runbooks (M0)

## Local startup
1. `docker compose -f infra/docker-compose.yml up -d`
2. `Copy-Item .env.example .env`
3. `corepack pnpm install`
4. `corepack pnpm db:generate`
5. `corepack pnpm db:migrate -- --name init_m1`
6. `corepack pnpm db:seed`
7. `corepack pnpm dev`

## Health checks
- API: `GET http://localhost:4000/health`
- Dashboard: `http://localhost:3000`
- Widget playground: `http://localhost:5173`
- Open widget playground and click the widget button to run flow via UI.
- Reload page after 1-2 answers: widget should restore conversation history and current question.

## Widget API smoke test (M1)
Use PowerShell:

1. Config:
`curl.exe "http://localhost:4000/v1/widget/config?site_key=demo_site_key"`

2. Start conversation:
`curl.exe -X POST "http://localhost:4000/v1/widget/conversations" -H "Content-Type: application/json" -d "{\"site_key\":\"demo_site_key\",\"visitor_id\":\"visitor_1\",\"idempotency_key\":\"conv_1\"}"`

3. Submit answers:
`curl.exe -X POST "http://localhost:4000/v1/widget/answers" -H "Content-Type: application/json" -d "{\"conversation_id\":\"<ID_FROM_STEP_2>\",\"answer\":\"Ремонт\"}"`
`curl.exe -X POST "http://localhost:4000/v1/widget/answers" -H "Content-Type: application/json" -d "{\"conversation_id\":\"<ID_FROM_STEP_2>\",\"answer\":\"На этой неделе\"}"`
`curl.exe -X POST "http://localhost:4000/v1/widget/answers" -H "Content-Type: application/json" -d "{\"conversation_id\":\"<ID_FROM_STEP_2>\",\"answer\":\"2000$\"}"`
`curl.exe -X POST "http://localhost:4000/v1/widget/answers" -H "Content-Type: application/json" -d "{\"conversation_id\":\"<ID_FROM_STEP_2>\",\"answer\":\"user@example.com\"}"`

Expected result:
- last response includes `status: "COMPLETED"`
- `lead_id` is returned

## VPS deployment
See `docs/vps.md`
Production reverse proxy config: `infra/Caddyfile`
