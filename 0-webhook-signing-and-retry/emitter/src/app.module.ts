import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { appConfig } from "./config"
import { EventsModule } from "./events"

@Module({
    imports: [ConfigModule.forRoot({ isGlobal: true, load: [appConfig] }), EventsModule],
})
export class AppModule {}
