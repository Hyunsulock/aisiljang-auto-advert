import type { Page, Cookie } from 'playwright';
import { delay } from '../../utils/delay.js';
import { CredentialsStore, type Credentials } from '../auth/CredentialsStore.js';

export interface AipartnerSession {
  cookies: Cookie[];
  token: string;
}

/**
 * 이실장 로그인 및 세션 관리
 */
export class AipartnerAuthService {
  private credentialsStore: CredentialsStore;

  constructor() {
    this.credentialsStore = new CredentialsStore();
  }

  /**
   * 자동 로그인 (저장된 계정 정보 사용)
   */
  async autoLogin(page: Page): Promise<AipartnerSession> {
    const credentials = await this.credentialsStore.load();

    if (!credentials) {
      throw new Error('저장된 계정 정보가 없습니다. 먼저 계정을 설정해주세요.');
    }

    console.log('🔐 이실장 자동 로그인 시작...');
    console.log('👤 사용자:', credentials.username);

    await page.goto('https://www.aipartner.com/integrated/login?serviceCode=1000', {
      waitUntil: 'domcontentloaded',
    });

    // 페이지 로딩 대기
    await delay(2000);

    // 아이디 입력 (#member-id)
    console.log('아이디 필드 대기 중...');
    const idInput = page.locator('#member-id');
    await idInput.waitFor({ state: 'visible', timeout: 5000 });

    // 필드 클릭
    await idInput.click();
    await delay(300);

    // 기존 값 전체 선택 후 삭제
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await delay(200);

    // 한 글자씩 타이핑 (delay 추가)
    await idInput.pressSequentially(credentials.username, { delay: 100 });
    console.log('✅ 아이디 입력 완료:', credentials.username);
    await delay(500);

    // 비밀번호 입력 (#member-pw)
    console.log('비밀번호 필드 대기 중...');
    const pwInput = page.locator('#member-pw');
    await pwInput.waitFor({ state: 'visible', timeout: 5000 });

    // 필드 클릭
    await pwInput.click();
    await delay(300);

    // 기존 값 전체 선택 후 삭제
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await delay(200);

    // 한 글자씩 타이핑 (delay 추가)
    await pwInput.pressSequentially(credentials.password, { delay: 100 });
    console.log('✅ 비밀번호 입력 완료');
    await delay(500);

    // 로그인 버튼 클릭 (.btn-login)
    await page.click('.btn-login');
    console.log('🔘 로그인 버튼 클릭');

    // 로그인 완료 대기 (홈 페이지로 리다이렉트)
    try {
      await page.waitForFunction(() => location.href === 'https://www.aipartner.com/home', {
        timeout: 15000,
      });
      console.log('🟢 자동 로그인 성공');
    } catch (error) {
      // 현재 URL 확인
      const currentUrl = page.url();
      console.error('로그인 실패. 현재 URL:', currentUrl);

      // 에러 메시지가 있는지 확인
      try {
        const errorMsg = await page.textContent('.error-message, .alert');
        console.error('에러 메시지:', errorMsg);
      } catch (e) {
        // 에러 메시지 없음
      }

      throw new Error('자동 로그인 실패: 아이디 또는 비밀번호를 확인해주세요.');
    }

    // 광고 리스트 페이지 접근 및 세션 정보 획득
    console.log('📄 광고 리스트 페이지로 이동 중...');
    await page.goto('https://www.aipartner.com/offerings/ad_list', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      throw new Error('광고 리스트 접근 실패: 로그인이 필요합니다.');
    }

    console.log('✅ 광고 리스트 접근 성공!');

    // 팝업 닫기
    await this.closeNoticePopup(page);
    await delay(100);

    const context = page.context();
    const cookies = await context.cookies();

    // _token 추출
    const token = await this.extractToken(page);

    return { cookies, token };
  }

  /**
   * 팝업 닫기 ("오늘 하루 보지 않기" 체크박스 클릭)
   */
  private async closeNoticePopup(page: Page): Promise<void> {
    try {
      // 짧은 대기 시간 (팝업이 완전히 렌더링될 때까지)
      await delay(1000);

      // aria-hidden="false"인 팝업만 찾기 (보이는 팝업)
      const visiblePopups = page.locator('.notice-popup[aria-hidden="false"]');
      const popupCount = await visiblePopups.count();

      if (popupCount > 0) {
        console.log(`📢 ${popupCount}개의 notice-popup 팝업 감지됨`);

        // 모든 보이는 팝업 닫기
        for (let i = 0; i < popupCount; i++) {
          const popup = visiblePopups.nth(i);
          const popupId = await popup.getAttribute('id');
          console.log(`📋 팝업 ID: ${popupId}`);

          // "오늘 하루 보지 않기" 체크박스의 label 찾기
          const checkboxLabel = popup.locator('label.labelInfo');
          const labelCount = await checkboxLabel.count();

          if (labelCount > 0) {
            console.log(`☑️  ${i + 1}번째 팝업의 "오늘 하루 보지 않기" 라벨 클릭 중...`);

            // 라벨이 보이고 클릭 가능할 때까지 대기
            await checkboxLabel.first().waitFor({ state: 'visible', timeout: 5000 });

            // force 옵션으로 강제 클릭 (체크박스가 체크되고 localStorage에 저장되고 팝업 닫힘)
            await checkboxLabel.first().click({ force: true });
            await delay(500);

            console.log(`✅ ${i + 1}번째 팝업 닫기 완료 (오늘 하루 보지 않기 설정)`);
          } else {
            // 체크박스가 없으면 cancel 버튼으로 폴백
            console.log(`⚠️  체크박스가 없어서 cancel 버튼 사용`);
            const cancelButton = popup.locator('button.cancel');
            if (await cancelButton.count() > 0) {
              await cancelButton.first().waitFor({ state: 'visible', timeout: 5000 });
              await cancelButton.first().click({ force: true });
              await delay(500);
              console.log(`✅ ${i + 1}번째 팝업 닫기 완료`);
            }
          }
        }

        console.log('✅ 모든 팝업 닫기 완료');
      } else {
        console.log('ℹ️  보이는 팝업이 없음');
      }
    } catch (error) {
      // 팝업이 없는 경우 무시
      console.log('ℹ️  팝업 처리 중 오류 (무시):', error instanceof Error ? error.message : error);
    }
  }

  /**
   * 이실장 로그인 (사용자가 직접 로그인)
   */
  async login(page: Page): Promise<AipartnerSession> {
    console.log('🔐 이실장 로그인 페이지로 이동...');
    await page.goto('https://www.aipartner.com/integrated/login?serviceCode=1000', {
      waitUntil: 'networkidle',
    });

    // 사용자가 직접 로그인할 때까지 대기
    while (true) {
      console.log('⏳ 사용자 로그인 대기 중...');

      // 페이지 타임아웃 무제한 설정
      page.setDefaultTimeout(0);

      await page.waitForFunction(() => location.href === 'https://www.aipartner.com/home', {
        timeout: 0,
      });
      console.log('🟢 로그인 성공 감지됨');

      // 광고 리스트 페이지 접근 시도
      console.log('📄 광고 리스트 페이지로 이동 중...');
      await page.goto('https://www.aipartner.com/offerings/ad_list', {
        waitUntil: 'domcontentloaded', // networkidle 대신 domcontentloaded 사용
        timeout: 30000,
      });

      const currentUrl = page.url();
      console.log('🔍 광고 리스트 접근 시도. 현재 URL:', currentUrl);

      if (!currentUrl.includes('/login')) {
        console.log('✅ 광고 리스트 접근 성공!');

        // 팝업 닫기 (더블로켓 체험이벤트 등)
        await this.closeNoticePopup(page);
        console.log('closing try')

        await delay(100)


        const context = page.context();
        const cookies = await context.cookies();

        // _token 추출
        const token = await this.extractToken(page);

        return { cookies, token };
      }

      console.log('🔴 접근 실패: 다시 로그인 필요');
    }
  }

  /**
   * 이실장 _token 추출
   */
  private async extractToken(page: Page): Promise<string> {
    let tokenData: string | null = null;

    // 광고중 버튼 대기
    await page.waitForSelector(
      '#wrap > div > div > div > div.sectionWrap > div.statusWrap.ver3 > div.statusItem.statusIng.GTM_offerings_ad_list_ad_ing',
      { timeout: 30000 }
    );

    // 요청 가로채기 - _token 추출
    const requestHandler = (request: any) => {
      if (request.method() === 'POST' && request.url().includes('/offerings/ad_list')) {
        console.log('✅ _token 요청 감지됨');
        const postData = request.postData();
        if (postData) {
          const parsed = new URLSearchParams(postData);
          tokenData = parsed.get('_token') ?? null;
          console.log('✅ _token 추출:', tokenData);
        }
      }
    };

    page.on('request', requestHandler);

    // 광고중 버튼 클릭 (POST 요청 발생)
    await page.click(
      '#wrap > div > div > div > div.sectionWrap > div.statusWrap.ver3 > div.statusItem.statusIng.GTM_offerings_ad_list_ad_ing'
    );

    await delay(1000);

    page.off('request', requestHandler);

    if (!tokenData) {
      throw new Error('❌ _token을 찾을 수 없습니다.');
    }

    return tokenData;
  }

  /**
   * 쿠키를 헤더 문자열로 변환
   */
  cookiesToHeader(cookies: Cookie[]): string {
    return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  }
}
