import type { Page, Browser } from 'playwright';
import { CookieJar } from 'tough-cookie';
import { delay } from '../../utils/delay.js';

export interface NaverSession {
  bearerToken: string;
  cookieJar: CookieJar;
}

export interface NaverAuthOptions {
  complexId?: string;
  proxyUrl?: string;
  proxyUsername?: string;
  proxyPassword?: string;
}

/**
 * 네이버 부동산 Bearer 토큰 및 쿠키 가져오기
 */
export class NaverAuthService {
  private options: NaverAuthOptions;

  constructor(options: NaverAuthOptions = {}) {
    this.options = {
      complexId: options.complexId || process.env.NAVER_COMPLEX_ID || '364',
      proxyUrl: options.proxyUrl || process.env.NAVER_PROXY_URL,
      proxyUsername: options.proxyUsername || process.env.NAVER_PROXY_USERNAME,
      proxyPassword: options.proxyPassword || process.env.NAVER_PROXY_PASSWORD,
    };
  }

  /**
   * Bearer 토큰과 쿠키 가져오기 (Browser를 받아서 새 컨텍스트 생성)
   */
  async getBearerTokenAndCookiesWithBrowser(browser: Browser): Promise<NaverSession> {
    console.log('🔑 네이버 Bearer 토큰 가져오는 중...');

    // 새 컨텍스트 생성 (프록시 설정 포함)
    const contextOptions: any = {
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    };

    // 프록시 설정
    if (this.options.proxyUrl) {
      contextOptions.proxy = {
        server: this.options.proxyUrl,
        username: this.options.proxyUsername,
        password: this.options.proxyPassword,
      };
    }

    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();

    // 봇 탐지 우회
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
    });

    let bearerToken: string | null = null;

    // 요청 가로채기 - Authorization 헤더 추출
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes(`/api/complexes/overview/${this.options.complexId}`)) {
        const auth = request.headers()['authorization'];
        if (auth?.startsWith('Bearer ')) {
          bearerToken = auth.replace('Bearer ', '');
          console.log('✅ 네이버 Bearer 토큰 추출 성공');
        }
      }
    });

    // 네이버 부동산 페이지 접속
    await page.goto(
      `https://new.land.naver.com/complexes/${this.options.complexId}?17&a=APT:ABYG:JGC:PRE&e=RETAIL&ad=true`,
      { waitUntil: 'networkidle', timeout: 60000 }
    );

    await delay(3000);

    if (!bearerToken) {
      throw new Error('❌ 네이버 Bearer 토큰을 찾을 수 없습니다.');
    }

    // 쿠키 수집
    const cookies = await context.cookies('https://new.land.naver.com');
    const cookieJar = new CookieJar();

    for (const cookie of cookies) {
      const domain = (cookie.domain || 'new.land.naver.com').replace(/^\./, '');
      const cookieStr =
        `${cookie.name}=${cookie.value}; Domain=${domain}; Path=${cookie.path || '/'}` +
        (cookie.secure ? '; Secure' : '') +
        (cookie.httpOnly ? '; HttpOnly' : '');
      await new Promise<void>((resolve, reject) =>
        cookieJar.setCookie(cookieStr, 'https://new.land.naver.com', (err) =>
          err ? reject(err) : resolve()
        )
      );
    }

    console.log(`✅ 쿠키 ${cookies.length}개 수집 완료`);

    // 컨텍스트 닫기
    await context.close();

    return {
      bearerToken,
      cookieJar,
    };
  }

  /**
   * 단일 토큰 가져오기 (하위 호환성)
   */
  async getBearerTokenAndCookies(page: Page): Promise<NaverSession> {
    let bearerToken: string | null = null;

    // 요청 가로채기 - Authorization 헤더 추출
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes(`/api/complexes/overview/${this.options.complexId}`)) {
        const auth = request.headers()['authorization'];
        if (auth?.startsWith('Bearer ')) {
          bearerToken = auth.replace('Bearer ', '');
          console.log('✅ 네이버 Bearer 토큰 추출 성공');
        }
      }
    });

    // 네이버 부동산 페이지 접속
    console.log('🔑 네이버 Bearer 토큰 및 쿠키 가져오는 중...');
    await page.goto(
      `https://new.land.naver.com/complexes/${this.options.complexId}?17&a=APT:ABYG:JGC:PRE&e=RETAIL&ad=true`,
      { waitUntil: 'networkidle' }
    );

    await delay(3000);

    if (!bearerToken) {
      throw new Error('❌ 네이버 Bearer 토큰을 찾을 수 없습니다.');
    }

    // 쿠키 수집
    const cookies = await page.context().cookies('https://new.land.naver.com');
    const cookieJar = new CookieJar();

    for (const cookie of cookies) {
      const domain = (cookie.domain || 'new.land.naver.com').replace(/^\./, '');
      const cookieStr =
        `${cookie.name}=${cookie.value}; Domain=${domain}; Path=${cookie.path || '/'}` +
        (cookie.secure ? '; Secure' : '') +
        (cookie.httpOnly ? '; HttpOnly' : '');
      await new Promise<void>((resolve, reject) =>
        cookieJar.setCookie(cookieStr, 'https://new.land.naver.com', (err) =>
          err ? reject(err) : resolve()
        )
      );
    }

    console.log(`✅ 쿠키 ${cookies.length}개 수집 완료`);

    return {
      bearerToken,
      cookieJar,
    };
  }
}
