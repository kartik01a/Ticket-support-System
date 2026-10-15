# AI Tools Used

## Development assistance

| Tool | Used for |
|---|---|
| **Claude Code** (Anthropic CLI, Claude Opus 5.5 / Sonnet 5.5) | Reading the assignment brief and clarifying requirements; planning the architecture and folder structure; generating the initial scaffolding, backend (routes, controllers, service, repository, validation, error handling, OpenAI integration), frontend (components, API client, styling), the Jest / Supertest / React Testing Library test suites, and the README; running the type checker, linters, tests and a local smoke test against the running apps. |
| `create-next-app` and `shadcn` CLIs | Standard project scaffolding and UI component sources (not AI). |

## AI inside the product

The app itself calls the **OpenAI API** (default model `gpt-5-mini`, configurable via `OPENAI_MODEL`) to classify each ticket. See "AI integration" in the [README](README.md).

## Decisions I (the candidate) made

- OpenAI as the provider; failure policy = save the ticket with a documented `General` / `Medium` fallback instead of rejecting it.
- better-sqlite3 with a plain-SQL repository (in-memory DB in tests); separate `frontend/` and `backend/` folders.
- Server-side filtering, sorting and pagination.

## Review checklist (what to verify and be able to explain)

- [ ] **AI integration**: the `TicketClassifier` interface, the Structured Outputs request, and why the output is re-validated even though a schema is requested.
- [ ] **Error paths**: timeout (`withTimeout` + abort), SDK errors, refusals, malformed JSON, out-of-allowlist values → one fallback path; unexpected errors → generic `500`.
- [ ] **Validation**: Zod on body and query, stripped unknown keys, enum allowlists, DB `CHECK` constraints.
- [ ] **Security**: secrets only via env, no secrets or upstream messages in responses/logs, parameterised SQL, escaped `LIKE`, whitelisted `ORDER BY`, helmet/CORS/rate limit.
- [ ] **Test strategy**: fake classifier injected through the service (no network, no key), in-memory SQLite per test, Supertest against `createApp()`, one test per row in the assignment's table plus edge cases; frontend tests mock only the API client.
- [ ] Ran the app manually with a real `OPENAI_API_KEY` and checked a few real classifications.
