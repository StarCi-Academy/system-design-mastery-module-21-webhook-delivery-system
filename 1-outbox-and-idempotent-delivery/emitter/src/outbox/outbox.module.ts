import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { OutboxEvent } from "./outbox.entity"
import { OutboxPoller } from "./outbox.poller"
import { OutboxService } from "./outbox.service"

@Module({
    imports: [TypeOrmModule.forFeature([OutboxEvent])],
    providers: [OutboxService, OutboxPoller],
    exports: [OutboxService],
})
export class OutboxModule {}
