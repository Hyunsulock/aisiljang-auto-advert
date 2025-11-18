import { Repository } from 'typeorm';
import { AppDataSource } from '../db/data-source.js';
import { CompetingAdsAnalysis } from '../db/entities/CompetingAdsAnalysis.entity.js';
import type { RankingAnalysis } from '../types/index.js';

/**
 * 경쟁 광고 분석 데이터베이스 작업을 위한 Repository
 */
export class CompetingAdsRepository {
  private repository: Repository<CompetingAdsAnalysis>;

  constructor() {
    this.repository = AppDataSource.getRepository(CompetingAdsAnalysis);
  }

  /**
   * 경쟁 광고 분석 저장 또는 업데이트 (upsert)
   * offerId를 기준으로 중복 확인
   */
  async upsert(offerId: number, analysisData: RankingAnalysis): Promise<CompetingAdsAnalysis> {
    const now = new Date();

    // 기존 분석 데이터 확인
    const existing = await this.repository.findOne({
      where: { offerId },
    });

    const data = {
      offerId,
      myRanking: analysisData.myRanking,
      myFloorExposed: analysisData.myFloorExposed,
      totalCount: analysisData.totalCount,
      hasFloorExposureAdvantage: analysisData.hasFloorExposureAdvantage,
      competingAdsData: JSON.stringify(analysisData.competingAds),
    };

    if (existing) {
      // 업데이트
      await this.repository.update(
        { offerId },
        { ...data, updatedAt: now }
      );

      // 업데이트된 데이터 반환
      const updated = await this.repository.findOne({
        where: { offerId },
      });
      return updated!;
    } else {
      // 삽입
      const analysis = this.repository.create(data);
      return await this.repository.save(analysis);
    }
  }

  /**
   * offerId로 분석 데이터 조회
   */
  async findByOfferId(offerId: number): Promise<RankingAnalysis | null> {
    const result = await this.repository.findOne({
      where: { offerId },
    });

    if (!result) return null;

    return {
      myArticle: null, // 필요시 offers 테이블에서 조회
      myRanking: result.myRanking,
      myFloorExposed: result.myFloorExposed || false,
      totalCount: result.totalCount ?? 0,
      competingAds: JSON.parse(result.competingAdsData || '[]'),
      hasFloorExposureAdvantage: result.hasFloorExposureAdvantage || false,
    };
  }

  /**
   * 모든 분석 데이터 삭제 (테스트용)
   */
  async deleteAll(): Promise<void> {
    await this.repository.clear();
    console.log('🗑️  모든 경쟁 광고 분석 데이터 삭제 완료');
  }

  /**
   * offerId로 분석 데이터 삭제
   */
  async deleteByOfferId(offerId: number): Promise<void> {
    await this.repository.delete({ offerId });
  }
}
