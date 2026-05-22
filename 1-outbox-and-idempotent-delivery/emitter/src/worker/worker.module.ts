import { Module } from "@nestjs/common"
import { OutboxModule } from "../outbox"
import { WebhookWorker } from "./webhook.worker"

@Module({
    imports: [OutboxModule],
    providers: [WebhookWorker],
})
export class WorkerModule {}
