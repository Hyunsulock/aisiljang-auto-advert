import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Batch } from './Batch.entity.js';
import { Offer } from './Offer.entity.js';

/**
 * 배치 아이템 테이블
 * 배치 작업 내 개별 매물의 작업 상태를 추적
 */
@Entity('batch_items')
export class BatchItem {
  @PrimaryGeneratedColumn()
  id!: number;

  // 관계
  @Column({ name: 'batch_id', type: 'int' })
  batchId!: number;

  @Column({ name: 'offer_id', type: 'int' })
  offerId!: number;

  @ManyToOne(() => Batch, batch => batch.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'batch_id' })
  batch?: Batch;

  @ManyToOne(() => Offer, offer => offer.batchItems, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'offer_id' })
  offer?: Offer;

  // 작업 상태
  @Column({ type: 'text', default: 'pending' })
  status!: string;

  // 단계별 상태
  @Column({ name: 'modify_status', type: 'text', nullable: true, default: 'pending' })
  modifyStatus?: string | null;

  @Column({ name: 're_advertise_status', type: 'text', nullable: true, default: 'pending' })
  reAdvertiseStatus?: string | null;

  // 수정할 정보
  @Column({ name: 'modified_price', type: 'text', nullable: true })
  modifiedPrice?: string | null;

  @Column({ name: 'modified_rent', type: 'text', nullable: true })
  modifiedRent?: string | null;

  @Column({ name: 'modified_floor_exposure', type: 'boolean', nullable: true })
  modifiedFloorExposure?: boolean | null;

  // 오류 정보
  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string | null;

  @Column({ name: 'retry_count', type: 'int', default: 0 })
  retryCount!: number;

  // 메타 정보
  @CreateDateColumn({ name: 'created_at', type: 'int' })
  createdAt!: Date;

  @Column({ name: 'modify_started_at', type: 'int', nullable: true })
  modifyStartedAt?: Date | null;

  @Column({ name: 'modify_completed_at', type: 'int', nullable: true })
  modifyCompletedAt?: Date | null;

  @Column({ name: 're_advertise_started_at', type: 'int', nullable: true })
  reAdvertiseStartedAt?: Date | null;

  @Column({ name: 're_advertise_completed_at', type: 'int', nullable: true })
  reAdvertiseCompletedAt?: Date | null;
}
