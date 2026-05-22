import {
    BadRequestException,
    Controller,
    HttpCode,
    HttpException,
    HttpStatus,
    Post,
    Query,
    Req,
    UnauthorizedException,
} from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { createHmac, timingSafeEqual } from "crypto"
import type { RawBodyRequest } from "@nestjs/common"
import type { Request } from "express"

@Controller("api/hook")
export class HookController {
    constructor(private readonly config: ConfigService) {}

    @Post()
    @HttpCode(HttpStatus.OK)
    receive(
        @Req() req: RawBodyRequest<Request>,
        @Query("fail") fail?: string,
    ) {
        const raw = req.rawBody?.toString("utf8")
        if (!raw) throw new BadRequestException("missing raw body")

        const tsHeader = req.headers["x-webhook-timestamp"] as string | undefined
        const sigHeader = req.headers["x-webhook-signature"] as string | undefined
        const idHeader = req.headers["x-webhook-id"] as string | undefined
        if (!tsHeader || !sigHeader || !idHeader) {
            throw new UnauthorizedException("missing signature headers")
        }

        const ts = Number(tsHeader)
        const skewSec = this.config.get<number>("app.timestampSkewSeconds") ?? 300
        const ageSec = Math.abs(Math.floor(Date.now() / 1000) - ts)
        if (ageSec > skewSec) {
            throw new UnauthorizedException(`timestamp outside ±${skewSec}s window (age=${ageSec}s)`)
        }

        const match = /^t=(\d+),v1=([0-9a-f]+)$/.exec(sigHeader)
        if (!match || Number(match[1]) !== ts) {
            throw new UnauthorizedException("malformed signature header")
        }
        const provided = Buffer.from(match[2], "hex")
        const secret = this.config.get<string>("app.webhookSecret") ?? "shared-secret-demo"
        const expected = createHmac("sha256", secret)
            .update(`${ts}.${raw}`)
            .digest()
        if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
            throw new UnauthorizedException("signature mismatch")
        }

        if (fail) {
            const code = Number(fail)
            throw new HttpException(`forced fail ${code}`, code)
        }

        return {
            received: true,
            eventId: idHeader,
            ts,
            bodyEcho: JSON.parse(raw),
        }
    }
}
