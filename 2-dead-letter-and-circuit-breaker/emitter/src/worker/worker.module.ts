import { Module } from "@nestjs/common"
import { CircuitModule } from "../circuit/circuit.module"
import { DlqModule } from "../dlq"
import { OutboxModule } from "../outbox"
import { WebhookWorker } from "./webhook.worker"

@Module({
    imports: [OutboxModule, CircuitModule, DlqModule],
    providers: [WebhookWorker],
})
export class WorkerModule {}
