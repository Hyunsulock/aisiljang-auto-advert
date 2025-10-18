import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

export interface BrowserOptions {
  headless?: boolean;
  proxy?: string;
}

/**
 * 브라우저 관리 서비스
 */
export class BrowserService {
  private browser: Browser | null = null;

  /**
   * 브라우저 실행
   */
  async launch(options: BrowserOptions = {}): Promise<Browser> {
    this.browser = await chromium.launch({
      // 항상 시스템 Chrome 사용 (Playwright Chromium 다운로드 불필요)
      channel: 'chrome',

      headless: options.headless ?? false,

      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        options.proxy ? `--proxy-server=${options.proxy}` : '',
      ].filter(Boolean),
    });

    return this.browser;
  }

  /**
   * 새 컨텍스트 생성 (봇 탐지 우회 설정 포함)
   */
  async createContext(): Promise<BrowserContext> {
    if (!this.browser) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    const context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 1000 },
    });

    // 봇 탐지 우회
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
    });

    return context;
  }

  /**
   * 새 페이지 생성
   */
  async createPage(context?: BrowserContext): Promise<Page> {
    if (context) {
      return await context.newPage();
    }

    if (!this.browser) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    const ctx = await this.createContext();
    return await ctx.newPage();
  }

  /**
   * 브라우저 종료
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * 브라우저 인스턴스 가져오기
   */
  getBrowser(): Browser | null {
    return this.browser;
  }
}
