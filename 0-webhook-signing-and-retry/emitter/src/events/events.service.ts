import { Injectable } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import axios, { AxiosError } from "axios"
import { createHmac, randomUUID } from "crypto"

export interface Attempt {
    attempt: number
    plannedDelayMs: number
    startedAt: string
    status: number | null
    error?: string
}

export interface DeliveryRecord {
    eventId: string
    type: string
    targetUrl: string
    payload: Record<string, unknown>
    createdAt: string
    finalStatus: "delivered" | "failed" | "in_progress"
    attempts: Attempt[]
}

@Injectable()
export class EventsService {
    private readonly records = new Map<string, DeliveryRecord>()

    constructor(private readonly config: ConfigService) {}

    publish(type: string, payload: Record<string, unknown>, targetUrl: string) {
        const eventId = randomUUID()
        const record: DeliveryRecord = {
            eventId, type, targetUrl, payload,
            createdAt: new Date().toISOString(),
            finalStatus: "in_progress",
            attempts: [],
        }
        this.records.set(eventId, record)
        void this.deliverWithRetry(record)
        return { eventId, status: "scheduled", maxAttempts: this.maxAttempts }
    }

    get(eventId: string): DeliveryRecord | null {
        return this.records.get(eventId) ?? null
    }

    private get secret(): string {
        return this.config.get<string>("app.webhookSecret") ?? "shared-secret-demo"
    }

    private get maxAttempts(): number {
        return this.config.get<number>("app.maxAttempts") ?? 3
    }

    private get backoffSchedule(): number[] {
        return this.config.get<number[]>("app.backoffMs") ?? [1000, 5000, 25000]
    }

    /** Stable jitter ±20% derived from eventId so retries are reproducible. */
    private jitter(base: number, eventId: string, attempt: number): number {
        const h = createHmac("sha256", "jitter").update(`${eventId}:${attempt}`).digest()
        const f = (h.readUInt32BE(0) / 0xffffffff) * 0.4 - 0.2
        return Math.max(0, Math.round(base * (1 + f)))
    }

    private sign(rawBody: string, timestamp: number): string {
        return createHmac("sha256", this.secret)
            .update(`${timestamp}.${rawBody}`)
            .digest("hex")
    }

    private async deliverWithRetry(record: DeliveryRecord): Promise<void> {
        const rawBody = JSON.stringify({
            id: record.eventId,
            type: record.type,
            data: record.payload,
        })

        for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
            const baseDelay = attempt === 1
                ? 0
                : this.backoffSchedule[Math.min(attempt - 2, this.backoffSchedule.length - 1)]
            const plannedDelayMs = attempt === 1 ? 0 : this.jitter(baseDelay, record.eventId, attempt)
            if (plannedDelayMs > 0) {
                await new Promise((r) => setTimeout(r, plannedDelayMs))
            }

            const timestamp = Math.floor(Date.now() / 1000)
            const signature = this.sign(rawBody, timestamp)
            const a: Attempt = {
                attempt, plannedDelayMs,
                startedAt: new Date().toISOString(),
                status: null,
            }
            record.attempts.push(a)

            try {
                const res = await axios.post(record.targetUrl, rawBody, {
                    headers: {
                        "Content-Type": "application/json",
                        "X-Webhook-Id": record.eventId,
                        "X-Webhook-Timestamp": String(timestamp),
                        "X-Webhook-Signature": `t=${timestamp},v1=${signature}`,
                    },
                    timeout: 5000,
                    validateStatus: () => true,
                })
                a.status = res.status
                if (res.status >= 200 && res.status < 300) {
                    record.finalStatus = "delivered"
                    return
                }
                a.error = `non-2xx ${res.status}`
            } catch (err) {
                const e = err as AxiosError
                a.status = e.response?.status ?? 0
                a.error = e.message
            }
        }
        record.finalStatus = "failed"
    }
}
