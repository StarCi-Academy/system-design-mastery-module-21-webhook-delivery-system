import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { OutboxModule } from "../outbox"
import { DeadLetter } from "./dead-letter.entity"
import { DlqController } from "./dlq.controller"
import { DlqService } from "./dlq.service"

@Module({
    imports: [TypeOrmModule.forFeature([DeadLetter]), OutboxModule],
    controllers: [DlqController],
    providers: [DlqService],
    exports: [DlqService],
})
export class DlqModule {}
