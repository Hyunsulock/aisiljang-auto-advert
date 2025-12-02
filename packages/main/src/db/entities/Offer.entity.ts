import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { BatchItem } from './BatchItem.entity.js';
import { CompetingAdsAnalysis } from './CompetingAdsAnalysis.entity.js';

/**
 * 매물 마스터 테이블
 * 이실장에서 크롤링한 매물 정보를 저장
 */
@Entity('offers')
export class Offer {
  @PrimaryGeneratedColumn()
  id!: number;

  // 매물 식별자
  @Column({ name: 'number_n', type: 'text', unique: true })
  numberN!: string; // 네이버 매물번호 (고유키)

  @Column({ name: 'number_a', type: 'text' })
  numberA!: string; // 이실장 매물번호

  // 매물 기본 정보
  @Column({ type: 'text' })
  type!: string; // 매물 종류 (아파트, 오피스텔 등)

  @Column({ type: 'text' })
  name!: string; // 매물 이름

  @Column({ type: 'text', nullable: true })
  dong?: string | null; // 동 정보

  @Column({ type: 'text', nullable: true })
  ho?: string | null; // 호수

  @Column({ type: 'text' })
  address!: string; // 전체 주소

  // 면적 정보
  @Column({ name: 'area_public', type: 'text', nullable: true })
  areaPublic?: string | null; // 공급면적 (㎡)

  @Column({ name: 'area_private', type: 'text', nullable: true })
  areaPrivate?: string | null; // 전용면적 (㎡)

  @Column({ name: 'area_pyeong', type: 'text', nullable: true })
  areaPyeong?: string | null; // 전용면적 (평)

  // 거래 정보
  @Column({ name: 'deal_type', type: 'text' })
  dealType!: string; // 매매/전세/월세

  @Column({ type: 'text' })
  price!: string; // 매매가 or 전세가 or 보증금

  @Column({ type: 'text', nullable: true })
  rent?: string | null; // 월세

  // 광고 정보
  @Column({ name: 'ad_channel', type: 'text', nullable: true })
  adChannel?: string | null; // 노출 채널

  @Column({ name: 'ad_method', type: 'text', nullable: true })
  adMethod?: string | null; // 검증 방식

  @Column({ name: 'ad_status', type: 'text' })
  adStatus!: string; // 광고 상태

  @Column({ name: 'ad_start_date', type: 'text', nullable: true })
  adStartDate?: string | null; // 노출 시작일

  @Column({ name: 'ad_end_date', type: 'text', nullable: true })
  adEndDate?: string | null; // 노출 종료일

  @Column({ name: 'date_range', type: 'text', nullable: true })
  dateRange?: string | null; // 노출 기간 원본

  // 네이버 순위 정보
  @Column({ type: 'int', nullable: true })
  ranking?: number | null;

  @Column({ name: 'shared_rank', type: 'int', nullable: true })
  sharedRank?: number | null;

  @Column({ name: 'is_shared', type: 'boolean', nullable: true })
  isShared?: boolean | null;

  @Column({ name: 'shared_count', type: 'int', nullable: true })
  sharedCount?: number | null;

  @Column({ type: 'int', nullable: true })
  total?: number | null;

  // 메타 정보
  @CreateDateColumn({ name: 'created_at', type: 'int' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'int' })
  updatedAt!: Date;

  // 관계
  @OneToMany(() => BatchItem, batchItem => batchItem.offer)
  batchItems?: BatchItem[];

  @OneToMany(() => CompetingAdsAnalysis, analysis => analysis.offer)
  competingAdsAnalysis?: CompetingAdsAnalysis[];
}
