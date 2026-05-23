# Slot 20 lesson 0 webhook signing — re-verify 2026-05-23

Flow 1 happy delivery: PASS — publish 201; GET finalStatus=delivered, attempts[0].status=200.
Flow 2 exhausted retries: PASS — finalStatus=failed, 3 attempts with plannedDelayMs 0/1132/2811 (exp backoff + jitter), all 503.
Flow 3 forged signature: PASS — 401 signature mismatch.
Flow 4 replay window: PASS — 401 timestamp outside ±300s window (age=3600s).

4/4 PASS, 0 retries.
