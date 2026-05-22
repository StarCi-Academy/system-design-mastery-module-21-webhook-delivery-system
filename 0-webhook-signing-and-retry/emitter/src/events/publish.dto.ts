import { IsNotEmpty, IsObject, IsOptional, IsString } from "class-validator"

export class PublishEventDto {
    @IsString()
    @IsNotEmpty()
    type!: string

    @IsObject()
    payload!: Record<string, unknown>

    @IsString()
    @IsNotEmpty()
    targetUrl!: string

    /** Optional override for backoff jitter seed (testing only). */
    @IsOptional()
    @IsString()
    seed?: string
}
