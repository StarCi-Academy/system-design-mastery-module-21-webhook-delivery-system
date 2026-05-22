import { Body, Controller, Get, NotFoundException, Param, Post } from "@nestjs/common"
import { OutboxService } from "../outbox"
import { PublishEventDto } from "./publish.dto"

@Controller("api/events")
export class EventsController {
    constructor(private readonly outbox: OutboxService) {}

    @Post("publish")
    async publish(@Body() body: PublishEventDto) {
        const row = await this.outbox.enqueue(body.type, body.payload, body.targetUrl)
        return {
            eventId: row.id,
            status: row.status,
            createdAt: row.createdAt,
            note: "Persisted to outbox. Background poller will enqueue it onto BullMQ within ~500ms.",
        }
    }

    @Get()
    list() {
        return this.outbox.findRecent(50)
    }

    @Get(":id")
    async get(@Param("id") id: string) {
        const row = await this.outbox.findById(id)
        if (!row) throw new NotFoundException(`event ${id} not found`)
        return row
    }
}
