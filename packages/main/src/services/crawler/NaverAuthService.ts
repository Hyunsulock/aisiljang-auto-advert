import type { Page, Browser } from 'playwright';
import { CookieJar } from 'tough-cookie';
import { delay } from '../../utils/delay.js';
import { AppConfigService } from '../AppConfigService.js';

export interface NaverSession {
  bearerToken: string;
  cookieJar: CookieJar;
}

export interface NaverAuthOptions {
  proxyUsername?: string;
  proxyPassword?: string;
}

// 하드코딩된 상수
const NAVER_COMPLEX_ID = '346';
const NAVER_PROXY_URL = 'http://kr.decodo.com:10000';

/**
 * 네이버 부동산 Bearer 토큰 및 쿠키 가져오기
 */
export class NaverAuthService {
  private proxyUsername: string | null = null;
  private proxyPassword: string | null = null;

  constructor(options: NaverAuthOptions = {}) {
    // 옵션으로 전달받은 경우 사용 (주로 테스트용)
    this.proxyUsername = options.proxyUsername || null;
    this.proxyPassword = options.proxyPassword || null;
  }

  /**
   * Supabase에서 proxy 인증정보 가져오기
   */
  private async loadProxyCredentials(): Promise<void> {
    // 이미 로드되었으면 스킵
    if (this.proxyUsername && this.proxyPassword) {
      return;
    }

    const credentials = await AppConfigService.getNaverProxyCredentials();

    if (!credentials.username || !credentials.password) {
      throw new Error('Naver proxy credentials not found in app_config');
    }

    this.proxyUsername = credentials.username;
    this.proxyPassword = credentials.password;

    console.log('[NaverAuth] Proxy credentials loaded from Supabase');
  }

  /**
   * Bearer 토큰과 쿠키 가져오기 (Browser를 받아서 새 컨텍스트 생성)
   */
  async getBearerTokenAndCookiesWithBrowser(browser: Browser): Promise<NaverSession> {
    console.log('🔑 네이버 Bearer 토큰 가져오는 중...');

    // Supabase에서 proxy 인증정보 로드
    await this.loadProxyCredentials();

    // 새 컨텍스트 생성 (프록시 설정 포함)
    const contextOptions: any = {
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    };

    // 프록시 설정 (항상 사용)
    contextOptions.proxy = {
      server: NAVER_PROXY_URL,
      username: this.proxyUsername,
      password: this.proxyPassword,
    };

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
      if (url.includes(`/api/complexes/overview/${NAVER_COMPLEX_ID}`)) {
        const auth = request.headers()['authorization'];
        if (auth?.startsWith('Bearer ')) {
          bearerToken = auth.replace('Bearer ', '');
          console.log('✅ 네이버 Bearer 토큰 추출 성공');
        }
      }
    });

    // 네이버 부동산 페이지 접속
    await page.goto(
      `https://new.land.naver.com/complexes/${NAVER_COMPLEX_ID}?17&a=APT:ABYG:JGC:PRE&e=RETAIL&ad=true`,
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
    // Supabase에서 proxy 인증정보 로드
    await this.loadProxyCredentials();

    let bearerToken: string | null = null;

    // 요청 가로채기 - Authorization 헤더 추출
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes(`/api/complexes/overview/${NAVER_COMPLEX_ID}`)) {
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
      `https://new.land.naver.com/complexes/${NAVER_COMPLEX_ID}?17&a=APT:ABYG:JGC:PRE&e=RETAIL&ad=true`,
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
