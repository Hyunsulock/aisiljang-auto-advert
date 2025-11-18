import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Offer } from './Offer.entity.js';

/**
 * 경쟁 광고 분석 테이블
 * 각 매물의 경쟁 광고 분석 결과를 저장
 */
@Entity('competing_ads_analysis')
export class CompetingAdsAnalysis {
  @PrimaryGeneratedColumn()
  id!: number;

  // 관계
  @Column({ name: 'offer_id', type: 'int' })
  offerId!: number;

  @ManyToOne(() => Offer, offer => offer.competingAdsAnalysis, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'offer_id' })
  offer?: Offer;

  // 내 광고 정보
  @Column({ name: 'my_ranking', type: 'int', nullable: true })
  myRanking?: number | null;

  @Column({ name: 'my_floor_exposed', type: 'int', nullable: true })
  myFloorExposed?: number | null;

  @Column({ name: 'total_count', type: 'int', nullable: true })
  totalCount?: number | null;

  // 경쟁 우위 플래그
  @Column({ name: 'has_floor_exposure_advantage', type: 'int', nullable: true })
  hasFloorExposureAdvantage?: number | null;

  // 경쟁 광고 데이터 (JSON)
  @Column({ name: 'competing_ads_data', type: 'text', nullable: true })
  competingAdsData?: string | null;

  // 메타 정보
  @CreateDateColumn({ name: 'created_at', type: 'int' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'int' })
  updatedAt!: Date;
}
