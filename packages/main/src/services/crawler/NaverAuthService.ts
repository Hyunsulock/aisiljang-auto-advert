import type { Page } from 'playwright';
import { delay } from '../../utils/delay.js';

/**
 * 네이버 부동산 Bearer 토큰 가져오기
 */
export class NaverAuthService {
  /**
   * 네이버 부동산 페이지에서 Bearer 토큰 추출
   */
  async getBearerToken(page: Page): Promise<string> {
    let bearerToken: string | null = null;

    // 요청 가로채기 - Authorization 헤더 추출
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/api/complexes/overview/364')) {
        const auth = request.headers()['authorization'];
        if (auth?.startsWith('Bearer ')) {
          bearerToken = auth.replace('Bearer ', '');
          console.log('✅ 네이버 Bearer 토큰 추출 성공');
        }
      }
    });

    // 네이버 부동산 페이지 접속
    console.log('🔑 네이버 Bearer 토큰 가져오는 중...');
    await page.goto(
      'https://new.land.naver.com/complexes/364?17&a=APT:ABYG:JGC:PRE&e=RETAIL&ad=true',
      { waitUntil: 'networkidle' }
    );

    await delay(3000);

    if (!bearerToken) {
      throw new Error('❌ 네이버 Bearer 토큰을 찾을 수 없습니다.');
    }

    return bearerToken;
  }
}
