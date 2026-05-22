import { Module } from "@nestjs/common"
import { HookController } from "./hook.controller"

@Module({
    controllers: [HookController],
})
export class HookModule {}
