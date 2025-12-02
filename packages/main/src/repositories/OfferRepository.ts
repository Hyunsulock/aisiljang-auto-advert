import { Repository, Like } from 'typeorm';
import { AppDataSource } from '../db/data-source.js';
import { Offer } from '../db/entities/Offer.entity.js';
import { CompetingAdsAnalysis } from '../db/entities/CompetingAdsAnalysis.entity.js';
import type { OfferWithRank, RankingAnalysis } from '../types/index.js';

export interface OfferWithAnalysis extends Offer {
  rankingAnalysis?: RankingAnalysis | null;
}

/**
 * 매물 데이터베이스 작업을 위한 Repository
 */
export class OfferRepository {
  private repository: Repository<Offer>;
  private analysisRepository: Repository<CompetingAdsAnalysis>;

  constructor() {
    this.repository = AppDataSource.getRepository(Offer);
    this.analysisRepository = AppDataSource.getRepository(CompetingAdsAnalysis);
  }

  /**
   * 매물 저장 또는 업데이트 (upsert)
   * numberN (네이버 매물번호)를 기준으로 중복 확인
   */
  async upsert(offerData: OfferWithRank): Promise<Offer> {
    const now = new Date();

    // 기존 매물 확인
    const existing = await this.repository.findOne({
      where: { numberN: offerData.numberN },
    });

    const data = {
      numberN: offerData.numberN,
      numberA: offerData.numberA,
      type: offerData.type,
      name: offerData.name,
      dong: offerData.dong || null,
      ho: offerData.ho || null,
      address: offerData.address,
      areaPublic: offerData.areaPublic,
      areaPrivate: offerData.areaPrivate,
      areaPyeong: offerData.areaPyeong,
      dealType: offerData.dealType,
      price: offerData.price,
      rent: offerData.rent,
      adChannel: offerData.adChannel,
      adMethod: offerData.adMethod,
      adStatus: offerData.adStatus,
      adStartDate: offerData.adStartDate,
      adEndDate: offerData.adEndDate,
      dateRange: offerData.dateRange || null,
      ranking: offerData.ranking,
      sharedRank: offerData.sharedRank,
      isShared: offerData.isShared,
      sharedCount: offerData.sharedCount,
      total: offerData.total,
    };

    if (existing) {
      // 업데이트
      await this.repository.update(
        { numberN: offerData.numberN },
        { ...data, updatedAt: now }
      );

      // 업데이트된 데이터 반환
      const updated = await this.repository.findOne({
        where: { numberN: offerData.numberN },
      });
      return updated!;
    } else {
      // 삽입
      const offer = this.repository.create(data);
      return await this.repository.save(offer);
    }
  }

  /**
   * 여러 매물 일괄 upsert
   */
  async upsertMany(offerDataList: OfferWithRank[]): Promise<void> {
    console.log(`💾 ${offerDataList.length}건의 매물 데이터 저장 중...`);

    for (const offerData of offerDataList) {
      await this.upsert(offerData);
    }

    console.log(`✅ ${offerDataList.length}건의 매물 데이터 저장 완료`);
  }

  /**
   * 네이버 매물번호로 매물 조회
   */
  async findByNumberN(numberN: string): Promise<Offer | null> {
    return await this.repository.findOne({
      where: { numberN },
    });
  }

  /**
   * 이실장 매물번호로 매물 조회
   */
  async findByNumberA(numberA: string): Promise<Offer | null> {
    return await this.repository.findOne({
      where: { numberA },
    });
  }

  /**
   * 모든 매물 조회
   */
  async findAll(): Promise<Offer[]> {
    return await this.repository.find({
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 모든 매물 조회 (경쟁 광고 분석 포함)
   */
  async findAllWithAnalysis(): Promise<OfferWithAnalysis[]> {
    const allOffers = await this.repository.find({
      order: { createdAt: 'DESC' },
    });

    const offersWithAnalysis: OfferWithAnalysis[] = [];

    for (const offer of allOffers) {
      const analysis = await this.analysisRepository.findOne({
        where: { offerId: offer.id },
      });

      offersWithAnalysis.push({
        ...offer,
        rankingAnalysis: analysis
          ? {
              myArticle: null,
              myRanking: analysis.myRanking ?? null,
              myFloorExposed: analysis.myFloorExposed ?? false,
              totalCount: analysis.totalCount ?? 0,
              competingAds: JSON.parse(analysis.competingAdsData || '[]'),
              hasFloorExposureAdvantage: analysis.hasFloorExposureAdvantage ?? false,
            }
          : null,
      });
    }

    return offersWithAnalysis;
  }

  /**
   * 광고중인 매물만 조회
   */
  async findAdvertising(): Promise<Offer[]> {
    return await this.repository.find({
      where: { adStatus: Like('%광고%') },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 전체 매물 개수
   */
  async count(): Promise<number> {
    return await this.repository.count();
  }

  /**
   * 모든 매물 삭제 (테스트용)
   */
  async deleteAll(): Promise<void> {
    await this.repository.clear();
    console.log('🗑️  모든 매물 데이터 삭제 완료');
  }

  /**
   * 여러 ID로 매물 조회
   */
  async findByIds(ids: number[]): Promise<Offer[]> {
    if (ids.length === 0) return [];

    return await this.repository.findByIds(ids);
  }
}
