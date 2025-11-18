import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { BatchItem } from './BatchItem.entity.js';

/**
 * 배치 작업 테이블
 * 여러 매물을 묶어서 처리하는 배치 작업 그룹
 */
@Entity('batches')
export class Batch {
  @PrimaryGeneratedColumn()
  id!: number;

  // 배치 정보
  @Column({ type: 'text' })
  name!: string; // 배치 이름

  // 배치 상태
  @Column({ type: 'text', default: 'pending' })
  status!: string;

  // 진행 상황
  @Column({ name: 'total_count', type: 'int', default: 0 })
  totalCount!: number;

  @Column({ name: 'completed_count', type: 'int', default: 0 })
  completedCount!: number;

  @Column({ name: 'failed_count', type: 'int', default: 0 })
  failedCount!: number;

  // 스케줄 정보
  @Column({ name: 'scheduled_at', type: 'int', nullable: true })
  scheduledAt?: Date | null;

  // 메타 정보
  @CreateDateColumn({ name: 'created_at', type: 'int' })
  createdAt!: Date;

  @Column({ name: 'started_at', type: 'int', nullable: true })
  startedAt?: Date | null;

  @Column({ name: 'completed_at', type: 'int', nullable: true })
  completedAt?: Date | null;

  // 관계
  @OneToMany(() => BatchItem, batchItem => batchItem.batch)
  items?: BatchItem[];
}
