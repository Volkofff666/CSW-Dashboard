# Conversational Sales Widget - Delivery Plan

## 1) Цель разработки
Собрать продаваемый MVP SaaS, который:
- ставится на сайт через JS snippet и WordPress plugin;
- собирает и квалифицирует лиды через flow;
- отправляет уведомления в Telegram;
- дает оператору Inbox + Leads в dashboard;
- поддерживает multi-tenant, роли и базовые лимиты.

## 2) Технический baseline (фиксируем)
- Frontend dashboard: Next.js (App Router) + TypeScript.
- Widget: отдельный TypeScript bundle (Vite/Rollup), встраиваемый через `<script>`.
- Backend API: NestJS (или Fastify + TypeScript) + REST + WebSocket.
- DB: PostgreSQL + Prisma.
- Queue/Jobs: Redis + BullMQ.
- Auth: email/password + JWT + refresh tokens.
- Billing: Stripe subscriptions + webhook endpoint.
- Infra (MVP): Docker Compose для локалки, один production server + managed Postgres/Redis.

## 3) Целевая структура репозитория
```txt
/apps
  /api
  /dashboard
  /widget
  /wp-plugin
/packages
  /shared-types
  /eslint-config
  /tsconfig
/infra
  docker-compose.yml
  migrations/
/docs
  architecture.md
  api-contracts.md
  runbooks.md
```

## 4) Milestones (порядок реализации)

## M0 - Foundation (2-3 дня)
Цель: поднять скелет и dev workflow.
- Monorepo setup (pnpm workspaces/turbo).
- Lint/format/test pipelines.
- API skeleton + health check.
- Dashboard skeleton + auth pages заглушки.
- PostgreSQL + Prisma schema skeleton.
- Redis + worker skeleton.

Definition of Done:
- `pnpm dev` поднимает API + dashboard + widget dev.
- Есть CI на lint + typecheck + tests.
- Есть базовый `.env.example`.

## M1 - Core Lead Flow (5-7 дней)
Цель: end-to-end сценарий “лид за 30 секунд”.
- Public widget endpoints:
  - `POST /v1/widget/conversations`
  - `POST /v1/widget/answers`
  - `GET /v1/widget/config?site_key=...`
- Линейный Flow Engine (без ветвления).
- Conversation state (`current_node_id`) + idempotency key.
- Lead capture (email/phone + fields_json).
- Event logging (page_view, widget_open, flow_start, lead_created).
- Telegram notify при `lead_created`.

Definition of Done:
- На тестовом сайте виджет проходит flow и создает lead.
- Лид виден в БД и уведомление уходит в Telegram.
- Ретраи не создают дублей.

## M2 - Operator Dashboard (5-7 дней)
Цель: операторы работают с лидами и диалогами.
- Auth + role middleware (Owner/Admin/Operator).
- Inbox:
  - список conversations
  - сообщения в conversation
  - отправка operator message
- Leads:
  - список
  - смена статуса `New/Qualified/Won/Lost`
  - теги/заметки (MVP минимально)
- WebSocket события: `message.created`, `lead.created`, `conversation.updated`.

Definition of Done:
- Оператор в dashboard видит новые лиды и может ответить.
- Реалтайм обновления приходят без refresh.

## M3 - Install & Integrations (4-6 дней)
Цель: упростить установку и закрыть must-have интеграции.
- Widget config UI (welcome, primary color, position).
- WordPress plugin:
  - поле site key
  - toggle on/off
  - script auto-inject
- Email fallback notifications.
- Webhook integration (`lead_created`, `conversation_started`).

Definition of Done:
- Установка через WP занимает до 5 минут.
- При недоступном Telegram срабатывает email fallback.

## M4 - Billing, Limits, Compliance (4-6 дней)
Цель: коммерчески жизнеспособный MVP.
- Stripe checkout/subscription + webhook обработка.
- Plan limits middleware:
  - conversations/month
  - leads/month
  - operators count
- GDPR minimum:
  - consent checkbox в flow перед контактом
  - encrypt at rest: email/phone
  - export/delete lead endpoint
  - retention policy job (90/180/365)

Definition of Done:
- Тарифные ограничения реально блокируют превышение.
- PII поля шифруются и можно экспорт/удалить данные лида.

## 5) Product backlog (приоритеты)

P0 (обязательно для продаж):
1. Multi-tenant account/site model.
2. Widget embed + site key validation.
3. Linear Flow Engine.
4. Lead capture + storage.
5. Telegram notifications.
6. Dashboard Inbox + Leads.
7. Basic auth/roles.

P1 (сильно усиливает):
1. WebSocket realtime.
2. Email fallback.
3. WP plugin.
4. Billing + quotas.
5. GDPR consent + export/delete.

P2 (после первых продаж):
1. Branching conditions.
2. Operator assignment by working hours.
3. Reply bridge Telegram -> conversation.
4. Booking block + calendar sync.
5. Templates per niche.

## 6) Технические задачи по доменам

## Backend/API
1. Prisma schema: accounts, users, sites, flows, conversations, messages, leads, integrations, subscriptions.
2. Auth module + RBAC guards.
3. Widget public module.
4. Flow runtime module.
5. Lead module + status transitions.
6. Integrations module (telegram/email/webhook).
7. Billing module (stripe webhook).
8. Compliance module (consent/export/delete/retention).

## Frontend Dashboard
1. Auth pages + protected layout.
2. Inbox list/detail + message composer.
3. Leads table + filters + status actions.
4. Widget settings form.
5. Integrations pages (Telegram/Email/Webhook).
6. Billing page.

## Widget
1. Bootstrap loader + initialization by `data-key`.
2. Chat UI states (`idle/open/in_flow/handoff/completed`).
3. Flow question renderer by input type.
4. API client with retry + idempotency header.
5. Minimal telemetry emitter.

## WordPress Plugin
1. Admin settings page.
2. Option storage (site_key, enable, style basics).
3. Script injection hook.
4. Readme + install instructions.

## 7) Критические риски и решения
- Дубли сообщений/лидов при ретраях: обязательный idempotency key + unique index.
- Плохой UX виджета на мобиле: mobile-first layout + e2e smoke tests.
- Потери уведомлений: queue + retry + DLQ.
- Утечка PII: encryption at rest + не логировать email/phone в plaintext.
- Рост сложности flow: начать с linear, graph only after revenue signal.

## 8) Acceptance criteria MVP-1 (финальная проверка)
1. Владелец создает site + flow + telegram integration.
2. Сайт с widget script собирает лид за < 1 минуты.
3. Лид мгновенно отображается в dashboard.
4. В Telegram приходит карточка лида со ссылкой на conversation.
5. Оператор меняет статус лида в dashboard.
6. Ограничение тарифа (например leads/month) работает.

## 9) Как будем работать дальше (я + ты)
1. Ты даешь команду: `Начинаем M0` (или любой milestone).
2. Я создаю код, миграции, контракты API и прогоняю проверки.
3. После каждого шага выдаю:
   - что сделано;
   - какие файлы изменены;
   - как проверить локально;
   - что берем следующим шагом.
4. Если блокер по продукту: предлагаю 1-2 решения с trade-offs и продолжаю после твоего выбора.

## 10) Первый спринт (рекомендую стартовать с этого)
1. Инициализировать monorepo `/apps` + `/packages`.
2. Поднять `apps/api` с health endpoint и Prisma.
3. Поднять `apps/dashboard` с auth scaffold.
4. Сделать `apps/widget` bootstrap + demo embed page.
5. Описать начальные миграции таблиц.
6. Реализовать `POST /v1/widget/conversations`.
7. Реализовать `GET /v1/widget/config`.
8. Пробросить flow mock (2-3 question nodes) до сохранения лида.
