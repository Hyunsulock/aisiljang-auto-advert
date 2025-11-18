import { ipcMain } from 'electron';
import { CrawlerService } from '../services/crawler/CrawlerService.js';
import { OfferRepository } from '../repositories/OfferRepository.js';
import { CompetingAdsRepository } from '../repositories/CompetingAdsRepository.js';
import { NaverAuthService } from '../services/crawler/NaverAuthService.js';
import { NaverRankScraper } from '../services/crawler/NaverRankScraper.js';
import { BrowserService } from '../services/browser/BrowserService.js';
import type { OfferWithRank, CrawlerProgress } from '../types/index.js';
import type { BrowserWindow } from 'electron';

// 윈도우 참조를 저장할 변수
let _mainWindow: BrowserWindow | null = null;
// 핸들러 등록 여부 확인
let _handlersRegistered = false;

const offerRepo = new OfferRepository();
const competingAdsRepo = new CompetingAdsRepository();
let crawler: CrawlerService | null = null;

/**
 * 크롤러 IPC 핸들러
 */
export function registerCrawlerHandlers(mainWindow?: BrowserWindow): void {
  console.log('[CrawlerHandlers] registerCrawlerHandlers 호출됨', {
    hasWindow: !!mainWindow,
    alreadyRegistered: _handlersRegistered,
  });

  // 윈도우가 제공되면 저장
  if (mainWindow) {
    _mainWindow = mainWindow;
    console.log('[CrawlerHandlers] 윈도우 참조 업데이트됨');
  }

  // 이미 등록되었으면 윈도우 참조만 업데이트하고 리턴
  if (_handlersRegistered) {
    console.log('[CrawlerHandlers] 핸들러 이미 등록됨, 리턴');
    return;
  }
  _handlersRegistered = true;

  console.log('[CrawlerHandlers] 핸들러 등록 시작...');

  /**
   * 크롤링 시작
   */
  ipcMain.handle('crawler:fetch-offers', async (_event, options?: { includeRanking?: boolean }) => {
    try {
      // 크롤링 시작 전 기존 매물 데이터 삭제
      console.log('🗑️  기존 매물 데이터 삭제 중...');
      await offerRepo.deleteAll();
      console.log('✅ 기존 매물 데이터 삭제 완료');

      // 진행 상황을 renderer로 전송
      crawler = new CrawlerService({
        headless: false,
        includeRanking: options?.includeRanking ?? false,
        onProgress: (progress: CrawlerProgress) => {
          if (_mainWindow && !_mainWindow.isDestroyed()) {
            _mainWindow.webContents.send('crawler:progress', progress);
          }
        },
      });

      const offers = await crawler.fetchOffers();
      console.log('✅ 크롤링 완료:', offers.length, '건');

      // DB에 저장
      console.log('💾 DB 저장 시작...');
      await offerRepo.upsertMany(offers);
      console.log('✅ DB 저장 완료');

      // 경쟁 광고 분석 데이터 저장
      console.log('💾 경쟁 광고 분석 데이터 저장 시작...');
      let savedAnalysisCount = 0;
      for (const offer of offers) {
        if (offer.rankingAnalysis) {
          const savedOffer = await offerRepo.findByNumberN(offer.numberN);
          if (savedOffer) {
            await competingAdsRepo.upsert(savedOffer.id, offer.rankingAnalysis);
            savedAnalysisCount++;
          }
        }
      }
      console.log(`✅ 경쟁 광고 분석 데이터 ${savedAnalysisCount}건 저장 완료`);

      await crawler.close();
      crawler = null;

      return {
        success: true,
        data: offers,
        count: offers.length,
      };
    } catch (error) {
      console.error('❌ 크롤러 오류:', error);
      if (crawler) {
        await crawler.close();
        crawler = null;
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
  console.log('[CrawlerHandlers] ✅ crawler:fetch-offers 핸들러 등록됨');

  // offers:get-all 핸들러는 DbModule로 이동됨

  /**
   * DB에서 광고중인 매물만 조회
   */
  ipcMain.handle('offers:get-advertising', async () => {
    try {
      const offers = await offerRepo.findAdvertising();
      return {
        success: true,
        data: offers,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * 매물 개수 조회
   */
  ipcMain.handle('offers:count', async () => {
    try {
      const count = await offerRepo.count();
      return {
        success: true,
        data: count,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * 크롤링 취소
   */
  ipcMain.handle('crawler:cancel', async () => {
    try {
      if (crawler) {
        await crawler.close();
        crawler = null;
      }
      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * 단일 네이버 매물 ID의 랭킹 가져오기
   */
  ipcMain.handle('crawler:fetch-single-rank', async (_event, offerId: string) => {
    let browserService: BrowserService | null = null;

    try {
      console.log(`📊 네이버 매물 ${offerId} 랭킹 조회 시작...`);

      // 1. 브라우저 실행
      browserService = new BrowserService();
      const browser = await browserService.launch({ headless: false });

      // 2. 네이버 토큰 및 쿠키 가져오기
      const naverAuth = new NaverAuthService({
        complexId: process.env.NAVER_COMPLEX_ID,
        proxyUrl: process.env.NAVER_PROXY_URL,
        proxyUsername: process.env.NAVER_PROXY_USERNAME,
        proxyPassword: process.env.NAVER_PROXY_PASSWORD,
      });

      const naverSession = await naverAuth.getBearerTokenAndCookiesWithBrowser(browser);

      // 3. 랭킹 스크래퍼 초기화
      const rankScraper = new NaverRankScraper(
        naverSession.bearerToken,
        naverSession.cookieJar,
        {
          proxyUrl: process.env.NAVER_PROXY_URL,
          proxyUsername: process.env.NAVER_PROXY_USERNAME,
          proxyPassword: process.env.NAVER_PROXY_PASSWORD,
        }
      );

      // 4. 랭킹 정보 가져오기
      const rankData = await rankScraper.getRanksForOffers([offerId]);

      // 5. 브라우저 종료
      await browserService.close();

      const result = rankData[offerId];

      if (!result) {
        return {
          success: false,
          error: '랭킹 정보를 찾을 수 없습니다.',
        };
      }

      console.log(`✅ 네이버 매물 ${offerId} 랭킹 조회 완료`);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('❌ 네이버 랭킹 조회 오류:', error);

      if (browserService) {
        await browserService.close();
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * 랭킹 분석: 내 광고와 경쟁 광고 비교
   */
  ipcMain.handle('crawler:analyze-ranking', async (_event, { offerId, buildingName, price }: { offerId: string; buildingName?: string; price?: string }) => {
    let browserService: BrowserService | null = null;

    try {
      console.log(`🔍 랭킹 분석 시작: ${offerId}`);

      // 1. 브라우저 실행
      browserService = new BrowserService();
      const browser = await browserService.launch({ headless: false });

      // 2. 네이버 토큰 및 쿠키 가져오기
      const naverAuth = new NaverAuthService({
        complexId: process.env.NAVER_COMPLEX_ID,
        proxyUrl: process.env.NAVER_PROXY_URL,
        proxyUsername: process.env.NAVER_PROXY_USERNAME,
        proxyPassword: process.env.NAVER_PROXY_PASSWORD,
      });

      const naverSession = await naverAuth.getBearerTokenAndCookiesWithBrowser(browser);

      // 3. 랭킹 스크래퍼 초기화
      const rankScraper = new NaverRankScraper(
        naverSession.bearerToken,
        naverSession.cookieJar,
        {
          proxyUrl: process.env.NAVER_PROXY_URL,
          proxyUsername: process.env.NAVER_PROXY_USERNAME,
          proxyPassword: process.env.NAVER_PROXY_PASSWORD,
        }
      );

      // 4. 랭킹 분석
      const analysis = await rankScraper.analyzeRanking(offerId, buildingName, price);

      // 5. 브라우저 종료
      await browserService.close();

      console.log(`✅ 랭킹 분석 완료`);

      return {
        success: true,
        data: analysis,
      };
    } catch (error) {
      console.error('❌ 랭킹 분석 오류:', error);

      if (browserService) {
        await browserService.close();
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
}
