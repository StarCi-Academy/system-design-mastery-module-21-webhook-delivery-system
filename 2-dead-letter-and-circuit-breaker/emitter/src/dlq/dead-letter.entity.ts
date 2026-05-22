import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm"

@Entity({ name: "dead_letter" })
export class DeadLetter {
    @PrimaryGeneratedColumn("uuid")
    id!: string

    @Index()
    @Column({ name: "event_id", type: "uuid" })
    eventId!: string

    @Column({ type: "varchar", length: 64 })
    type!: string

    @Column({ type: "varchar", length: 512 })
    targetUrl!: string

    @Column({ type: "jsonb" })
    payload!: Record<string, unknown>

    @Column({ type: "int" })
    attempts!: number

    @Column({ type: "text" })
    lastError!: string

    @CreateDateColumn({ name: "parked_at" })
    parkedAt!: Date

    @Column({ name: "replayed_at", type: "timestamptz", nullable: true })
    replayedAt!: Date | null
}
