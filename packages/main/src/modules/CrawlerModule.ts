import { ipcMain, BrowserWindow } from 'electron';
import type { AppModule } from '../AppModule.js';
import type { ModuleContext } from '../ModuleContext.js';
import { CrawlerService } from '../services/crawler/CrawlerService.js';
import { OfferRepository } from '../repositories/OfferRepository.js';
import { CompetingAdsRepository } from '../repositories/CompetingAdsRepository.js';
import { NaverAuthService } from '../services/crawler/NaverAuthService.js';
import { NaverRankScraper } from '../services/crawler/NaverRankScraper.js';
import { BrowserService } from '../services/browser/BrowserService.js';
import type { CrawlerProgress } from '../types/index.js';

/**
 * 크롤러 모듈
 */
export class CrawlerModule implements AppModule {
  private mainWindow: BrowserWindow | null = null;
  private offerRepo: OfferRepository | null = null;
  private competingAdsRepo: CompetingAdsRepository | null = null;
  private crawler: CrawlerService | null = null;

  async enable({ app }: ModuleContext): Promise<void> {
    console.log('[CrawlerModule] Initializing...');

    // enable 메서드 내에서 초기화
    this.offerRepo = new OfferRepository();
    this.competingAdsRepo = new CompetingAdsRepository();

    this.registerHandlers();

    // 윈도우가 생성되면 참조 저장
    app.on('browser-window-created', (_, window) => {
      console.log('[CrawlerModule] 윈도우 생성됨, 참조 저장');
      this.mainWindow = window;
    });

    // 이미 생성된 윈도우가 있다면 참조 저장
    const existingWindows = BrowserWindow.getAllWindows();
    if (existingWindows.length > 0) {
      console.log(`[CrawlerModule] 기존 윈도우 ${existingWindows.length}개 발견, 참조 저장`);
      this.mainWindow = existingWindows[0];
    }

    console.log('[CrawlerModule] Crawler handlers registered');
  }

  private registerHandlers(): void {
    /**
     * 크롤링 시작
     */
    ipcMain.handle('crawler:fetch-offers', async (_event, options?: { includeRanking?: boolean }) => {
      try {
        // 크롤링 시작 전 기존 매물 데이터 삭제
        console.log('🗑️  기존 매물 데이터 삭제 중...');
        await this.offerRepo!.deleteAll();
        console.log('✅ 기존 매물 데이터 삭제 완료');

        // 진행 상황을 renderer로 전송
        this.crawler = new CrawlerService({
          headless: false,
          includeRanking: options?.includeRanking ?? false,
          onProgress: (progress: CrawlerProgress) => {
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
              this.mainWindow.webContents.send('crawler:progress', progress);
            }
          },
        });

        const offers = await this.crawler.fetchOffers();
        console.log('✅ 크롤링 완료:', offers.length, '건');

        // DB에 저장
        console.log('💾 DB 저장 시작...');
        await this.offerRepo!.upsertMany(offers);
        console.log('✅ DB 저장 완료');

        // 경쟁 광고 분석 데이터 저장
        console.log('💾 경쟁 광고 분석 데이터 저장 시작...');
        let savedAnalysisCount = 0;
        for (const offer of offers) {
          if (offer.rankingAnalysis) {
            const savedOffer = await this.offerRepo!.findByNumberN(offer.numberN);
            if (savedOffer) {
              await this.competingAdsRepo!.upsert(savedOffer.id, offer.rankingAnalysis);
              savedAnalysisCount++;
            }
          }
        }
        console.log(`✅ 경쟁 광고 분석 데이터 ${savedAnalysisCount}건 저장 완료`);

        await this.crawler.close();
        this.crawler = null;

        return {
          success: true,
          data: offers,
          count: offers.length,
        };
      } catch (error) {
        console.error('❌ 크롤러 오류:', error);
        if (this.crawler) {
          await this.crawler.close();
          this.crawler = null;
        }

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
        const offers = await this.offerRepo!.findAdvertising();
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
        const count = await this.offerRepo!.count();
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
        if (this.crawler) {
          await this.crawler.close();
          this.crawler = null;
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
}
