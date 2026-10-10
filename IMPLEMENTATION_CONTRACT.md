# MENTRA LIFE implementation contract

Source: Mentra_Life_Mapa_de_Implementacao.pdf. This is a working LOCAL webapp of phase-1 internal core, NOT an assertion that external integrations or launch are approved. PT-BR UI. No seeded fake user data. SQLite via node:sqlite. Node >=24, Express, React/Vite. Persistent real accounts and sessions via HttpOnly cookie. Same origin /api. Default PORT 3000 on 127.0.0.1. Serve dist in production. Errors JSON {error:string}. Responses JSON. Account isolation on EVERY object operation. Parameterized SQL, scrypt passwords, hashed random sessions, Origin checks for mutating cookie requests, rate limiting. No provider credentials in frontend.

## API contract (backend and frontend MUST follow)
User shape: {id,name,email,timezone,onboarded,preferences:{morningSummary:boolean,eveningSummary:boolean,proactivity:string},plan:'free'}.
Item shape: {id,type:'task'|'event'|'reminder'|'memory',title,notes:string,dueAt:string|null,status:'pending'|'completed',priority:boolean,source:string,createdAt,updatedAt}. dates ISO UTC, display user's timezone. memory source visible/editable. Max 3 pending priorities.
Message shape {id,role:'user'|'assistant',content,createdAt}.
GET /api/health -> {ok:true}
POST /api/auth/register {name,email,password,timezone} -> {user} session cookie
POST /api/auth/login {email,password} -> {user} session cookie
POST /api/auth/logout {} -> {ok:true}
GET /api/auth/me -> {user} or 401
PATCH /api/profile {name?,timezone?,onboarded?,preferences?} -> {user}
GET /api/items?type=&q=&status= -> {items}
POST /api/items {type,title,notes?,dueAt?,priority?,source?} -> {item,undoId}
PATCH /api/items/:id {title?,notes?,dueAt?,status?,priority?} -> {item,undoId}
DELETE /api/items/:id -> {ok:true,undoId}
POST /api/undo/:undoId {} -> {ok:true} one-shot account-scoped transactional undo. Guard conflicting changes.
GET /api/messages -> {messages}
POST /api/chat {text,requestId} -> {reply,items:[],undoId?:string,clarification?:boolean,mode:'local'|'ai'} persists user/assistant messages. requestId idempotency scoped per account. Deterministic local PT Portuguese capture/query/correction fallback; HONEST local mode labels, no pretend LLM. If ambiguous ask only missing detail, conversation pending persisted. Explicit resolved date in reply. Example 'Tenho dentista quinta às 10 e preciso levar os exames.' yields event plus preparation task transactionally; 'Me lembra sexta de enviar o contrato.' reminder with explicit date; 'Não, sábado.' updates same object cancels old due time without duplicates. 'desfazer' and Undo button. User zone respected; ambiguous dates/times ask not invent. Queries 'o que tenho hoje?', 'minhas tarefas', 'minhas memórias'. Can implement OpenAI optional configured server-side; do NOT claim verified absent keys.
GET /api/summary -> {text,priorities:[],upcoming:[],pendingCount:number} derived data (not fake)
GET /api/export -> full authorized account JSON attachment
DELETE /api/account {confirmation:'EXCLUIR'} -> {ok:true} deletes ALL account-owned data including sessions logs messages undo etc clears cookie.
GET /api/calendar.ics -> authorized downloadable calendar ICS of user's pending dated items; label EXPORT only not external synchronization.
GET /api/integrations -> {calendar:'export-only',whatsapp:'unconfigured',billing:'unconfigured',ai:'local'|'configured',notifications:'browser-only'} honest statuses. No fake premium activation/payment.

## Frontend
Four tabs Hoje Mentra Vida Eu. Auth register/login, progressive onboarding/context and first capture. Today next events/pending reminders/at most3 priorities/summary. Chat with PT-BR suggestions, voice via optional browser SpeechRecognition permission+unsupported+error handling, real server saves no optimistic saved claims. Life search/filter by type/status, manual add/edit/delete/complete/prioritize; editable memory/source. Eu profile name/timezone/preferences, privacy/export/delete, logout, honest free/premium not for sale and integrations states, calendar download. Browser notifications permission progressive; foreground-only scheduling dedupe/cancel when data edits, clearly cannot promise closed-browser delivery. Dashboard NO invented metrics or items. Empty/loading/error/success states accessible labels focus and 44px targets, mobile bottom navigation. Typography Segoe UI humanist chosen for Windows legibility, forest green accent, warm off-white, ink, restrained borders. Primary surface Operate, secondary Monitor, no marketing hero grid.

## ownership for parallel work
Backend agent owns server/** and tests/backend.test.js and tests/parser.test.js only. Frontend agent owns src/** index.html vite.config.js tests/frontend.test.js only. Parent owns package.json lockfile e2e/** playwright.config.js README docs env example scripts Dockerfile. Do not overwrite another agent's files. Install handled by parent. Use strict test-first vertical red-green tests, run actual tests. Report test commands/results/paths and remaining limitations. No git commit needed.
