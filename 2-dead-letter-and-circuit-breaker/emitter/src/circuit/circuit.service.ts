import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import IORedis from "ioredis"

export type CircuitState = "closed" | "open" | "half_open"

export interface CircuitStatus {
    host: string
    state: CircuitState
    failCount: number
    failThreshold: number
    openTtlSec: number
}

@Injectable()
export class CircuitService implements OnModuleInit, OnModuleDestroy {
    private readonly log = new Logger(CircuitService.name)
    private redis!: IORedis

    constructor(private readonly config: ConfigService) {}

    onModuleInit(): void {
        this.redis = new IORedis(this.config.get<string>("app.redisUrl") ?? "redis://localhost:6379")
    }

    async onModuleDestroy(): Promise<void> {
        await this.redis?.quit()
    }

    static hostOf(url: string): string {
        try {
            return new URL(url).host
        } catch {
            return url
        }
    }

    private failKey(host: string): string { return `circuit:fail:${host}` }
    private stateKey(host: string): string { return `circuit:state:${host}` }
    private probeKey(host: string): string { return `circuit:probe:${host}` }

    async getState(host: string): Promise<CircuitState> {
        const v = await this.redis.get(this.stateKey(host))
        return (v as CircuitState) ?? "closed"
    }

    /** Returns true if the worker should attempt the call (closed or probing). */
    async allowRequest(host: string): Promise<{ allow: boolean; state: CircuitState; isProbe: boolean }> {
        const state = await this.getState(host)
        if (state === "closed") return { allow: true, state, isProbe: false }
        if (state === "half_open") {
            // Only one concurrent probe; SET NX guarantees a single probe wins.
            const ok = await this.redis.set(this.probeKey(host), "1", "EX", 5, "NX")
            return { allow: ok === "OK", state, isProbe: ok === "OK" }
        }
        return { allow: false, state, isProbe: false }
    }

    async recordSuccess(host: string, isProbe: boolean): Promise<void> {
        if (isProbe) {
            await Promise.all([
                this.redis.set(this.stateKey(host), "closed"),
                this.redis.del(this.failKey(host)),
                this.redis.del(this.probeKey(host)),
            ])
            this.log.log(`circuit ${host} → CLOSED after successful probe`)
        }
    }

    async recordFailure(host: string, isProbe: boolean): Promise<void> {
        if (isProbe) {
            const openTtl = this.config.get<number>("app.circuitOpenTtlSec") ?? 30
            await Promise.all([
                this.redis.set(this.stateKey(host), "open", "EX", openTtl),
                this.redis.del(this.probeKey(host)),
            ])
            this.log.warn(`circuit ${host} → OPEN (probe failed)`)
            return
        }
        const win = this.config.get<number>("app.circuitFailWindowSec") ?? 60
        const threshold = this.config.get<number>("app.circuitFailThreshold") ?? 5
        const key = this.failKey(host)
        const count = await this.redis.incr(key)
        if (count === 1) await this.redis.expire(key, win)
        if (count >= threshold) {
            const openTtl = this.config.get<number>("app.circuitOpenTtlSec") ?? 30
            await this.redis.set(this.stateKey(host), "open", "EX", openTtl)
            this.log.warn(`circuit ${host} → OPEN (fails=${count} ≥ ${threshold} in ${win}s)`)
        }
    }

    /** Called by a scheduler: any host whose 'open' TTL just expired flips to half_open. */
    async sweepExpiredOpens(hosts: string[]): Promise<void> {
        for (const host of hosts) {
            const v = await this.redis.get(this.stateKey(host))
            if (v === null) {
                // expired; allow next request to probe
                await this.redis.set(this.stateKey(host), "half_open")
                this.log.log(`circuit ${host} → HALF_OPEN`)
            }
        }
    }

    async status(host: string): Promise<CircuitStatus> {
        const [state, failCount] = await Promise.all([
            this.getState(host),
            this.redis.get(this.failKey(host)),
        ])
        return {
            host,
            state,
            failCount: Number(failCount ?? 0),
            failThreshold: this.config.get<number>("app.circuitFailThreshold") ?? 5,
            openTtlSec: this.config.get<number>("app.circuitOpenTtlSec") ?? 30,
        }
    }
}
