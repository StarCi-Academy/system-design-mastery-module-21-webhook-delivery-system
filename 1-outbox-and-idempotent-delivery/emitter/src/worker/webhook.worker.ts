import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { Worker, type Job } from "bullmq"
import IORedis from "ioredis"
import axios from "axios"
import { createHmac } from "crypto"
import { OutboxService } from "../outbox/outbox.service"
import type { WebhookJobData } from "../outbox/outbox.poller"

@Injectable()
export class WebhookWorker implements OnModuleInit, OnModuleDestroy {
    private readonly log = new Logger(WebhookWorker.name)
    private worker!: Worker<WebhookJobData>
    private connection!: IORedis

    constructor(
        private readonly config: ConfigService,
        private readonly outbox: OutboxService,
    ) {}

    onModuleInit(): void {
        if (!this.config.get<boolean>("app.workerEnabled")) {
            this.log.warn("worker disabled via config")
            return
        }
        this.connection = new IORedis(this.config.get<string>("app.redisUrl") ?? "redis://localhost:6379", {
            maxRetriesPerRequest: null,
        })
        const queueName = this.config.get<string>("app.queueName") ?? "webhook-deliver"
        const concurrency = this.config.get<number>("app.workerConcurrency") ?? 4
        this.worker = new Worker<WebhookJobData>(
            queueName,
            async (job) => this.process(job),
            { connection: this.connection, concurrency },
        )

        this.worker.on("completed", (job) => {
            void this.outbox.markSent(job.data.eventId)
        })
        this.worker.on("failed", (job, err) => {
            if (!job) return
            const final = (job.attemptsMade ?? 0) >= (job.opts.attempts ?? 1)
            if (final) {
                void this.outbox.markFailed(job.data.eventId, err?.message ?? "unknown")
            } else {
                void this.outbox.incrementAttempt(job.data.eventId, err?.message ?? "unknown")
            }
        })
    }

    async onModuleDestroy(): Promise<void> {
        await this.worker?.close()
        await this.connection?.quit()
    }

    private sign(rawBody: string, ts: number): string {
        const secret = this.config.get<string>("app.webhookSecret") ?? "shared-secret-demo"
        return createHmac("sha256", secret).update(`${ts}.${rawBody}`).digest("hex")
    }

    private async process(job: Job<WebhookJobData>): Promise<void> {
        const { eventId, type, targetUrl, payload } = job.data
        const rawBody = JSON.stringify({ id: eventId, type, data: payload })
        const ts = Math.floor(Date.now() / 1000)
        const sig = this.sign(rawBody, ts)
        const res = await axios.post(targetUrl, rawBody, {
            headers: {
                "Content-Type": "application/json",
                "X-Webhook-Id": eventId,
                "X-Webhook-Timestamp": String(ts),
                "X-Webhook-Signature": `t=${ts},v1=${sig}`,
                "Idempotency-Key": eventId,
            },
            timeout: this.config.get<number>("app.receiverTimeoutMs") ?? 5000,
            validateStatus: () => true,
        })
        if (res.status < 200 || res.status >= 300) {
            throw new Error(`receiver returned ${res.status}`)
        }
    }
}
