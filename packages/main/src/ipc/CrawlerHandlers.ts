import { ipcMain } from 'electron';
import { CrawlerService } from '../services/crawler/CrawlerService.js';
import { OfferRepository } from '../repositories/OfferRepository.js';
import type { OfferWithRank, CrawlerProgress } from '../types/index.js';
import type { BrowserWindow } from 'electron';

/**
 * 크롤러 IPC 핸들러
 */
export function registerCrawlerHandlers(mainWindow: BrowserWindow) {
  const offerRepo = new OfferRepository();
  let crawler: CrawlerService | null = null;

  /**
   * 크롤링 시작
   */
  ipcMain.handle('crawler:fetch-offers', async (event, options?: { includeRanking?: boolean }) => {
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
          mainWindow.webContents.send('crawler:progress', progress);
        },
      });

      const offers = await crawler.fetchOffers();
      console.log('✅ 크롤링 완료:', offers.length, '건');

      // DB에 저장
      console.log('💾 DB 저장 시작...');
      await offerRepo.upsertMany(offers);
      console.log('✅ DB 저장 완료');

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
   * DB에서 모든 매물 조회
   */
  ipcMain.handle('offers:get-all', async () => {
    try {
      const offers = await offerRepo.findAll();
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
}
