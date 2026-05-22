import { registerAs } from "@nestjs/config"

export interface AppConfig {
    port: number
    webhookSecret: string
    timestampSkewSeconds: number
    redisUrl: string
    idempotencyTtlSeconds: number
    /** Comma-separated list of attempt indexes that should fail per eventId (debug knob). */
    failFirstNAttempts: number
}

export const appConfig = registerAs("app", (): AppConfig => ({
    port: Number(process.env.PORT) || 3000,
    webhookSecret: process.env.WEBHOOK_SECRET ?? "shared-secret-demo",
    timestampSkewSeconds: Number(process.env.TIMESTAMP_SKEW_SECONDS) || 300,
    redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
    idempotencyTtlSeconds: Number(process.env.IDEMPOTENCY_TTL_SECONDS) || 86400,
    failFirstNAttempts: Number(process.env.FAIL_FIRST_N_ATTEMPTS) || 0,
}))
