import { registerAs } from "@nestjs/config"

export interface AppConfig {
    port: number
    webhookSecret: string
    timestampSkewSeconds: number
}

export const appConfig = registerAs("app", (): AppConfig => ({
    port: Number(process.env.PORT) || 3000,
    webhookSecret: process.env.WEBHOOK_SECRET ?? "shared-secret-demo",
    timestampSkewSeconds: Number(process.env.TIMESTAMP_SKEW_SECONDS) || 300,
}))
