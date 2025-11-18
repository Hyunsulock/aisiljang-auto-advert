/**
 * Crawler 기능
 */

import { ipcMain, BrowserWindow } from 'electron';
import { CrawlerService } from '../../services/crawler/CrawlerService.js';
import { OfferRepository } from '../../repositories/OfferRepository.js';
import { CompetingAdsRepository } from '../../repositories/CompetingAdsRepository.js';
import { NaverAuthService } from '../../services/crawler/NaverAuthService.js';
import { NaverRankScraper } from '../../services/crawler/NaverRankScraper.js';
import { BrowserService } from '../../services/browser/BrowserService.js';
import type { CrawlerProgress } from '../../types/index.js';
import { CRAWLER_CHANNELS } from './crawler.channels.js';

// 모듈 레벨 상태
let mainWindow: BrowserWindow | null = null;
let crawler: CrawlerService | null = null;
const offerRepo = new OfferRepository();
const competingAdsRepo = new CompetingAdsRepository();

/**
 * 윈도우 참조 설정
 */
export function setMainWindow(window: BrowserWindow) {
  mainWindow = window;
  console.log('[Crawler] Main window reference updated');
}

/**
 * Crawler IPC 핸들러 등록
 */
export function registerCrawlerHandlers(window?: BrowserWindow) {
  if (window) {
    setMainWindow(window);
  }

  /**
   * 크롤링 시작
   */
  ipcMain.handle(CRAWLER_CHANNELS.FETCH_OFFERS, async (_event, options?: { includeRanking?: boolean }) => {
    try {
      console.log('🗑️  기존 매물 데이터 삭제 중...');
      await offerRepo.deleteAll();
      console.log('✅ 기존 매물 데이터 삭제 완료');

      crawler = new CrawlerService({
        headless: false,
        includeRanking: options?.includeRanking ?? false,
        onProgress: (progress: CrawlerProgress) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(CRAWLER_CHANNELS.PROGRESS, progress);
          }
        },
      });

      const offers = await crawler.fetchOffers();
      console.log('✅ 크롤링 완료:', offers.length, '건');

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

  /**
   * 광고중인 매물 조회
   */
  ipcMain.handle(CRAWLER_CHANNELS.GET_ADVERTISING, async () => {
    try {
      const offers = await offerRepo.findAdvertising();
      return { success: true, data: offers };
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
  ipcMain.handle(CRAWLER_CHANNELS.COUNT, async () => {
    try {
      const count = await offerRepo.count();
      return { success: true, data: count };
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
  ipcMain.handle(CRAWLER_CHANNELS.CANCEL, async () => {
    try {
      if (crawler) {
        await crawler.close();
        crawler = null;
      }
      return { success: true };
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
  ipcMain.handle(CRAWLER_CHANNELS.FETCH_SINGLE_RANK, async (_event, offerId: string) => {
    let browserService: BrowserService | null = null;

    try {
      console.log(`📊 네이버 매물 ${offerId} 랭킹 조회 시작...`);

      browserService = new BrowserService();
      const browser = await browserService.launch({ headless: false });

      const naverAuth = new NaverAuthService();

      const naverSession = await naverAuth.getBearerTokenAndCookiesWithBrowser(browser);

      const rankScraper = new NaverRankScraper(naverSession.bearerToken, naverSession.cookieJar);

      const rankData = await rankScraper.getRanksForOffers([offerId]);
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
  ipcMain.handle(CRAWLER_CHANNELS.ANALYZE_RANKING, async (_event, { offerId, buildingName, price }: { offerId: string; buildingName?: string; price?: string }) => {
    let browserService: BrowserService | null = null;

    try {
      console.log(`🔍 랭킹 분석 시작: ${offerId}`);

      browserService = new BrowserService();
      const browser = await browserService.launch({ headless: false });

      const naverAuth = new NaverAuthService();

      const naverSession = await naverAuth.getBearerTokenAndCookiesWithBrowser(browser);

      const rankScraper = new NaverRankScraper(naverSession.bearerToken, naverSession.cookieJar);

      const analysis = await rankScraper.analyzeRanking(offerId, buildingName, price);

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

  console.log('[Crawler] IPC handlers registered');
}
