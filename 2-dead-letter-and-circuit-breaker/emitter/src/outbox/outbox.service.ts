import { Injectable } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { Repository } from "typeorm"
import { OutboxEvent } from "./outbox.entity"

@Injectable()
export class OutboxService {
    constructor(
        @InjectRepository(OutboxEvent)
        private readonly repo: Repository<OutboxEvent>,
    ) {}

    async enqueue(type: string, payload: Record<string, unknown>, targetUrl: string): Promise<OutboxEvent> {
        return this.repo.save(this.repo.create({ type, payload, targetUrl, status: "pending" }))
    }

    findById(id: string): Promise<OutboxEvent | null> {
        return this.repo.findOne({ where: { id } })
    }

    findRecent(limit = 50): Promise<OutboxEvent[]> {
        return this.repo.find({ order: { createdAt: "DESC" }, take: limit })
    }

    async listHosts(): Promise<string[]> {
        const rows = await this.repo
            .createQueryBuilder("e")
            .select("DISTINCT e.targetUrl", "targetUrl")
            .where("e.status != :s", { s: "sent" })
            .getRawMany<{ targetUrl: string }>()
        const hosts = new Set<string>()
        for (const r of rows) {
            try { hosts.add(new URL(r.targetUrl).host) } catch { /* skip */ }
        }
        return Array.from(hosts)
    }

    async claimPending(batch: number): Promise<OutboxEvent[]> {
        return this.repo.manager.transaction(async (manager) => {
            const rows = await manager
                .createQueryBuilder(OutboxEvent, "e")
                .setLock("pessimistic_write")
                .setOnLocked("skip_locked")
                .where("e.status = :s", { s: "pending" })
                .orderBy("e.createdAt", "ASC")
                .limit(batch)
                .getMany()
            if (rows.length === 0) return []
            await manager.update(
                OutboxEvent,
                rows.map((r) => r.id),
                { status: "in_flight" },
            )
            rows.forEach((r) => (r.status = "in_flight"))
            return rows
        })
    }

    async markSent(id: string): Promise<void> {
        await this.repo.update({ id }, { status: "sent", lastAttemptAt: new Date(), lastError: null })
    }

    async markFailed(id: string, error: string): Promise<void> {
        await this.repo.update({ id }, { status: "failed", lastAttemptAt: new Date(), lastError: error })
    }

    async incrementAttempt(id: string, error: string | null): Promise<void> {
        await this.repo.increment({ id }, "attempts", 1)
        await this.repo.update({ id }, { lastAttemptAt: new Date(), lastError: error })
    }

    /** Reset to pending so the poller will re-enqueue (used by DLQ replay). */
    async requeue(id: string): Promise<void> {
        await this.repo.update({ id }, { status: "pending", attempts: 0, lastError: null })
    }
}
