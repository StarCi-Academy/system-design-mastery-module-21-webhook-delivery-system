import { Controller, Get, NotFoundException, Param, Post } from "@nestjs/common"
import { DlqService } from "./dlq.service"

@Controller("api/dlq")
export class DlqController {
    constructor(private readonly dlq: DlqService) {}

    @Get()
    list() {
        return this.dlq.list(50)
    }

    @Get(":id")
    async get(@Param("id") id: string) {
        const row = await this.dlq.findById(id)
        if (!row) throw new NotFoundException(`dlq ${id} not found`)
        return row
    }

    @Post(":id/replay")
    async replay(@Param("id") id: string) {
        const res = await this.dlq.replay(id)
        if (!res) throw new NotFoundException(`dlq ${id} not found`)
        return { ...res, status: "requeued", note: "Outbox row reset to pending; poller will re-enqueue within ~500ms." }
    }
}
