import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { json } from "express"
import { appConfig } from "./config"
import { HookModule } from "./hook"

@Module({
    imports: [ConfigModule.forRoot({ isGlobal: true, load: [appConfig] }), HookModule],
})
export class AppModule {}
export { json }
