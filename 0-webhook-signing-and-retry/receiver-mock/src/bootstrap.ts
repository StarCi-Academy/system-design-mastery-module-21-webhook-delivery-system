import { NestFactory } from "@nestjs/core"
import { ConfigService } from "@nestjs/config"
import { AppModule } from "./app.module"

export async function bootstrap(): Promise<void> {
    const app = await NestFactory.create(AppModule, { rawBody: true })
    const port = app.get(ConfigService).get<number>("app.port") ?? 3000
    await app.listen(port, "0.0.0.0")
}
