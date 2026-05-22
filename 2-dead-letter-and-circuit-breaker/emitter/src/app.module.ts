import { Module } from "@nestjs/common"
import { ConfigModule, ConfigService } from "@nestjs/config"
import { TypeOrmModule } from "@nestjs/typeorm"
import { appConfig } from "./config"
import { EventsModule } from "./events"
import { CircuitModule } from "./circuit"
import { DlqModule } from "./dlq"
import { OutboxModule } from "./outbox"
import { WorkerModule } from "./worker"

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [appConfig] }),
        TypeOrmModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                type: "postgres",
                url: config.get<string>("app.postgresUrl"),
                autoLoadEntities: true,
                synchronize: true,
            }),
        }),
        OutboxModule,
        EventsModule,
        CircuitModule,
        DlqModule,
        WorkerModule,
    ],
})
export class AppModule {}
