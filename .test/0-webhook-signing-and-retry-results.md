# Lesson 0 — Webhook Signing + Retry — e2e results

Stack: `docker compose up -d` (emitter on host port 3019, receiver-mock internal only).

## T1 — Happy path delivery
`POST /api/events/publish` with valid `targetUrl=http://receiver-mock:3000/api/hook` → PASS
- `finalStatus: "delivered"` after attempt 1 (status 200)
- HMAC-SHA256 signature `t=<ts>,v1=<hex>` accepted by receiver

## T2 — Receiver always fails (503) → exhausts retries
`targetUrl=…?fail=503` → PASS
- 3 attempts logged; `plannedDelayMs`: 0 → 1025ms → 3403ms (exponential 1s/3s + ±20% jitter)
- `finalStatus: "failed"` after attempts exhausted

## T3 — Forged signature rejected
Direct POST to `receiver-mock` with random hex signature → PASS
- 401 `{"message":"signature mismatch"}` from constant-time `timingSafeEqual`

## T4 — Replay protection (stale timestamp 1h old)
Direct POST with `X-Webhook-Timestamp` 3600s in past + valid signature for that ts → PASS
- 401 `{"message":"timestamp outside ±300s window (age=3600s)"}`

Teardown: `docker compose down -v` OK.
