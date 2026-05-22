import {
    BadRequestException,
    Controller,
    HttpCode,
    HttpException,
    HttpStatus,
    Logger,
    OnModuleDestroy,
    OnModuleInit,
    Post,
    Query,
    Req,
    UnauthorizedException,
} from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { createHmac, timingSafeEqual } from "crypto"
import IORedis from "ioredis"
import type { RawBodyRequest } from "@nestjs/common"
import type { Request } from "express"

@Controller("api/hook")
export class HookController implements OnModuleInit, OnModuleDestroy {
    private readonly log = new Logger(HookController.name)
    private redis!: IORedis
    /** In-memory side-effect counter — proves idempotency by counting actual handler executions. */
    private readonly sideEffectCount = new Map<string, number>()

    constructor(private readonly config: ConfigService) {}

    onModuleInit(): void {
        this.redis = new IORedis(this.config.get<string>("app.redisUrl") ?? "redis://localhost:6379")
    }

    async onModuleDestroy(): Promise<void> {
        await this.redis?.quit()
    }

    @Post()
    @HttpCode(HttpStatus.OK)
    async receive(
        @Req() req: RawBodyRequest<Request>,
        @Query("fail") fail?: string,
    ) {
        const raw = req.rawBody?.toString("utf8")
        if (!raw) throw new BadRequestException("missing raw body")

        const tsHeader = req.headers["x-webhook-timestamp"] as string | undefined
        const sigHeader = req.headers["x-webhook-signature"] as string | undefined
        const idHeader = req.headers["x-webhook-id"] as string | undefined
        const idemHeader = (req.headers["idempotency-key"] as string | undefined) ?? idHeader
        if (!tsHeader || !sigHeader || !idHeader) {
            throw new UnauthorizedException("missing signature headers")
        }
        if (!idemHeader) throw new BadRequestException("missing Idempotency-Key")

        const ts = Number(tsHeader)
        const skewSec = this.config.get<number>("app.timestampSkewSeconds") ?? 300
        if (Math.abs(Math.floor(Date.now() / 1000) - ts) > skewSec) {
            throw new UnauthorizedException("timestamp outside skew window")
        }

        const match = /^t=(\d+),v1=([0-9a-f]+)$/.exec(sigHeader)
        if (!match || Number(match[1]) !== ts) {
            throw new UnauthorizedException("malformed signature header")
        }
        const provided = Buffer.from(match[2], "hex")
        const secret = this.config.get<string>("app.webhookSecret") ?? "shared-secret-demo"
        const expected = createHmac("sha256", secret).update(`${ts}.${raw}`).digest()
        if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
            throw new UnauthorizedException("signature mismatch")
        }

        const ttl = this.config.get<number>("app.idempotencyTtlSeconds") ?? 86400
        const cacheKey = `hook:idem:${idemHeader}`
        const cached = await this.redis.get(cacheKey)
        if (cached) {
            this.log.log(`replay ${idemHeader} → returning cached result`)
            return JSON.parse(cached)
        }

        const failBeforeN = this.config.get<number>("app.failFirstNAttempts") ?? 0
        if (failBeforeN > 0) {
            const count = (this.sideEffectCount.get(idemHeader) ?? 0) + 1
            this.sideEffectCount.set(idemHeader, count)
            if (count <= failBeforeN) {
                throw new HttpException(`forced fail attempt ${count} (cap=${failBeforeN})`, 503)
            }
        } else if (fail) {
            throw new HttpException(`forced fail ${fail}`, Number(fail))
        }

        const result = {
            received: true,
            eventId: idHeader,
            idempotencyKey: idemHeader,
            ts,
            sideEffectExecutedAt: new Date().toISOString(),
            bodyEcho: JSON.parse(raw),
        }
        await this.redis.set(cacheKey, JSON.stringify(result), "EX", ttl, "NX")
        return result
    }
}
