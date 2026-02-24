# API Contracts (M0 draft)

## Public (Widget)
- `POST /v1/widget/conversations`
- `POST /v1/widget/messages`
- `POST /v1/widget/answers`
- `GET /v1/widget/config?site_key=...`

## Dashboard (Auth)
- `GET /v1/conversations`
- `GET /v1/conversations/:id/messages`
- `POST /v1/conversations/:id/messages`
- `GET /v1/leads`
- `PATCH /v1/leads/:id`

## System
- `POST /v1/billing/stripe/webhook`
- `GET /health`

