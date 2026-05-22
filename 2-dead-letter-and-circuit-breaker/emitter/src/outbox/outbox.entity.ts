import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm"

export type OutboxStatus = "pending" | "in_flight" | "sent" | "failed"

@Entity({ name: "outbox_event" })
export class OutboxEvent {
    @PrimaryGeneratedColumn("uuid")
    id!: string

    @Column({ type: "varchar", length: 64 })
    type!: string

    @Column({ type: "varchar", length: 512 })
    targetUrl!: string

    @Column({ type: "jsonb" })
    payload!: Record<string, unknown>

    @Index()
    @Column({ type: "varchar", length: 16, default: "pending" })
    status!: OutboxStatus

    @Column({ type: "int", default: 0 })
    attempts!: number

    @Column({ type: "text", nullable: true })
    lastError!: string | null

    @CreateDateColumn({ name: "created_at" })
    createdAt!: Date

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt!: Date

    @Column({ name: "last_attempt_at", type: "timestamptz", nullable: true })
    lastAttemptAt!: Date | null
}
