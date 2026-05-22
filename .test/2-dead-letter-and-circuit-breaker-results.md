# Lesson 2 — Dead-Letter Queue + Circuit Breaker — e2e results

Stack: `docker compose up -d` (emitter:3021, postgres:5437, redis:6399).

## T1 — DLQ parking
`POST /api/events/publish` to `http://nonexistent-host:9999/api/hook` → PASS
- BullMQ exhausts 4 attempts (DNS `ENOTFOUND`)
- Row appears in `dead_letter` table: `attempts=3, lastError="getaddrinfo ENOTFOUND nonexistent-host", replayedAt=null`
- `GET /api/dlq` returns the parked row.

## T2 — Circuit breaker opens then transitions
Publish 3 events targeting `nonexistent-host:9999` (each gets 4 retry attempts) → ~12 failures > threshold `5` → PASS
- `GET /api/circuit/status?host=nonexistent-host:9999` observed:
  - `state=closed, failCount=5` → `state=open` (after threshold cross)
  - 20s `circuitOpenTtlSec` expires → sweeper flips → `state=half_open`
  - Next worker pickup runs as **single probe** (Redis `SET NX` guard on `circuit:probe:<host>`)
  - Probe fails → back to `state=open` (20s TTL again)
  - This loop visible in 15-tick state-watch script.

## T3 — DLQ replay
`POST /api/dlq/<id>/replay` → PASS
- Response: `{"replayedDlq":"…","eventId":"…","status":"requeued"}`
- DLQ row `replayedAt` set; outbox row reset to `status=pending, attempts=0`
- Poller re-enqueues within ~500ms; if circuit is open, the job is moved to delayed (5s) without burning an attempt (BullMQ `DelayedError` pattern).

## T4 — DelayedError soft-skip when circuit open
With circuit open and an event still in flight, the worker:
- Calls `circuit.allowRequest(host)` → returns `{allow: false}`
- Calls `job.moveToDelayed(now+5000)` + throws `DelayedError`
- Job retries in 5s without incrementing `attemptsMade` → event never lands in DLQ purely due to circuit (only real receiver failures count).

## T5 — Circuit success closes after probe
(Implied path) When the probe succeeds → `state=closed, failCount=0`. The `recordSuccess(host, isProbe=true)` path deletes `circuit:state:<host>` + `circuit:fail:<host>` + `circuit:probe:<host>` atomically.

Teardown: `docker compose down -v` OK.
