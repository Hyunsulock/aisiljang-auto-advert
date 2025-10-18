import { BatchRepository } from '../../repositories/BatchRepository.js';
import { OfferRepository } from '../../repositories/OfferRepository.js';
import { chromium } from 'playwright';
import { AdRemoveScraper } from '../crawler/AdRemoveScraper.js';
import { AdUploadScraper } from '../crawler/AdUploadScraper.js';
import { AipartnerAuthService } from '../crawler/AipartnerAuthService.js';

export interface CreateBatchRequest {
  name: string;
  offerIds: number[];
  modifiedPrices?: Record<number, { price?: string; rent?: string }>;
  scheduledAt?: string; // ISO 8601 형식의 날짜/시간 문자열
}

/**
 * 배치 작업 관리 서비스
 */
export class BatchService {
  private batchRepo: BatchRepository;
  private offerRepo: OfferRepository;

  constructor() {
    this.batchRepo = new BatchRepository();
    this.offerRepo = new OfferRepository();
  }

  /**
   * 배치 생성
   */
  async createBatch(request: CreateBatchRequest) {
    console.log(`📦 배치 생성 중: ${request.name}`);
    console.log(`📊 선택된 매물 수: ${request.offerIds.length}건`);

    // 스케줄 시간 처리
    let scheduledAt: Date | undefined;
    let status = 'pending';

    if (request.scheduledAt) {
      scheduledAt = new Date(request.scheduledAt);
      status = 'scheduled';
      console.log(`⏰ 예약 실행 시간: ${scheduledAt.toLocaleString('ko-KR')}`);
    }

    // 1. 배치 생성
    const batch = await this.batchRepo.create({
      name: request.name,
      status,
      totalCount: request.offerIds.length,
      completedCount: 0,
      failedCount: 0,
      scheduledAt,
    });

    console.log(`✅ 배치 생성 완료 (ID: ${batch.id})`);

    // 2. 배치 아이템 생성
    const items = request.offerIds.map(offerId => ({
      batchId: batch.id,
      offerId,
      status: 'pending',
      removeStatus: 'pending',
      uploadStatus: 'pending',
      modifiedPrice: request.modifiedPrices?.[offerId]?.price ?? null,
      modifiedRent: request.modifiedPrices?.[offerId]?.rent ?? null,
      retryCount: 0,
    }));

    await this.batchRepo.createItems(items);
    console.log(`✅ ${items.length}개의 배치 아이템 생성 완료`);

    return batch;
  }

  /**
   * 모든 배치 조회
   */
  async getAllBatches() {
    return await this.batchRepo.findAll();
  }

  /**
   * 배치 상세 조회
   */
  async getBatchDetail(batchId: number) {
    const batch = await this.batchRepo.findById(batchId);
    if (!batch) {
      throw new Error('배치를 찾을 수 없습니다');
    }

    const items = await this.batchRepo.findItemsByBatchId(batchId);

    return {
      batch,
      items,
    };
  }

  /**
   * 배치 삭제
   */
  async deleteBatch(batchId: number) {
    await this.batchRepo.delete(batchId);
    console.log(`🗑️  배치 삭제 완료 (ID: ${batchId})`);
  }

  /**
   * 배치 실행
   */
  async executeBatch(batchId: number) {
    const batch = await this.batchRepo.findById(batchId);
    if (!batch) {
      throw new Error('배치를 찾을 수 없습니다');
    }

    if (batch.status !== 'pending' && batch.status !== 'scheduled') {
      throw new Error('대기 중이거나 예약된 배치만 실행할 수 있습니다');
    }

    console.log(`🚀 배치 실행 시작 (ID: ${batchId}, 이름: ${batch.name})`);

    // 배치 상태를 'removing'으로 변경
    await this.batchRepo.updateStatus(batchId, 'removing');
    await this.batchRepo.markStarted(batchId);

    // 배치 아이템 조회
    const batchItems = await this.batchRepo.findItemsByBatchId(batchId);
    if (batchItems.length === 0) {
      throw new Error('배치 아이템이 없습니다');
    }

    // 매물 정보 조회
    const offerIds = batchItems.map(item => item.offerId);
    const dbOffers = await this.offerRepo.findByIds(offerIds);

    if (dbOffers.length === 0) {
      throw new Error('매물 정보를 찾을 수 없습니다');
    }

    // DB Offer 타입을 AipartnerOffer 타입으로 변환
    const offers = dbOffers.map(offer => ({
      numberN: offer.numberN,
      numberA: offer.numberA,
      type: offer.type,
      name: offer.name,
      dong: offer.dong,
      ho: offer.ho,
      address: offer.address,
      areaPublic: offer.areaPublic,
      areaPrivate: offer.areaPrivate,
      areaPyeong: offer.areaPyeong,
      dealType: offer.dealType,
      price: offer.price,
      rent: offer.rent,
      adChannel: offer.adChannel,
      adMethod: offer.adMethod,
      adStatus: offer.adStatus,
      adStartDate: offer.adStartDate,
      adEndDate: offer.adEndDate,
      dateRange: offer.dateRange || '',
      ranking: offer.ranking,
      sharedRank: offer.sharedRank,
      isShared: offer.isShared,
      sharedCount: offer.sharedCount,
      total: offer.total,
    }));

    console.log(`📊 총 ${offers.length}개 매물의 광고를 내립니다`);

    let browser;
    try {
      // 1. 브라우저 시작
      console.log('🌐 브라우저 시작 중...');
      browser = await chromium.launch({
        headless: false, // 디버깅을 위해 headless: false
        channel: 'chrome', // 시스템에 설치된 Chrome 사용
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
        ],
      });

      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });

      const page = await context.newPage();

      // 2. 이실장 로그인 (자동 로그인 시도)
      console.log('🔐 이실장 로그인 중...');
      const authService = new AipartnerAuthService();
      let session;

      try {
        // 먼저 자동 로그인 시도
        session = await authService.autoLogin(page);
        console.log('✅ 자동 로그인 성공');
      } catch (autoLoginError) {
        console.log('⚠️  자동 로그인 실패, 수동 로그인으로 전환:', autoLoginError);
        // 자동 로그인 실패 시 수동 로그인
        session = await authService.login(page);
      }

      if (!session || !session.cookies || session.cookies.length === 0) {
        throw new Error('이실장 로그인에 실패했습니다');
      }

      console.log('✅ 로그인 성공 - 쿠키:', session.cookies.length, '개');

      // 3. 광고 내리기 실행
      const adRemoveScraper = new AdRemoveScraper();
      let completedCount = 0;
      let failedCount = 0;

      const results = await adRemoveScraper.removeAdsInBatch(
        page,
        offers,
        async (current, total, offer, result) => {
          console.log(`[${current}/${total}] ${offer.name}: ${result.success ? '✅ 성공' : '❌ 실패'}`);

          // 배치 아이템 상태 업데이트
          // numberN으로 매물을 찾아서 ID 매칭
          const matchingOffer = dbOffers.find(o => o.numberN === offer.numberN);
          const batchItem = matchingOffer ? batchItems.find(item => item.offerId === matchingOffer.id) : undefined;

          if (batchItem) {
            if (result.success) {
              completedCount++;
              await this.batchRepo.updateItemRemoveStatus(batchItem.id, 'completed');
            } else {
              failedCount++;
              await this.batchRepo.updateItemRemoveStatus(batchItem.id, 'failed');
              await this.batchRepo.updateItemStatus(batchItem.id, 'failed', result.error);
            }

            // 배치 진행 상황 업데이트
            await this.batchRepo.updateProgress(batchId, completedCount, failedCount);
          }
        }
      );

      const removeSuccessCount = results.filter(r => r.success).length;
      const removeFailCount = results.filter(r => !r.success).length;

      console.log(`\n📊 광고 내리기 결과: 성공 ${removeSuccessCount}건, 실패 ${removeFailCount}건`);

      // 4. 광고 올리기 실행 (광고 내리기에 성공한 매물만)
      console.log('\n🔼 광고 올리기 단계 시작...');
      await this.batchRepo.updateStatus(batchId, 'uploading');

      const successfulOffers = results
        .filter(r => r.success)
        .map(r => r.offer);

      if (successfulOffers.length === 0) {
        console.log('⚠️  광고 내리기에 성공한 매물이 없어 올리기를 건너뜁니다');
      } else {
        const adUploadScraper = new AdUploadScraper();

        // 수정된 가격 정보를 numberN 기준으로 변환
        const modifiedPricesByNumberN: Record<string, { price?: string; rent?: string }> = {};
        for (const item of batchItems) {
          const dbOffer = dbOffers.find(o => o.id === item.offerId);
          if (dbOffer && (item.modifiedPrice || item.modifiedRent)) {
            modifiedPricesByNumberN[dbOffer.numberN] = {
              price: item.modifiedPrice || undefined,
              rent: item.modifiedRent || undefined,
            };
          }
        }

        const uploadResults = await adUploadScraper.uploadAdsInBatch(
          page,
          successfulOffers,
          modifiedPricesByNumberN,
          async (current, total, offer, result) => {
            console.log(`[${current}/${total}] ${offer.name}: ${result.success ? '✅ 성공' : '❌ 실패'}`);

            // 배치 아이템 상태 업데이트
            const matchingOffer = dbOffers.find(o => o.numberN === offer.numberN);
            const batchItem = matchingOffer ? batchItems.find(item => item.offerId === matchingOffer.id) : undefined;

            if (batchItem) {
              if (result.success) {
                await this.batchRepo.updateItemUploadStatus(batchItem.id, 'completed');
                await this.batchRepo.updateItemStatus(batchItem.id, 'completed');
              } else {
                await this.batchRepo.updateItemUploadStatus(batchItem.id, 'failed');
                await this.batchRepo.updateItemStatus(batchItem.id, 'failed', result.error);
                failedCount++;
              }

              // 배치 진행 상황 업데이트
              const totalCompleted = await this.batchRepo.findItemsByBatchId(batchId)
                .then(items => items.filter(i => i.status === 'completed').length);
              await this.batchRepo.updateProgress(batchId, totalCompleted, failedCount);
            }
          }
        );

        const uploadSuccessCount = uploadResults.filter(r => r.success).length;
        const uploadFailCount = uploadResults.filter(r => !r.success).length;

        console.log(`\n📊 광고 올리기 결과: 성공 ${uploadSuccessCount}건, 실패 ${uploadFailCount}건`);
      }

      // 5. 브라우저 종료
      await browser.close();

      // 6. 배치 완료 처리
      await this.batchRepo.updateStatus(batchId, 'completed');
      await this.batchRepo.markCompleted(batchId);

      console.log(`✅ 배치 실행 완료 (ID: ${batchId})`);

      return {
        success: true,
        message: `배치 실행 완료: 광고 내리기 ${removeSuccessCount}건, 광고 올리기 ${successfulOffers.length}건`,
        results: {
          removed: removeSuccessCount,
          uploaded: successfulOffers.length,
          failed: failedCount,
        },
      };

    } catch (error) {
      console.error('❌ 배치 실행 중 오류 발생:', error);

      // 브라우저 정리
      if (browser) {
        await browser.close().catch(console.error);
      }

      // 배치 상태를 실패로 변경
      await this.batchRepo.updateStatus(batchId, 'failed');
      await this.batchRepo.markCompleted(batchId);

      throw error;
    }
  }

  /**
   * 배치 재시도 (실패한 항목만)
   */
  async retryBatch(batchId: number) {
    const batch = await this.batchRepo.findById(batchId);
    if (!batch) {
      throw new Error('배치를 찾을 수 없습니다');
    }

    if (batch.status !== 'completed' && batch.status !== 'failed') {
      throw new Error('완료되었거나 실패한 배치만 재시도할 수 있습니다');
    }

    console.log(`🔄 배치 재시도 시작 (ID: ${batchId}, 이름: ${batch.name})`);

    // 실패한 아이템 조회
    const failedItems = await this.batchRepo.findFailedItemsByBatchId(batchId);
    if (failedItems.length === 0) {
      throw new Error('재시도할 실패한 항목이 없습니다');
    }

    console.log(`📊 재시도할 항목 수: ${failedItems.length}건`);

    // 배치 상태를 'uploading'으로 변경
    await this.batchRepo.updateStatus(batchId, 'uploading');

    // 실패한 항목들의 상태 초기화
    for (const item of failedItems) {
      await this.batchRepo.resetItemStatus(item.id);
    }

    // 매물 정보 조회
    const offerIds = failedItems.map(item => item.offerId);
    const dbOffers = await this.offerRepo.findByIds(offerIds);

    if (dbOffers.length === 0) {
      throw new Error('매물 정보를 찾을 수 없습니다');
    }

    // DB Offer 타입을 AipartnerOffer 타입으로 변환
    const offers = dbOffers.map(offer => ({
      numberN: offer.numberN,
      numberA: offer.numberA,
      type: offer.type,
      name: offer.name,
      dong: offer.dong,
      ho: offer.ho,
      address: offer.address,
      areaPublic: offer.areaPublic,
      areaPrivate: offer.areaPrivate,
      areaPyeong: offer.areaPyeong,
      dealType: offer.dealType,
      price: offer.price,
      rent: offer.rent,
      adChannel: offer.adChannel,
      adMethod: offer.adMethod,
      adStatus: offer.adStatus,
      adStartDate: offer.adStartDate,
      adEndDate: offer.adEndDate,
      dateRange: offer.dateRange || '',
      ranking: offer.ranking,
      sharedRank: offer.sharedRank,
      isShared: offer.isShared,
      sharedCount: offer.sharedCount,
      total: offer.total,
    }));

    console.log(`📊 총 ${offers.length}개 매물의 광고를 올립니다`);

    let browser;
    try {
      // 1. 브라우저 시작
      console.log('🌐 브라우저 시작 중...');
      browser = await chromium.launch({
        headless: false,
        channel: 'chrome',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
        ],
      });

      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });

      const page = await context.newPage();

      // 2. 이실장 로그인 (자동 로그인 시도)
      console.log('🔐 이실장 로그인 중...');
      const authService = new AipartnerAuthService();
      let session;

      try {
        // 먼저 자동 로그인 시도
        session = await authService.autoLogin(page);
        console.log('✅ 자동 로그인 성공');
      } catch (autoLoginError) {
        console.log('⚠️  자동 로그인 실패, 수동 로그인으로 전환:', autoLoginError);
        // 자동 로그인 실패 시 수동 로그인
        session = await authService.login(page);
      }

      if (!session || !session.cookies || session.cookies.length === 0) {
        throw new Error('이실장 로그인에 실패했습니다');
      }

      console.log('✅ 로그인 성공 - 쿠키:', session.cookies.length, '개');

      // 3. 광고 올리기 실행
      const adUploadScraper = new AdUploadScraper();
      let successCount = 0;
      let newFailCount = 0;

      // 수정된 가격 정보를 numberN 기준으로 변환
      const modifiedPricesByNumberN: Record<string, { price?: string; rent?: string }> = {};
      for (const item of failedItems) {
        const dbOffer = dbOffers.find(o => o.id === item.offerId);
        if (dbOffer && (item.modifiedPrice || item.modifiedRent)) {
          modifiedPricesByNumberN[dbOffer.numberN] = {
            price: item.modifiedPrice || undefined,
            rent: item.modifiedRent || undefined,
          };
        }
      }

      const uploadResults = await adUploadScraper.uploadAdsInBatch(
        page,
        offers,
        modifiedPricesByNumberN,
        async (current, total, offer, result) => {
          console.log(`[${current}/${total}] ${offer.name}: ${result.success ? '✅ 성공' : '❌ 실패'}`);

          // 배치 아이템 상태 업데이트
          const matchingOffer = dbOffers.find(o => o.numberN === offer.numberN);
          const batchItem = matchingOffer ? failedItems.find(item => item.offerId === matchingOffer.id) : undefined;

          if (batchItem) {
            if (result.success) {
              successCount++;
              await this.batchRepo.updateItemUploadStatus(batchItem.id, 'completed');
              await this.batchRepo.updateItemStatus(batchItem.id, 'completed');
            } else {
              newFailCount++;
              await this.batchRepo.updateItemUploadStatus(batchItem.id, 'failed');
              await this.batchRepo.updateItemStatus(batchItem.id, 'failed', result.error);
            }

            // 배치 진행 상황 업데이트
            const allItems = await this.batchRepo.findItemsByBatchId(batchId);
            const totalCompleted = allItems.filter(i => i.status === 'completed').length;
            const totalFailed = allItems.filter(i => i.status === 'failed').length;
            await this.batchRepo.updateProgress(batchId, totalCompleted, totalFailed);
          }
        }
      );

      const uploadSuccessCount = uploadResults.filter(r => r.success).length;
      const uploadFailCount = uploadResults.filter(r => !r.success).length;

      console.log(`\n📊 광고 올리기 결과: 성공 ${uploadSuccessCount}건, 실패 ${uploadFailCount}건`);

      // 4. 브라우저 종료
      await browser.close();

      // 5. 배치 완료 처리
      await this.batchRepo.updateStatus(batchId, 'completed');

      console.log(`✅ 배치 재시도 완료 (ID: ${batchId})`);

      return {
        success: true,
        message: `배치 재시도 완료: 성공 ${uploadSuccessCount}건, 실패 ${uploadFailCount}건`,
        results: {
          retried: failedItems.length,
          success: uploadSuccessCount,
          failed: uploadFailCount,
        },
      };

    } catch (error) {
      console.error('❌ 배치 재시도 중 오류 발생:', error);

      // 브라우저 정리
      if (browser) {
        await browser.close().catch(console.error);
      }

      // 배치 상태를 실패로 변경
      await this.batchRepo.updateStatus(batchId, 'failed');

      throw error;
    }
  }
}
