import { Module } from "@nestjs/common"
import { OutboxModule } from "../outbox"
import { EventsController } from "./events.controller"

@Module({
    imports: [OutboxModule],
    controllers: [EventsController],
})
export class EventsModule {}
