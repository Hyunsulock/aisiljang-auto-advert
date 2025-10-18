import { BrowserService } from '../browser/BrowserService.js';
import { NaverAuthService } from './NaverAuthService.js';
import { AipartnerAuthService } from './AipartnerAuthService.js';
import { OfferListScraper } from './OfferListScraper.js';
import { NaverRankScraper } from './NaverRankScraper.js';
import type { OfferWithRank, CrawlerProgress } from '../../types/index.js';

export interface CrawlerOptions {
  headless?: boolean;
  includeRanking?: boolean; // 네이버 순위 정보 포함 여부
  onProgress?: (progress: CrawlerProgress) => void;
}

/**
 * 메인 크롤러 서비스 - 모든 크롤링 작업 통합
 */
export class CrawlerService {
  private browserService: BrowserService;
  private options: CrawlerOptions;

  constructor(options: CrawlerOptions = {}) {
    this.browserService = new BrowserService();
    this.options = options;
  }

  /**
   * 매물 리스트 크롤링 (이실장 + 네이버 순위)
   */
  async fetchOffers(): Promise<OfferWithRank[]> {
    try {
      // 1. 브라우저 실행
      this.reportProgress({
        phase: 'auth',
        current: 0,
        total: 100,
        message: '브라우저 실행 중...',
      });

      const browser = await this.browserService.launch({
        headless: this.options.headless ?? false,
      });

      // 2. 네이버 토큰 가져오기 (순위 정보 필요한 경우만)
      let bearerToken: string | null = null;

      if (this.options.includeRanking !== false) {
        this.reportProgress({
          phase: 'auth',
          current: 10,
          total: 100,
          message: '네이버 Bearer 토큰 가져오는 중...',
        });

        const naverPage = await this.browserService.createPage();
        const naverAuth = new NaverAuthService();
        bearerToken = await naverAuth.getBearerToken(naverPage);
      } else {
        console.log('⏭️  네이버 순위 정보 수집 건너뛰기');
      }

      // 3. 이실장 로그인
      this.reportProgress({
        phase: 'auth',
        current: 30,
        total: 100,
        message: '이실장 로그인 중...',
      });

      const aipartnerPage = await this.browserService.createPage();
      const aipartnerAuth = new AipartnerAuthService();

      // 자동 로그인 시도, 실패 시 수동 로그인
      let session;
      try {
        session = await aipartnerAuth.autoLogin(aipartnerPage);
        console.log('✅ 자동 로그인 성공');
      } catch (autoLoginError) {
        console.log('⚠️  자동 로그인 실패, 수동 로그인으로 전환:', autoLoginError);
        session = await aipartnerAuth.login(aipartnerPage);
      }

      // 4. 이실장 매물 리스트 크롤링
      this.reportProgress({
        phase: 'scraping',
        current: 50,
        total: 100,
        message: '이실장 매물 리스트 크롤링 중...',
      });

      const scraper = new OfferListScraper();
      const offers = await scraper.scrapeAll(session.cookies, session.token);

      let result: OfferWithRank[];

      // 5. 네이버 순위 정보 수집 (선택적)
      if (this.options.includeRanking !== false && bearerToken) {
        this.reportProgress({
          phase: 'ranking',
          current: 70,
          total: 100,
          message: '네이버 순위 정보 수집 중...',
        });

        const rankScraper = new NaverRankScraper(bearerToken);
        const offerNumbers = offers.map((o) => o.numberN);
        const rankData = await rankScraper.getRanksForOffers(offerNumbers);

        // 6. 데이터 병합
        this.reportProgress({
          phase: 'completed',
          current: 90,
          total: 100,
          message: '데이터 병합 중...',
        });

        result = offers.map((offer) => {
          const rank = rankData[offer.numberN];
          return {
            ...offer,
            ranking: rank?.ranking ?? null,
            sharedRank: rank?.sharedRank ?? null,
            isShared: rank?.isShared ?? null,
            sharedCount: rank?.sharedCount ?? null,
            total: rank?.total ?? null,
          };
        });
      } else {
        // 순위 정보 없이 기본값으로
        result = offers.map((offer) => ({
          ...offer,
          ranking: null,
          sharedRank: null,
          isShared: null,
          sharedCount: null,
          total: null,
        }));
      }

      // 7. 완료
      this.reportProgress({
        phase: 'completed',
        current: 100,
        total: 100,
        message: `완료! 총 ${result.length}건 수집`,
      });

      console.log(`🎉 크롤링 완료! 총 ${result.length}건`);

      // 브라우저는 닫지 않음 (재사용 위해)
      // await this.browserService.close();

      return result;
    } catch (error) {
      console.error('❌ 크롤링 오류:', error);
      await this.browserService.close();
      throw error;
    }
  }

  /**
   * 브라우저 종료
   */
  async close(): Promise<void> {
    await this.browserService.close();
  }

  /**
   * 진행 상황 보고
   */
  private reportProgress(progress: CrawlerProgress): void {
    console.log(`[${progress.phase}] ${progress.message} (${progress.current}/${progress.total})`);
    if (this.options.onProgress) {
      this.options.onProgress(progress);
    }
  }
}
