import { Body, Controller, Get, NotFoundException, Param, Post } from "@nestjs/common"
import { PublishEventDto } from "./publish.dto"
import { EventsService } from "./events.service"

@Controller("api/events")
export class EventsController {
    constructor(private readonly service: EventsService) {}

    @Post("publish")
    publish(@Body() body: PublishEventDto) {
        return this.service.publish(body.type, body.payload, body.targetUrl)
    }

    @Get(":id")
    get(@Param("id") id: string) {
        const r = this.service.get(id)
        if (!r) throw new NotFoundException(`event ${id} not found`)
        return r
    }
}
