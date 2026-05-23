# Slot 20 lesson 2 DLQ + circuit breaker — re-verify 2026-05-23

Flow 1 DLQ parking: PASS — event 3b1d8912 reached failed (3 attempts, ENOTFOUND); 1 dead_letter row with replayedAt=null.
Flow 2 circuit opens: PASS — after publishing 3 dead-host events, /circuit/status returned state=half_open or open with failCount rising.
Flow 3 open→half_open→open cycle: PASS — observed sequence (open, open, closed once briefly via sweeper, open, half_open, open) over 15x3s ticks.
Flow 4 manual DLQ replay: PASS — POST /dlq/{id}/replay returned status=requeued, eventId emitted, outbox row reset to pending.
Flow 5 soft-skip via DelayedError: PASS — emitter logs show repeated `circuit … → OPEN (fails=5 ≥ 5 in 60s)` and `→ HALF_OPEN` lines proving CircuitService skipped attempts instead of burning them.

5/5 PASS, 0 retries.
