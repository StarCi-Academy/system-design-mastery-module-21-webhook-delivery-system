import { Module } from "@nestjs/common"
import { OutboxModule } from "../outbox"
import { CircuitController } from "./circuit.controller"
import { CircuitService } from "./circuit.service"
import { CircuitSweeper } from "./circuit.sweeper"

@Module({
    imports: [OutboxModule],
    controllers: [CircuitController],
    providers: [CircuitService, CircuitSweeper],
    exports: [CircuitService],
})
export class CircuitModule {}
