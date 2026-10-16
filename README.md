# AI-Powered Support Ticket App

A small support-ticket application. A customer submits a **title**, **description** and **email**; the Express backend stores the ticket in SQLite and asks an OpenAI model to suggest a **category** (`Technical` | `Billing` | `General`) and a **priority** (`Low` | `Medium` | `High`). A Next.js dashboard lets you submit tickets, browse them with search, filters, sorting and pagination, and delete them.

| | |
|---|---|
| **Frontend** | Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| **Backend** | Node.js, Express 5, TypeScript, Zod, better-sqlite3 (SQLite) |
| **AI** | OpenAI Chat Completions with Structured Outputs (model is configurable) |
| **Tests** | Jest + Supertest (backend), Jest + React Testing Library (frontend) |

> **No OpenAI key? No problem.** The whole app still runs and **all tests pass without a key**. Without a key, tickets are saved with the documented fallback (`General` / `Medium`) and flagged as such. See [AI integration](#ai-integration).

---

## Quick start (clone → run)

**Prerequisites:** Node.js **20.9 or newer** (22 LTS recommended) and npm. An OpenAI API key is optional.

```bash
git clone <your-repo-url>
cd <repo-folder>
```

Run the **backend** (terminal 1):

```bash
cd backend
cp .env.example .env          # then edit .env and add OPENAI_API_KEY (optional)
npm install
npm run dev                   # API on http://localhost:4000
```

Run the **frontend** (terminal 2):

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev                   # UI on http://localhost:3000
```

Open **http://localhost:3000**, submit a ticket, and watch it appear in the list.

Quick API check: `curl http://localhost:4000/health` → `{"status":"ok"}`

### Troubleshooting

| Problem | Fix |
|---|---|
| `better-sqlite3` fails to install or load | It is a native module. Use a Node LTS version with prebuilt binaries (20/22), then `rm -rf node_modules && npm install`. On macOS you may need Xcode command line tools (`xcode-select --install`). |
| Port 4000 or 3000 already in use | Change `PORT` in `backend/.env`, and update `NEXT_PUBLIC_API_URL` in `frontend/.env.local` to match (restart the frontend after changing it). |
| UI shows "Could not reach the server" | The backend is not running, or `NEXT_PUBLIC_API_URL` points to the wrong address. |
| Browser CORS error | Set `CORS_ORIGIN` in `backend/.env` to the exact origin the UI runs on (comma-separate several). |
| Every ticket says "default" classification | `OPENAI_API_KEY` is missing/invalid, or the model name is wrong. Check the backend console for `AI classification failed` (it logs the reason, never the key). |

---

## Running the tests

Tests never call OpenAI and need no API key: the AI is replaced by a fake classifier, and each test uses its own in-memory SQLite database.

```bash
# Backend: unit + Supertest integration tests
cd backend
npm test                    # run once
npm run test:coverage       # with coverage report
npm run typecheck

# Frontend: component + API-client tests
cd frontend
npm test
npm run test:coverage
npm run lint
```

### How the assignment's required test cases are covered

| Required case | Where | What is asserted |
|---|---|---|
| Missing title | [backend/tests/integration/create-ticket.test.ts](backend/tests/integration/create-ticket.test.ts) | `400 VALIDATION_ERROR` with a `title` field message; nothing saved; AI not called |
| Invalid customer email | same file | `400`, `customerEmail` field message; **no ticket created** |
| Valid ticket | same file | `201`; classified, saved, response has `id`, `title`, `description`, `customerEmail`, `category`, `priority`, `aiStatus`, `createdAt`; DB row matches |
| AI service timeout | same file + [ticket.service.test.ts](backend/tests/unit/ticket.service.test.ts) | A classifier that never resolves → `201` fallback with reason `timeout`; request aborted; server still healthy; response/logs contain neither the API key nor a stack trace |
| Malformed AI response | same file + [openai.classifier.test.ts](backend/tests/unit/openai.classifier.test.ts) + [classification.test.ts](backend/tests/unit/classification.test.ts) | Non-JSON, empty, refusal, missing fields, wrong types → documented fallback with reason `invalid_response` |
| Invalid priority value | same files | `Urgent`, `Critical`, `high`, `HIGH`, ` High`, `""`, numbers, arrays are rejected; stored priority is always from the allowlist |
| List tickets | [backend/tests/integration/list-tickets.test.ts](backend/tests/integration/list-tickets.test.ts) | `200 { data, pagination }`, stored records returned newest first |

Extra coverage: deleting tickets (`204`, `404`, malformed id), every filter, text search (including `%`/`_` and SQL-injection attempts), sorting, pagination, query validation, malformed JSON (`400`), oversize body (`413`), unknown route (`404`), unexpected exception (`500` with a generic message), rate limiting (`429`), security headers, the OpenAI request shape (mocked SDK), env parsing, and DB-level `CHECK` constraints. The frontend tests cover form validation, the loading / success / fallback / error states, server field errors, list loading / empty / error / retry, debounced search, filters, sorting, pagination, deleting a row (success, failure, already-deleted, stepping back a page), and list refresh after submit.

### Test results

Output of the final run on the committed code (Node 22):

```text
backend:   Test Suites: 9 passed, 9 total   Tests: 100 passed, 100 total   (99.5% line coverage)
frontend:  Test Suites: 4 passed, 4 total   Tests: 34 passed, 34 total   (99% line coverage)
```

---

## Configuration

### Backend: `backend/.env` (copy from `.env.example`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | API port |
| `DATABASE_PATH` | `./data/tickets.db` | SQLite file (created automatically, git-ignored) |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed browser origin(s), comma separated |
| `OPENAI_API_KEY` | _(empty)_ | Your OpenAI key. Leave empty to run with the fallback only |
| `OPENAI_MODEL` | `gpt-5-mini` | Any chat model that supports Structured Outputs; pick a small, fast one |
| `AI_TIMEOUT_MS` | `8000` | Max wait for the AI before using the fallback |

### Frontend: `frontend/.env.local` (copy from `.env.example`)

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | Backend base URL |

Real secrets live only in `.env` / `.env.local`, which are git-ignored. Only the `.env.example` templates (with no secrets) are committed.

---

## API reference

All responses are JSON. Errors always use the same shape: `{ "error": { "code", "message", "details?" } }`.

### `POST /api/tickets`: create a ticket

```bash
curl -X POST http://localhost:4000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{"title":"Charged twice","description":"I was billed twice for May.","customerEmail":"jane@example.com"}'
```

`201 Created`

```json
{
  "data": {
    "id": "0b6c2c1e-6f0e-4c53-9f57-2a1f7c1f9a10",
    "title": "Charged twice",
    "description": "I was billed twice for May.",
    "customerEmail": "jane@example.com",
    "category": "Billing",
    "priority": "Medium",
    "aiStatus": "classified",
    "aiFallbackReason": null,
    "createdAt": "2026-10-15T10:01:05.147Z"
  }
}
```

| Field | Rules |
|---|---|
| `title` | required, trimmed, 1–200 chars |
| `description` | required, trimmed, 1–5000 chars |
| `customerEmail` | required, valid email, ≤254 chars, lower-cased |

`category` / `priority` sent by the client are ignored (unknown keys are stripped).

`400` validation error:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Request validation failed",
             "details": [{ "field": "title", "message": "Title is required" }] } }
```

### `GET /api/tickets`: list tickets

| Query param | Values | Default |
|---|---|---|
| `category` | `Technical` \| `Billing` \| `General` | all |
| `priority` | `Low` \| `Medium` \| `High` | all |
| `q` | text, ≤100 chars; searches title, description, email | none |
| `sort` | `newest` \| `oldest` \| `priority` (high → low) | `newest` |
| `page` | integer ≥ 1 | `1` |
| `limit` | integer 1–50 | `10` |

```bash
curl "http://localhost:4000/api/tickets?category=Billing&priority=High&sort=priority&page=1&limit=10"
```

`200 OK`

```json
{
  "data": [ { "id": "…", "title": "…", "category": "Billing", "priority": "High", "…": "…" } ],
  "pagination": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
}
```

### `DELETE /api/tickets/:id`: delete a ticket

```bash
curl -X DELETE http://localhost:4000/api/tickets/0b6c2c1e-6f0e-4c53-9f57-2a1f7c1f9a10
```

`204 No Content` on success. `404 TICKET_NOT_FOUND` if the id does not exist, `400 VALIDATION_ERROR` if the id is not a UUID. In the UI this is the red trash icon at the end of each row.

### `GET /health`: `200 {"status":"ok"}`

### Status codes

| Code | Meaning |
|---|---|
| `201` | Ticket created (also when the AI failed and the fallback was used) |
| `204` | Ticket deleted |
| `400` | `VALIDATION_ERROR` or `INVALID_JSON` |
| `404` | `NOT_FOUND` (unknown route) or `TICKET_NOT_FOUND` (unknown ticket id) |
| `413` | `PAYLOAD_TOO_LARGE` (body limit 16 KB) |
| `429` | `RATE_LIMITED` (30 ticket creations / minute / IP) |
| `500` | `INTERNAL_ERROR`: generic message; details are logged server-side only |

---

## AI integration

Code: [backend/src/services/ai/](backend/src/services/ai/)

- **Behind an interface.** `TicketClassifier` (`types.ts`) is the only thing the ticket service knows about. `createOpenAiClassifier()` builds the real implementation; tests inject a fake, so no SDK mocking or network is needed.
- **Structured Outputs.** The request asks for a JSON schema with `enum`s for category and priority (`strict: true`).
- **AI output is untrusted.** Even with Structured Outputs, the response is parsed and re-validated against exact allowlists (`classification.ts`): no case folding, no coercion, no extra keys. The service validates again before saving (defence in depth), and the database has `CHECK` constraints as a last line.
- **Prompt-injection hygiene.** Ticket text is wrapped in `<ticket>` tags and the system prompt tells the model to treat it as data. Even a successful injection can only ever produce one of the allowlisted values.
- **Timeout.** The service enforces `AI_TIMEOUT_MS` itself (`withTimeout`) and aborts the in-flight request, so a hung call can never hang a request.
- **Documented fallback.** If the AI times out, errors, refuses, or returns anything outside the allowlists, the ticket is **still saved** with `category: General`, `priority: Medium`, `aiStatus: "fallback"` and an `aiFallbackReason` (`timeout`, `ai_error`, `invalid_response` or `ai_unavailable`). The API still returns `201` and the UI shows a "Default classification used" notice, so users never lose a ticket because of an AI outage.
- **No secrets leaked.** The key is read only from the environment. Upstream error messages are never returned to clients or logged verbatim (only the error class name is kept).
- **No key configured.** The server starts with a warning and uses `createUnavailableClassifier()` (reason `ai_unavailable`).

---

## Project structure

```text
.
├── README.md
├── AI_USAGE.md                    # AI tools used + what they helped with
├── backend/
│   ├── .env.example
│   ├── src/
│   │   ├── server.ts              # composition root: env, DB, classifier, listen
│   │   ├── app.ts                 # createApp(): Express app without listen (used by Supertest)
│   │   ├── config/env.ts          # Zod-validated environment
│   │   ├── routes/                # URL → controller wiring
│   │   ├── controllers/           # HTTP in/out only, no logic
│   │   ├── services/
│   │   │   ├── ticket.service.ts  # business logic: classify (with fallback) → persist
│   │   │   └── ai/                # classifier interface, OpenAI impl, allowlist validation
│   │   ├── repositories/          # SQL only (better-sqlite3, parameterised queries)
│   │   ├── db/connection.ts       # opens SQLite + creates schema
│   │   ├── validation/            # Zod schemas for body and query
│   │   ├── middleware/            # validate, not-found, central error handler
│   │   └── errors/, utils/, types/
│   └── tests/
│       ├── unit/                  # classification, service, OpenAI classifier, repository, env
│       ├── integration/           # Supertest: create, list, errors
│       └── helpers/               # fake classifier, test app builder (in-memory DB)
└── frontend/
    ├── .env.example
    └── src/
        ├── app/                   # layout + page
        ├── components/            # ticket-form, ticket-list, filters, table, pagination, ui/ (shadcn)
        ├── lib/                   # typed API client, validation, formatting
        └── __tests__/             # React Testing Library + API client tests
```

Request flow: `route → validate (Zod) → controller → TicketService → { TicketClassifier (AI), TicketRepository (SQLite) }`, with every error funnelled through one error-handling middleware.

## Design notes

- **Express 5**: async handlers propagate rejections to the error middleware without wrappers.
- **Functions over classes**: there are no `class` declarations. Services, repositories and classifiers are factory functions (`createTicketService`, `createTicketRepository`, `createOpenAiClassifier`) that return plain objects typed by an interface. Custom errors are factories plus type guards (`createAppError` / `isAppError`, `createClassifierError` / `isClassifierError`, `createTimeoutError` / `isTimeoutError`, `createApiError` / `isApiError`). The frontend uses function components and hooks only.
- **Dependency injection** (`createApp({ ticketService })`, `createTicketService({ repository, classifier })`) keeps modules decoupled and tests simple.
- **Security**: `helmet`, CORS allowlist, 16 KB body limit, rate limit on ticket creation, parameterised SQL, whitelisted `ORDER BY`, escaped `LIKE` wildcards, strict env validation.
- **Server-side filtering/pagination** keeps the API scalable; the UI debounces search and discards stale responses with `AbortController`.
- **SQLite** is used for simplicity. Swapping to PostgreSQL/MySQL only touches `db/` and `repositories/`.

## Production build

```bash
cd backend  && npm run build && npm start     # compiles to dist/ and runs it
cd frontend && npm run build && npm start     # Next.js production server
```

## Known limitations

- No authentication or ticket status/assignment workflow (out of scope for the assignment). Deleting a ticket is immediate, with no confirmation or undo.
- No live OpenAI call is exercised by the automated tests by design; verify the real integration manually with your key.
- The schema is created with `CREATE TABLE IF NOT EXISTS`; there is no migration tool.

## AI tools used

See [AI_USAGE.md](AI_USAGE.md).
