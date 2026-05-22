import { Injectable } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { Repository } from "typeorm"
import { OutboxEvent, OutboxService } from "../outbox"
import { DeadLetter } from "./dead-letter.entity"

@Injectable()
export class DlqService {
    constructor(
        @InjectRepository(DeadLetter)
        private readonly repo: Repository<DeadLetter>,
        private readonly outbox: OutboxService,
    ) {}

    async park(event: OutboxEvent, lastError: string): Promise<DeadLetter> {
        return this.repo.save(this.repo.create({
            eventId: event.id,
            type: event.type,
            targetUrl: event.targetUrl,
            payload: event.payload,
            attempts: event.attempts,
            lastError,
        }))
    }

    list(limit = 50): Promise<DeadLetter[]> {
        return this.repo.find({ order: { parkedAt: "DESC" }, take: limit })
    }

    findById(id: string): Promise<DeadLetter | null> {
        return this.repo.findOne({ where: { id } })
    }

    /** Mark replayed + reset outbox row so the poller picks it up again. */
    async replay(id: string): Promise<{ replayedDlq: string; eventId: string } | null> {
        const row = await this.repo.findOne({ where: { id } })
        if (!row) return null
        await this.outbox.requeue(row.eventId)
        await this.repo.update({ id }, { replayedAt: new Date() })
        return { replayedDlq: id, eventId: row.eventId }
    }
}
