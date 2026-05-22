import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { Queue } from "bullmq"
import IORedis from "ioredis"
import { OutboxService } from "./outbox.service"

export interface WebhookJobData {
    eventId: string
    type: string
    targetUrl: string
    payload: Record<string, unknown>
}

@Injectable()
export class OutboxPoller implements OnModuleInit, OnModuleDestroy {
    private readonly log = new Logger(OutboxPoller.name)
    private queue!: Queue<WebhookJobData>
    private connection!: IORedis
    private timer: NodeJS.Timeout | null = null

    constructor(
        private readonly outbox: OutboxService,
        private readonly config: ConfigService,
    ) {}

    onModuleInit(): void {
        if (!this.config.get<boolean>("app.pollerEnabled")) {
            this.log.warn("poller disabled via config")
            return
        }
        this.connection = new IORedis(this.config.get<string>("app.redisUrl") ?? "redis://localhost:6379", {
            maxRetriesPerRequest: null,
        })
        const queueName = this.config.get<string>("app.queueName") ?? "webhook-deliver"
        this.queue = new Queue<WebhookJobData>(queueName, { connection: this.connection })
        this.timer = setInterval(() => void this.tick(), 500)
    }

    async onModuleDestroy(): Promise<void> {
        if (this.timer) clearInterval(this.timer)
        await this.queue?.close()
        await this.connection?.quit()
    }

    private async tick(): Promise<void> {
        try {
            const batch = this.config.get<number>("app.pollerBatch") ?? 25
            const rows = await this.outbox.claimPending(batch)
            for (const row of rows) {
                await this.queue.add(
                    "deliver",
                    {
                        eventId: row.id,
                        type: row.type,
                        targetUrl: row.targetUrl,
                        payload: row.payload,
                    },
                    {
                        jobId: row.id,
                        attempts: this.config.get<number>("app.workerAttempts") ?? 5,
                        backoff: {
                            type: "exponential",
                            delay: this.config.get<number>("app.workerBackoffMs") ?? 1000,
                        },
                        removeOnComplete: { age: 3600, count: 1000 },
                        removeOnFail: false,
                    },
                )
            }
        } catch (err) {
            this.log.error(`poller tick failed: ${(err as Error).message}`)
        }
    }
}
