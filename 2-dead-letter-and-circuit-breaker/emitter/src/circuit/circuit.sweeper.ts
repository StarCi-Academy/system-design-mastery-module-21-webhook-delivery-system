import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common"
import { OutboxService } from "../outbox/outbox.service"
import { CircuitService } from "./circuit.service"

@Injectable()
export class CircuitSweeper implements OnModuleInit, OnModuleDestroy {
    private readonly log = new Logger(CircuitSweeper.name)
    private timer: NodeJS.Timeout | null = null

    constructor(
        private readonly circuit: CircuitService,
        private readonly outbox: OutboxService,
    ) {}

    onModuleInit(): void {
        // Sweep every 2s: any host whose `open` TTL just expired flips to half_open
        // so the very next job becomes a probe.
        this.timer = setInterval(() => void this.tick(), 2000)
    }

    onModuleDestroy(): void {
        if (this.timer) clearInterval(this.timer)
    }

    private async tick(): Promise<void> {
        try {
            const hosts = await this.outbox.listHosts()
            if (hosts.length === 0) return
            await this.circuit.sweepExpiredOpens(hosts)
        } catch (err) {
            this.log.warn(`sweeper tick failed: ${(err as Error).message}`)
        }
    }
}
