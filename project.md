1) Название и позиционирование

Проект: Conversational Sales Widget (SaaS)
Ценность: превращает сайт SMB в “машину лидов” 24/7: квалификация → сбор контакта → уведомления → запись на созвон → мини-CRM.
Каналы установки:

JS-виджет (для любого сайта)

WordPress-плагин (упрощённая установка и настройки)

2) Роли и сущности
Роли

Owner (владелец аккаунта): биллинг, настройки, доступ ко всему

Admin: управление сайтом, сценариями, операторами

Operator: отвечает на диалоги, видит лиды, может назначать статусы

Viewer (опционально): только просмотр

Основные сущности (multi-tenant)

Tenant/Account: организация

Site: конкретный сайт (домен) внутри аккаунта

WidgetConfig: настройки виджета (брендинг, правила)

Flow: сценарий/диалоговый “скрипт” (no-code)

Conversation: сессия общения посетителя

Message: сообщения (visitor/bot/operator/system)

Lead: собранные контакты + ответы

OperatorAssignment: назначение диалога оператору

Integration: Telegram, Email, Webhook, Calendar

Subscription: тариф/лимиты

3) Пользовательские сценарии (End-to-End)
A) Самый частый: “Лид за 30 секунд”

Посетитель открывает страницу → виджет грузится

Виджет показывает welcome + CTA (например: “Подберу решение за 30 секунд”)

Запускается Flow:

вопрос 1 (тип услуги)

вопрос 2 (сроки)

вопрос 3 (бюджет/объём)

сбор контакта (email/телефон)

Система создаёт Lead, привязывает к Conversation

Отправляет уведомление:

Telegram владельцу/оператору

Email (fallback)

Оператор может ответить из панели (или из Telegram, если включён reply-bridge)

Лид получает статус (New / Qualified / Won / Lost)

B) “Ночь/выходные” (Operator offline)

Flow собирает контакт и обещает ответ в рабочее время

Система шлёт уведомления

Наутро оператор видит лиды в Inbox/Leads

C) “Запись на созвон”

Flow → блок “Booking”

Пользователь выбирает слот

Интеграция с календарём создаёт событие

Отправка подтверждения + напоминания

D) “Ручной чат”

Пользователь пишет свободный текст

Если оператор online → чат назначается оператору

Если нет → автоответ + сбор контакта

4) Логика виджета и Flow Engine
4.1 Виджет (клиент)

Цели:

быстрый рендер (LCP-friendly)

устойчивость (offline queue, retries)

минимальный сбор данных (GDPR)

Состояния:

idle (не открыт)

open (видим UI)

in_flow (бот ведёт сценарий)

handoff (перевод на оператора)

closed / completed

Идентификация:

visitor_id (анонимный UUID в localStorage/cookie)

conversation_id создаётся сервером при старте сессии

site_id из data-key

События:

page_view

widget_open

flow_start

answer_submitted

lead_created

operator_assigned

message_sent/received

booking_confirmed

4.2 Flow Engine (сервер)

Flow = граф узлов (node graph). Узлы:

message (текст/кнопки)

question (input types: text/email/phone/select/date/number)

condition (ветвление по ответу/стране/UTM/времени)

action:

save_lead_field

set_tag

notify_telegram/email

webhook_call

assign_operator

handoff (перевод в ручной чат)

booking (интеграция календаря)

end

Правила выполнения:

Flow исполняется по шагам; текущий node_id хранится в Conversation.state

Каждый ответ валидируется на сервере

Идемпотентность: event_id/client_msg_id чтобы не было дублей при ретраях

5) Уведомления и интеграции
Telegram (must-have)

Подключение: Owner нажимает “Connect Telegram” → получает deep-link → бот выдаёт chat_id → сохраняем integration

Уведомления:

новый лид (карточка: сайт, ответы, контакт, ссылка на conversation)

новое сообщение

Reply-bridge (опционально MVP+):

ответы в Telegram пересылаются в Conversation как operator message

Email (fallback)

SMTP provider / transactional email (любой)

Шаблоны: new_lead, booking_confirmation, daily_digest (опционально)

Webhook (для продвинутых)

POST на URL клиента при событиях: lead_created, conversation_started, booking_confirmed

Calendar (MVP+)

минимально: “internal booking slots” без интеграции

лучше: Google Calendar OAuth + создание событий

6) WordPress-плагин (канал установки)

Функция: максимально упростить внедрение.

Поле API Key / Site Key

Toggle enable/disable

Базовые настройки (позиция, цвет, welcome)

Авто-инжект <script src=... data-key=...> во все страницы

(опционально) исключения по страницам/ролям

Важно: логика чата/CRM НЕ внутри WP. WP — только инсталлятор и лёгкая конфигурация.

7) Админка (Dashboard)

Разделы:

Inbox

список conversations (New/Assigned/Closed)

чат-окно, быстрые ответы, заметки

Leads

таблица лидов, статусы, теги, экспорт CSV

Flows

конструктор сценариев (MVP: простой пошаговый редактор; позже граф)

Operators

пользователи, роли, рабочие часы, распределение

Widget

стиль, тексты, триггеры

Integrations

Telegram, Email, Webhook, Calendar

Billing

тариф, лимиты, invoices

8) Тарифы и лимиты (минимальная модель)

Ограничения (rate/quotas):

кол-во сайтов

кол-во операторов

кол-во conversations/мес

кол-во leads/мес

доступ к integrations

watermark “Powered by …” (free plan)

Биллинг:

Stripe subscriptions

webhook listener (invoice paid, subscription updated, etc.)

middleware для проверки лимитов на событиях (conversation_start, lead_create)

9) GDPR и EU-логика

MVP требования:

чекбокс “Согласен с privacy policy” перед сбором контакта (настраиваемо)

хранить минимум PII, шифровать чувствительные поля (email/phone) at-rest

endpoint “export/delete lead data” для админки

настраиваемая retention policy (например 90/180/365 дней)

10) Техническая архитектура (рекомендованная)
Компоненты

CDN: отдача widget.js

API: REST + WebSocket (realtime inbox)

DB: PostgreSQL

Queue: Redis + worker (уведомления, webhooks, email)

Object storage (опционально): файлы/вложения

Потоки

Widget → API: create_conversation, send_message, submit_answer

API → WS dashboard: new_message, new_lead, assignment events

Workers: telegram/email/webhook delivery with retries

11) Схема данных (минимально)

Таблицы (упрощённо):

accounts(id, name, created_at)

users(id, account_id, email, role, password_hash, created_at)

sites(id, account_id, domain, public_key, created_at)

widget_configs(site_id, settings_json, updated_at)

flows(id, site_id, name, graph_json, is_active, updated_at)

conversations(id, site_id, visitor_id, status, current_node_id, meta_json, created_at, updated_at)

messages(id, conversation_id, sender_type, text, payload_json, created_at)

leads(id, site_id, conversation_id, name, email_enc, phone_enc, fields_json, status, created_at)

assignments(id, conversation_id, operator_user_id, created_at)

integrations(id, site_id, type, credentials_enc_json, created_at)

subscriptions(account_id, plan, status, stripe_customer_id, stripe_sub_id, limits_json)

12) API (MVP набор)
Public (Widget)

POST /v1/widget/conversations → create conversation

POST /v1/widget/messages → send visitor message

POST /v1/widget/answers → submit answer (for flow question node)

GET /v1/widget/config?site_key=... → widget config + active flow metadata

Dashboard (Auth)

GET /v1/conversations?status=...

GET /v1/conversations/:id/messages

POST /v1/conversations/:id/messages (operator message)

GET /v1/leads

PATCH /v1/leads/:id (status/tags/notes)

GET/POST/PATCH /v1/flows

POST /v1/integrations/telegram/connect

POST /v1/billing/stripe/webhook

WebSocket:

/ws события: conversation.updated, message.created, lead.created

13) MVP план (самый быстрый)
MVP-1 (продаваемый)

Widget UI + базовые стили

Flow: линейный сценарий (без сложного графа)

Lead capture (email/phone + 2–4 вопроса)

Telegram notifications

Dashboard: Inbox + Leads

Basic billing (или даже manual invoicing на старте)

WP plugin: inject script

MVP-2 (усиление)

branching conditions

operator assignment + working hours

webhook + email templates

referral codes + watermark

booking (хотя бы простой)

14) “Киллер-логика” для быстрых продаж

Главный outcome: “Мы не чат. Мы генератор лидов 24/7”.
Обязательные фичи для ROI:

lead capture даже без оператора

квалификация (вопросы до контакта)

мгновенное уведомление в Telegram

простая установка (WP plugin + 1 строка кода)

быстрые шаблоны flows (для ниш: клиника/юрист/ремонт/агентство)