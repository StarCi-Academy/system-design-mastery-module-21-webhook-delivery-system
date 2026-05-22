import { IsNotEmpty, IsObject, IsString } from "class-validator"

export class PublishEventDto {
    @IsString()
    @IsNotEmpty()
    type!: string

    @IsObject()
    payload!: Record<string, unknown>

    @IsString()
    @IsNotEmpty()
    targetUrl!: string
}
