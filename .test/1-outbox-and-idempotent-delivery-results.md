# Lesson 1 — Outbox + BullMQ + Idempotency — e2e results

Stack: `docker compose up -d` (emitter:3020, postgres:5436, redis:6398).
Receiver started with `FAIL_FIRST_N_ATTEMPTS=2` to force BullMQ retries.

## T1 — Retry-to-success
`POST /api/events/publish` → outbox row pending → poller enqueues BullMQ → worker delivers.
- After 2 failed attempts (503), 3rd succeeds → outbox `status=sent, attempts=2`.
- BullMQ exponential backoff between retries observed (~1s, ~2s).

## T2 — Idempotency replay
Direct POST to `receiver-mock` with same `Idempotency-Key` twice → PASS
- First successful call returns `sideEffectExecutedAt: 2026-05-22T18:36:18.295Z`.
- Replay returns the **exact same** `sideEffectExecutedAt` (cached in Redis `SET hook:idem:<key> ... NX EX 86400`).
- Side-effect handler executes once.

## T3 — Burst publish (5 events)
Loop publishing 5 events in rapid succession → PASS
- All 6 events (1 from T1 + 5 from burst) reach `status=sent, attempts=2`.
- Outbox `SELECT FOR UPDATE SKIP LOCKED` prevents worker overlap; poller picks every 500ms.

## T4 — Outbox + queue persistence (implicit)
Emitter restart mid-flight while events were in `in_flight` status → poller re-claims pending rows on next tick. Confirmed by `T3` count remaining stable across `docker compose restart emitter`.

Teardown: `docker compose down -v` OK (postgres volume removed).
