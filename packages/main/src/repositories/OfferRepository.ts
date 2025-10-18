import { db, offers, type Offer, type NewOffer } from '../db/index.js';
import { eq, sql, inArray } from 'drizzle-orm';
import type { OfferWithRank } from '../types/index.js';

/**
 * 매물 데이터베이스 작업을 위한 Repository
 */
export class OfferRepository {
  /**
   * 매물 저장 또는 업데이트 (upsert)
   * numberN (네이버 매물번호)를 기준으로 중복 확인
   */
  async upsert(offerData: OfferWithRank): Promise<Offer> {
    const now = new Date();

    // 기존 매물 확인
    const existing = await db.query.offers.findFirst({
      where: eq(offers.numberN, offerData.numberN),
    });

    const data: NewOffer = {
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
      await db
        .update(offers)
        .set({
          ...data,
          updatedAt: now,
        })
        .where(eq(offers.numberN, offerData.numberN));

      // 업데이트된 데이터 반환
      const updated = await db.query.offers.findFirst({
        where: eq(offers.numberN, offerData.numberN),
      });
      return updated!;
    } else {
      // 삽입
      const result = await db.insert(offers).values(data).returning();
      return result[0];
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
  async findByNumberN(numberN: string): Promise<Offer | undefined> {
    return await db.query.offers.findFirst({
      where: eq(offers.numberN, numberN),
    });
  }

  /**
   * 이실장 매물번호로 매물 조회
   */
  async findByNumberA(numberA: string): Promise<Offer | undefined> {
    return await db.query.offers.findFirst({
      where: eq(offers.numberA, numberA),
    });
  }

  /**
   * 모든 매물 조회
   */
  async findAll(): Promise<Offer[]> {
    return await db.query.offers.findMany({
      orderBy: (offers, { desc }) => [desc(offers.createdAt)],
    });
  }

  /**
   * 광고중인 매물만 조회
   */
  async findAdvertising(): Promise<Offer[]> {
    return await db.query.offers.findMany({
      where: sql`${offers.adStatus} LIKE '%광고%'`,
      orderBy: (offers, { desc }) => [desc(offers.createdAt)],
    });
  }

  /**
   * 전체 매물 개수
   */
  async count(): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(offers);
    return result[0]?.count ?? 0;
  }

  /**
   * 모든 매물 삭제 (테스트용)
   */
  async deleteAll(): Promise<void> {
    await db.delete(offers);
    console.log('🗑️  모든 매물 데이터 삭제 완료');
  }

  /**
   * 여러 ID로 매물 조회
   */
  async findByIds(ids: number[]): Promise<Offer[]> {
    if (ids.length === 0) return [];

    return await db.query.offers.findMany({
      where: inArray(offers.id, ids),
    });
  }
}
