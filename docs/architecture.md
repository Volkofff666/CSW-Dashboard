# Architecture (M0)

## Components
- `apps/widget`: embeddable JS widget bundle.
- `apps/api`: REST/WebSocket backend and worker entrypoint.
- `apps/dashboard`: operator/admin UI.
- `apps/wp-plugin`: WordPress installer channel.
- PostgreSQL for transactional data.
- Redis for queues/events.

## Runtime flow
1. Widget calls API public endpoints.
2. API persists data in PostgreSQL.
3. API emits async jobs to Redis queue.
4. Worker consumes jobs and delivers notifications/integrations.
5. Dashboard reads API + receives WS updates.

