import { BatchRepository } from '../../repositories/BatchRepository.js';
import { OfferRepository } from '../../repositories/OfferRepository.js';
import { chromium } from 'playwright';
import { AdRemoveScraper } from '../crawler/AdRemoveScraper.js';
import { AdModifyScraper } from '../crawler/AdModifyScraper.js';
import { AipartnerAuthService } from '../crawler/AipartnerAuthService.js';

export interface CreateBatchRequest {
  name: string;
  offerIds: number[];
  modifiedPrices?: Record<number, { price?: string; rent?: string; floorExposure?: boolean }>;
  shouldReAdvertise?: Record<number, boolean>; // 각 매물의 재광고 여부 (기본값: true)
  scheduledAt?: string; // ISO 8601 형식의 날짜/시간 문자열
}

// 재광고 단계 정의
export const RE_ADVERTISE_STEPS = {
  SEARCHING: 'searching',           // 매물 검색 중
  FOUND: 'found',                   // 매물 발견
  CLICKING_READD: 'clicking_readd', // 재광고 버튼 클릭
  POPUP_OPENED: 'popup_opened',     // 1차 팝업 열림
  SELECTING_DIRECT: 'selecting_direct', // 바로 재광고 선택
  CONSENT_POPUP: 'consent_popup',   // 2차 동의 팝업
  CONFIRMING: 'confirming',         // 확인 중
  VERIFICATION_PAGE: 'verification_page', // verification 페이지
  UPLOADING_FILES: 'uploading_files', // 파일 업로드 중 (신홍보확인서)
  DRAWING_SIGNATURE: 'drawing_signature', // 전자서명 중 (구홍보확인서)
  SAVING: 'saving',                 // 저장 중
  VERIFY_PAGE: 'verify_page',       // verify 페이지
  RETURNING: 'returning',           // ad_list로 복귀 중
  COMPLETED: 'completed',           // 완료
  FAILED: 'failed',                 // 실패
} as const;

export type ReAdvertiseStep = typeof RE_ADVERTISE_STEPS[keyof typeof RE_ADVERTISE_STEPS];

// 단계별 한글 라벨
export const STEP_LABELS: Record<string, string> = {
  [RE_ADVERTISE_STEPS.SEARCHING]: '매물 검색 중',
  [RE_ADVERTISE_STEPS.FOUND]: '매물 발견',
  [RE_ADVERTISE_STEPS.CLICKING_READD]: '재광고 버튼 클릭',
  [RE_ADVERTISE_STEPS.POPUP_OPENED]: '팝업 열림',
  [RE_ADVERTISE_STEPS.SELECTING_DIRECT]: '바로 재광고 선택',
  [RE_ADVERTISE_STEPS.CONSENT_POPUP]: '동의 팝업',
  [RE_ADVERTISE_STEPS.CONFIRMING]: '확인 중',
  [RE_ADVERTISE_STEPS.VERIFICATION_PAGE]: '검증 페이지 이동',
  [RE_ADVERTISE_STEPS.UPLOADING_FILES]: '파일 업로드 중',
  [RE_ADVERTISE_STEPS.DRAWING_SIGNATURE]: '전자서명 중',
  [RE_ADVERTISE_STEPS.SAVING]: '저장 중',
  [RE_ADVERTISE_STEPS.VERIFY_PAGE]: '검증 완료 페이지',
  [RE_ADVERTISE_STEPS.RETURNING]: '목록으로 복귀',
  [RE_ADVERTISE_STEPS.COMPLETED]: '완료',
  [RE_ADVERTISE_STEPS.FAILED]: '실패',
};

export interface BatchProgressUpdate {
  batchId: number;
  status: string;
  totalCount: number;
  completedCount: number;
  failedCount: number;
  currentItem?: {
    name: string;
    index: number;
    step?: string;      // 현재 단계
    stepLabel?: string; // 단계 한글 라벨
  };
}

export type BatchProgressCallback = (update: BatchProgressUpdate) => void;

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

    // 2. 매물 정보 조회 (스냅샷 저장용)
    const offers = await this.offerRepo.findByIds(request.offerIds);
    const offerMap = new Map(offers.map(o => [o.id, o]));

    // 3. 배치 아이템 생성 (매물 정보 스냅샷 포함)
    const items = request.offerIds.map(offerId => {
      const offer = offerMap.get(offerId);
      return {
        batchId: batch.id,
        offerId,
        // 매물 정보 스냅샷
        offerName: offer?.name ?? null,
        offerDong: offer?.dong ?? null,
        offerHo: offer?.ho ?? null,
        offerDealType: offer?.dealType ?? null,
        // 작업 상태
        status: 'pending',
        modifyStatus: 'pending',
        reAdvertiseStatus: 'pending',
        modifiedPrice: request.modifiedPrices?.[offerId]?.price ?? null,
        modifiedRent: request.modifiedPrices?.[offerId]?.rent ?? null,
        modifiedFloorExposure: request.modifiedPrices?.[offerId]?.floorExposure ?? null,
        shouldReAdvertise: request.shouldReAdvertise?.[offerId] ?? true, // 기본값: true (재광고 함)
        retryCount: 0,
      };
    });

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

    // 매물 정보 조회
    const offerIds = items.map(item => item.offerId);
    const offers = await this.offerRepo.findByIds(offerIds);
    const offerMap = new Map(offers.map(o => [o.id, o]));

    // items에 offer 정보 추가
    const itemsWithOffer = items.map(item => ({
      ...item,
      offer: offerMap.get(item.offerId) || null,
    }));

    return {
      ...batch,
      items: itemsWithOffer,
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
  async executeBatch(batchId: number, progressCallback?: BatchProgressCallback) {
    const batch = await this.batchRepo.findById(batchId);
    if (!batch) {
      throw new Error('배치를 찾을 수 없습니다');
    }

    if (batch.status !== 'pending' && batch.status !== 'scheduled') {
      throw new Error('대기 중이거나 예약된 배치만 실행할 수 있습니다');
    }

    console.log(`🚀 배치 실행 시작 (ID: ${batchId}, 이름: ${batch.name})`);

    // 배치 상태를 'modifying'으로 변경
    await this.batchRepo.updateStatus(batchId, 'modifying');
    await this.batchRepo.markStarted(batchId);

    // 실시간 진행 상태 전송
    progressCallback?.({
      batchId,
      status: 'modifying',
      totalCount: batch.totalCount,
      completedCount: 0,
      failedCount: 0,
    });

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
      dong: offer.dong ?? null,
      ho: offer.ho ?? null,
      address: offer.address,
      areaPublic: offer.areaPublic ?? null,
      areaPrivate: offer.areaPrivate ?? null,
      areaPyeong: offer.areaPyeong ?? null,
      dealType: offer.dealType,
      price: offer.price,
      rent: offer.rent ?? null,
      adChannel: offer.adChannel ?? null,
      adMethod: offer.adMethod ?? null,
      adStatus: offer.adStatus,
      adStartDate: offer.adStartDate ?? null,
      adEndDate: offer.adEndDate ?? null,
      dateRange: offer.dateRange || '',
      ranking: offer.ranking ?? null,
      sharedRank: offer.sharedRank ?? null,
      isShared: offer.isShared ?? null,
      sharedCount: offer.sharedCount ?? null,
      total: offer.total ?? null,
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

      // 3. 1단계: 가격/층수 노출 변동이 있는 매물들을 모두 한번에 수정
      const offersToModify = [];
      for (const item of batchItems) {
        const dbOffer = dbOffers.find(o => o.id === item.offerId);
        if (dbOffer && (item.modifiedPrice || item.modifiedRent || item.modifiedFloorExposure !== null)) {
          offersToModify.push({
            numberN: dbOffer.numberN,
            modifiedPrice: item.modifiedPrice || undefined,
            modifiedRent: item.modifiedRent || undefined,
            floorExposure: item.modifiedFloorExposure !== null ? item.modifiedFloorExposure : undefined,
            adStartDate: dbOffer.adStartDate || undefined,
          });
        }
      }

      // 가격 수정이 있는 경우 먼저 모두 처리
      if (offersToModify.length > 0) {
        console.log(`\n💰 [1단계] 가격 수정할 매물: ${offersToModify.length}건`);

        // 최적화: 등록일 기준 내림차순 정렬 (최신 매물부터 처리)
        offersToModify.sort((a, b) => {
          if (!a.adStartDate || !b.adStartDate) return 0;
          const dateA = a.adStartDate.replace(/\./g, '');
          const dateB = b.adStartDate.replace(/\./g, '');
          return dateB.localeCompare(dateA);
        });

        console.log(`📅 등록일 순서 (최신순): ${offersToModify.map(o => o.adStartDate).join(', ')}`);

        const adModifyScraper = new AdModifyScraper();
        const modifyResults = await adModifyScraper.modifyPricesBatch(
          page,
          offersToModify,
          (message) => {
            console.log(`[가격 수정] ${message}`);
          }
        );

        const modifySuccessCount = modifyResults.results.filter(r => r.success).length;
        const modifyFailCount = modifyResults.results.filter(r => !r.success).length;

        // 가격 수정 결과를 배치 아이템에 반영
        for (const result of modifyResults.results) {
          const dbOffer = dbOffers.find(o => o.numberN === result.numberN);
          const batchItem = dbOffer ? batchItems.find(item => item.offerId === dbOffer.id) : undefined;

          if (batchItem) {
            if (result.success) {
              await this.batchRepo.updateItemModifyStatus(batchItem.id, 'completed');
            } else {
              await this.batchRepo.updateItemModifyStatus(batchItem.id, 'failed');
            }
          }
        }

        console.log(`✅ [1단계] 가격 수정 완료: 성공 ${modifySuccessCount}건, 실패 ${modifyFailCount}건\n`);
      } else {
        console.log(`\n💰 [1단계] 가격 수정할 매물 없음\n`);
      }

      // 4. 2단계: 재광고할 매물만 필터링하여 재광고 작업 실행
      const offersToReAdvertise = [];
      for (const item of batchItems) {
        // shouldReAdvertise가 true인 매물만 재광고
        if (item.shouldReAdvertise) {
          const dbOffer = dbOffers.find(o => o.id === item.offerId);
          if (dbOffer) {
            offersToReAdvertise.push({
              numberN: dbOffer.numberN,
              numberA: dbOffer.numberA,
              type: dbOffer.type,
              name: dbOffer.name,
              dong: dbOffer.dong ?? null,
              ho: dbOffer.ho ?? null,
              address: dbOffer.address,
              areaPublic: dbOffer.areaPublic ?? null,
              areaPrivate: dbOffer.areaPrivate ?? null,
              areaPyeong: dbOffer.areaPyeong ?? null,
              dealType: dbOffer.dealType,
              price: dbOffer.price,
              rent: dbOffer.rent ?? null,
              adChannel: dbOffer.adChannel ?? null,
              adMethod: dbOffer.adMethod ?? null,
              adStatus: dbOffer.adStatus,
              adStartDate: dbOffer.adStartDate ?? null,
              adEndDate: dbOffer.adEndDate ?? null,
              dateRange: dbOffer.dateRange || '',
              ranking: dbOffer.ranking ?? null,
              sharedRank: dbOffer.sharedRank ?? null,
              isShared: dbOffer.isShared ?? null,
              sharedCount: dbOffer.sharedCount ?? null,
              total: dbOffer.total ?? null,
            });
          }
        } else {
          // 재광고 건너뛴 항목은 completed로 처리
          const dbOffer = dbOffers.find(o => o.id === item.offerId);
          console.log(`⏭️  재광고 건너뛰기 (정보만 수정): ${dbOffer?.name || item.offerId}`);
          await this.batchRepo.updateItemReAdvertiseStatus(item.id, 'skipped');
          await this.batchRepo.updateItemStatus(item.id, 'completed');
        }
      }

      console.log(`🔄 [2단계] 재광고 시작: ${offersToReAdvertise.length}건 (전체 ${offers.length}건 중)`);

      if (offersToReAdvertise.length === 0) {
        console.log('⏭️  재광고할 매물이 없습니다 (모두 정보만 수정)');

        // 모두 건너뛴 경우에도 배치 완료 처리
        await this.batchRepo.updateStatus(batchId, 'completed');
        await this.batchRepo.markCompleted(batchId);
        await browser.close();

        return {
          success: true,
          message: '배치 실행 완료: 모든 매물이 정보만 수정되었습니다',
          results: {
            completed: batchItems.filter(i => !i.shouldReAdvertise).length,
            failed: 0,
          },
        };
      }

      await this.batchRepo.updateStatus(batchId, 'readvertising');

      progressCallback?.({
        batchId,
        status: 'readvertising',
        totalCount: batch.totalCount,
        completedCount: 0,
        failedCount: 0,
      });

      const adRemoveScraper = new AdRemoveScraper();
      let completedCount = batchItems.filter(i => !i.shouldReAdvertise).length; // 건너뛴 항목도 카운트
      let failedCount = 0;

      // 각 매물 순차 처리 (단계별 콜백 지원)
      const results: Array<{ offer: any; success: boolean; error?: string }> = [];

      for (let i = 0; i < offersToReAdvertise.length; i++) {
        const offer = offersToReAdvertise[i];
        const current = i + 1;
        const total = offersToReAdvertise.length;

        console.log(`\n[${current}/${total}] 처리 중: ${offer.name}`);

        const matchingOffer = dbOffers.find(o => o.numberN === offer.numberN);
        const batchItem = matchingOffer ? batchItems.find(item => item.offerId === matchingOffer.id) : undefined;

        // 단계별 콜백 설정
        const onStepProgress = async (step: ReAdvertiseStep) => {
          if (batchItem) {
            // 아이템의 currentStep 업데이트
            await this.batchRepo.updateItemStep(batchItem.id, step);
          }

          // 실시간 진행 상태 전송
          progressCallback?.({
            batchId,
            status: 'readvertising',
            totalCount: total,
            completedCount,
            failedCount,
            currentItem: {
              name: offer.name,
              index: current,
              step,
              stepLabel: STEP_LABELS[step],
            },
          });
        };

        // 재광고 실행
        const result = await adRemoveScraper.removeAd(page, offer, onStepProgress);
        results.push({ offer, ...result });

        console.log(`[${current}/${total}] ${offer.name}: ${result.success ? '✅ 성공' : '❌ 실패'}`);

        if (batchItem) {
          if (result.success) {
            completedCount++;
            await this.batchRepo.updateItemReAdvertiseStatus(batchItem.id, 'completed');
            await this.batchRepo.updateItemStatus(batchItem.id, 'completed');
            await this.batchRepo.updateItemStep(batchItem.id, 'completed');
          } else {
            failedCount++;
            await this.batchRepo.updateItemReAdvertiseStatus(batchItem.id, 'failed');
            await this.batchRepo.updateItemStatus(batchItem.id, 'failed', result.error);
            await this.batchRepo.updateItemStep(batchItem.id, 'failed');
          }

          await this.batchRepo.updateProgress(batchId, completedCount, failedCount);

          progressCallback?.({
            batchId,
            status: 'readvertising',
            totalCount: total,
            completedCount,
            failedCount,
            currentItem: {
              name: offer.name,
              index: current,
              step: result.success ? 'completed' : 'failed',
              stepLabel: result.success ? STEP_LABELS['completed'] : STEP_LABELS['failed'],
            },
          });
        }

        // 요청 사이 간격 (서버 부하 방지)
        if (i < offersToReAdvertise.length - 1) {
          const delay = 2000 + Math.random() * 1000;
          console.log(`⏳ ${delay.toFixed(0)}ms 대기 중...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      console.log(`\n📊 [2단계] 재광고 결과: 성공 ${successCount}건, 실패 ${failCount}건`);

      // 5. 브라우저 종료
      await browser.close();

      // 6. 배치 완료 처리
      await this.batchRepo.updateStatus(batchId, 'completed');
      await this.batchRepo.markCompleted(batchId);

      console.log(`✅ 배치 실행 완료 (ID: ${batchId})`);

      return {
        success: true,
        message: `배치 실행 완료: 재광고 성공 ${successCount}건, 실패 ${failCount}건`,
        results: {
          completed: successCount,
          failed: failCount,
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
  async retryBatch(batchId: number, progressCallback?: BatchProgressCallback) {
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

    // 배치 상태를 'readvertising'으로 변경
    await this.batchRepo.updateStatus(batchId, 'readvertising');

    // 실시간 진행 상태 전송
    const allItemsBeforeRetry = await this.batchRepo.findItemsByBatchId(batchId);
    const currentCompleted = allItemsBeforeRetry.filter((i: any) => i.status === 'completed').length;
    progressCallback?.({
      batchId,
      status: 'readvertising',
      totalCount: batch.totalCount,
      completedCount: currentCompleted,
      failedCount: failedItems.length,
    });

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
      dong: offer.dong ?? null,
      ho: offer.ho ?? null,
      address: offer.address,
      areaPublic: offer.areaPublic ?? null,
      areaPrivate: offer.areaPrivate ?? null,
      areaPyeong: offer.areaPyeong ?? null,
      dealType: offer.dealType,
      price: offer.price,
      rent: offer.rent ?? null,
      adChannel: offer.adChannel ?? null,
      adMethod: offer.adMethod ?? null,
      adStatus: offer.adStatus,
      adStartDate: offer.adStartDate ?? null,
      adEndDate: offer.adEndDate ?? null,
      dateRange: offer.dateRange || '',
      ranking: offer.ranking ?? null,
      sharedRank: offer.sharedRank ?? null,
      isShared: offer.isShared ?? null,
      sharedCount: offer.sharedCount ?? null,
      total: offer.total ?? null,
    }));

    console.log(`📊 총 ${offers.length}개 매물의 재광고를 시도합니다`);

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

      // 3. 재광고 실행
      const adRemoveScraper = new AdRemoveScraper();
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

      // 각 매물 순차 처리 (단계별 콜백 지원)
      const results: Array<{ offer: any; success: boolean; error?: string }> = [];

      for (let i = 0; i < offers.length; i++) {
        const offer = offers[i];
        const current = i + 1;
        const total = offers.length;

        console.log(`\n[${current}/${total}] 재시도 중: ${offer.name}`);

        const matchingOffer = dbOffers.find(o => o.numberN === offer.numberN);
        const batchItem = matchingOffer ? failedItems.find(item => item.offerId === matchingOffer.id) : undefined;

        // 단계별 콜백 설정
        const onStepProgress = async (step: ReAdvertiseStep) => {
          if (batchItem) {
            await this.batchRepo.updateItemStep(batchItem.id, step);
          }

          // 실시간 진행 상태 전송
          const allItems = await this.batchRepo.findItemsByBatchId(batchId);
          const totalCompleted = allItems.filter((i: any) => i.status === 'completed').length;
          const totalFailed = allItems.filter((i: any) => i.status === 'failed').length;

          progressCallback?.({
            batchId,
            status: 'readvertising',
            totalCount: batch.totalCount,
            completedCount: totalCompleted,
            failedCount: totalFailed,
            currentItem: {
              name: offer.name,
              index: current,
              step,
              stepLabel: STEP_LABELS[step],
            },
          });
        };

        // 재광고 실행
        const result = await adRemoveScraper.removeAd(page, offer, onStepProgress);
        results.push({ offer, ...result });

        console.log(`[${current}/${total}] ${offer.name}: ${result.success ? '✅ 성공' : '❌ 실패'}`);

        if (batchItem) {
          if (result.success) {
            successCount++;
            await this.batchRepo.updateItemModifyStatus(batchItem.id, 'completed');
            await this.batchRepo.updateItemReAdvertiseStatus(batchItem.id, 'completed');
            await this.batchRepo.updateItemStatus(batchItem.id, 'completed');
            await this.batchRepo.updateItemStep(batchItem.id, 'completed');
          } else {
            newFailCount++;
            await this.batchRepo.updateItemModifyStatus(batchItem.id, 'failed');
            await this.batchRepo.updateItemStatus(batchItem.id, 'failed', result.error);
            await this.batchRepo.updateItemStep(batchItem.id, 'failed');
          }

          // 배치 진행 상황 업데이트
          const allItems = await this.batchRepo.findItemsByBatchId(batchId);
          const totalCompleted = allItems.filter((i: any) => i.status === 'completed').length;
          const totalFailed = allItems.filter((i: any) => i.status === 'failed').length;
          await this.batchRepo.updateProgress(batchId, totalCompleted, totalFailed);

          // 실시간 진행 상태 전송
          progressCallback?.({
            batchId,
            status: 'readvertising',
            totalCount: batch.totalCount,
            completedCount: totalCompleted,
            failedCount: totalFailed,
            currentItem: {
              name: offer.name,
              index: current,
              step: result.success ? 'completed' : 'failed',
              stepLabel: result.success ? STEP_LABELS['completed'] : STEP_LABELS['failed'],
            },
          });
        }

        // 요청 사이 간격 (서버 부하 방지)
        if (i < offers.length - 1) {
          const delay = 2000 + Math.random() * 1000;
          console.log(`⏳ ${delay.toFixed(0)}ms 대기 중...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      const retrySuccessCount = results.filter((r: any) => r.success).length;
      const retryFailCount = results.filter((r: any) => !r.success).length;

      console.log(`\n📊 재광고 재시도 결과: 성공 ${retrySuccessCount}건, 실패 ${retryFailCount}건`);

      // 4. 브라우저 종료
      await browser.close();

      // 5. 배치 완료 처리
      await this.batchRepo.updateStatus(batchId, 'completed');

      console.log(`✅ 배치 재시도 완료 (ID: ${batchId})`);

      return {
        success: true,
        message: `배치 재시도 완료: 성공 ${retrySuccessCount}건, 실패 ${retryFailCount}건`,
        results: {
          retried: failedItems.length,
          success: retrySuccessCount,
          failed: retryFailCount,
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
