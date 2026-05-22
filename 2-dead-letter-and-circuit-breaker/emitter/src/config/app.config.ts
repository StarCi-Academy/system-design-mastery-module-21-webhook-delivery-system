import { registerAs } from "@nestjs/config"

export interface AppConfig {
    port: number
    webhookSecret: string
    redisUrl: string
    postgresUrl: string
    pollerEnabled: boolean
    pollerBatch: number
    workerEnabled: boolean
    queueName: string
    workerAttempts: number
    workerBackoffMs: number
    workerConcurrency: number
    receiverTimeoutMs: number
    circuitFailThreshold: number
    circuitFailWindowSec: number
    circuitOpenTtlSec: number
}

export const appConfig = registerAs("app", (): AppConfig => ({
    port: Number(process.env.PORT) || 3000,
    webhookSecret: process.env.WEBHOOK_SECRET ?? "shared-secret-demo",
    redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
    postgresUrl: process.env.POSTGRES_URL ?? "postgres://webhook:webhook@localhost:5432/webhook",
    pollerEnabled: (process.env.POLLER_ENABLED ?? "true") === "true",
    pollerBatch: Number(process.env.POLLER_BATCH) || 25,
    workerEnabled: (process.env.WORKER_ENABLED ?? "true") === "true",
    queueName: process.env.QUEUE_NAME ?? "webhook-deliver",
    workerAttempts: Number(process.env.WORKER_ATTEMPTS) || 4,
    workerBackoffMs: Number(process.env.WORKER_BACKOFF_MS) || 500,
    workerConcurrency: Number(process.env.WORKER_CONCURRENCY) || 4,
    receiverTimeoutMs: Number(process.env.RECEIVER_TIMEOUT_MS) || 5000,
    circuitFailThreshold: Number(process.env.CIRCUIT_FAIL_THRESHOLD) || 5,
    circuitFailWindowSec: Number(process.env.CIRCUIT_FAIL_WINDOW_SEC) || 60,
    circuitOpenTtlSec: Number(process.env.CIRCUIT_OPEN_TTL_SEC) || 30,
}))
