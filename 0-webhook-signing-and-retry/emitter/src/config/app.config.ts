import { registerAs } from "@nestjs/config"

export interface AppConfig {
    port: number
    webhookSecret: string
    maxAttempts: number
    backoffMs: number[]
}

export const appConfig = registerAs("app", (): AppConfig => ({
    port: Number(process.env.PORT) || 3000,
    webhookSecret: process.env.WEBHOOK_SECRET ?? "shared-secret-demo",
    maxAttempts: Number(process.env.MAX_ATTEMPTS) || 3,
    backoffMs: (process.env.BACKOFF_MS ?? "1000,5000,25000")
        .split(",").map((s) => Number(s.trim())),
}))
