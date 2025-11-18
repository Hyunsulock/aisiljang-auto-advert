import { ipcMain } from 'electron';
import { chromium } from 'playwright';
import { AipartnerAuthService } from '../services/crawler/AipartnerAuthService.js';
import { AdModifyScraper } from '../services/crawler/AdModifyScraper.js';

/**
 * 광고 테스트 IPC 핸들러
 * 단일 광고 내리기/올리기 테스트용
 */
export function registerAdTestHandlers() {
  /**
   * 단일 광고 내리기 테스트
   */
  ipcMain.handle('adTest:removeAd', async (_event, numberN: string) => {
    let browser;
    try {
      console.log(`🔽 광고 내리기 테스트 시작: ${numberN}`);

      // 1. 브라우저 시작
      console.log('🌐 브라우저 시작 중...');
      browser = await chromium.launch({
        headless: false,
        channel: 'chrome',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
        ],
      });

      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });

      const page = await context.newPage();

      // 2. 이실장 로그인
      console.log('🔐 이실장 로그인 중...');
      const authService = new AipartnerAuthService();
      let session;

      try {
        // 먼저 자동 로그인 시도
        session = await authService.autoLogin(page);
        console.log('✅ 자동 로그인 성공');
      } catch (autoLoginError) {
        console.log('⚠️  자동 로그인 실패, 수동 로그인으로 전환:', autoLoginError);
        // 자동 로그인 실패 시 수동 로그인
        session = await authService.login(page);
      }

      if (!session || !session.cookies || session.cookies.length === 0) {
        throw new Error('이실장 로그인에 실패했습니다');
      }

      console.log('✅ 로그인 성공');

      // 3. 광고 목록 페이지로 이동
      console.log('📍 광고 목록 페이지로 이동 중...');
      await page.goto('https://www.aipartner.com/offerings/ad_list', {
        waitUntil: 'networkidle',
        timeout: 30000,
      });
      console.log('✅ 광고 목록 페이지 로드 완료');

      await page.waitForTimeout(2000);

      // 4. 광고 진행 중 탭 클릭
      console.log('📍 광고 진행 중 탭 클릭...');
      const progressTab = page.locator('.statusItem.statusAdProgress');
      if ((await progressTab.count()) > 0) {
        await progressTab.click();
        await page.waitForTimeout(2000);
        console.log('✅ 광고 진행 중 탭 클릭 완료');
      }

      // 5. 테이블에서 numberN 찾기
      console.log(`🔍 매물 검색 중: ${numberN}`);
      const rows = await page.locator('table > tbody > tr').all();
      let found = false;

      for (const row of rows) {
        const numberNElement = row.locator('.numberN');
        const numberText = await numberNElement.textContent();
        const cleanedNumber = numberText?.replace(/\D/g, '').trim();

        if (cleanedNumber === numberN) {
          console.log(`✅ 매물 발견: ${numberN}`);
          found = true;

          // 6. 재광고 버튼 찾기 및 클릭
          console.log('🔘 재광고 버튼 클릭 중...');
          const reAdButton = row.locator('.management.GTM_offerings_ad_list_rocket_add.btn-re-ad-pop');

          if ((await reAdButton.count()) === 0) {
            throw new Error('재광고 버튼을 찾을 수 없습니다');
          }

          await reAdButton.click();
          await page.waitForTimeout(1500);
          console.log('✅ 재광고 버튼 클릭 완료, 첫 번째 팝업 대기 중...');

          // 7. 첫 번째 팝업 (선택 팝업) 대기
          await page.waitForSelector('.wrap-pop-tooltip.pop-re-ad', { timeout: 5000 });
          console.log('✅ 재광고 선택 팝업 나타남');

          // 8. "바로 재광고" 옵션 클릭
          console.log('🔘 바로 재광고 옵션 선택 중...');
          const directReAdOption = page.locator('.radio-check.naverReAd');

          if ((await directReAdOption.count()) === 0) {
            throw new Error('바로 재광고 옵션을 찾을 수 없습니다');
          }

          // 라디오 버튼 클릭
          const radioButton = directReAdOption.locator('input[type="radio"]');
          await radioButton.click();
          await page.waitForTimeout(1500);
          console.log('✅ 바로 재광고 옵션 선택 완료');

          // 9. 두 번째 팝업 (재광고 안내 팝업) 대기
          console.log('⏳ 재광고 안내 팝업 대기 중...');
          await page.waitForSelector('.SYlayerPopupWrap.monitoring-regist-pop', { timeout: 5000 });
          console.log('✅ 재광고 안내 팝업 나타남');

          await page.waitForTimeout(1000);

          // 10. 노출종료 동의 체크박스 체크
          console.log('☑️  노출종료 동의 체크박스 체크 중...');
          const checkbox = page.locator('#popAdEndCheck');

          if ((await checkbox.count()) === 0) {
            throw new Error('노출종료 동의 체크박스를 찾을 수 없습니다');
          }

          await checkbox.check();
          await page.waitForTimeout(500);
          console.log('✅ 노출종료 동의 체크 완료');

          // 11. "바로 재광고" 버튼 클릭
          console.log('🔘 바로 재광고 버튼 클릭 중...');
          const directReAdButton = page.locator('button.register.startReAdOfferings.GTM_offerings_monitoring_my_ana_re_ad_ri[data-callback="verification"]');

          if ((await directReAdButton.count()) === 0) {
            throw new Error('바로 재광고 버튼을 찾을 수 없습니다');
          }

          await directReAdButton.click();
          console.log('✅ 바로 재광고 버튼 클릭 완료');

          // 12. 페이지 이동 대기 (결제 페이지로 이동될 것으로 예상)
          console.log('⏳ 결제 페이지 이동 대기 중...');
          await page.waitForTimeout(3000);

          break;
        }
      }

      if (!found) {
        throw new Error(`매물을 찾을 수 없습니다: ${numberN}`);
      }

      // 13. 결과 확인 (브라우저는 열어둠)
      console.log(`✅ 재광고 프로세스 완료: ${numberN}`);
      console.log('💡 브라우저를 열어둡니다. 결과를 확인한 후 수동으로 닫아주세요.');

      return {
        success: true,
        message: `재광고가 성공적으로 요청되었습니다 (${numberN})`,
      };
    } catch (error) {
      console.error('❌ 광고 내리기 테스트 오류:', error);

      // 브라우저 정리
      if (browser) {
        try {
          await browser.close();
        } catch (closeError) {
          console.error('브라우저 종료 실패:', closeError);
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * 단일 매물 가격 수정 테스트
   */
  ipcMain.handle('adTest:modifyPrice', async (_event, params: {
    numberN: string;
    modifiedPrice?: string;
    modifiedRent?: string;
  }) => {
    let browser;
    try {
      console.log(`💰 가격 수정 테스트 시작: ${params.numberN}`);
      console.log(`   수정할 가격: ${params.modifiedPrice || '없음'}`);
      console.log(`   수정할 월세: ${params.modifiedRent || '없음'}`);

      // 1. 브라우저 시작
      console.log('🌐 브라우저 시작 중...');
      browser = await chromium.launch({
        headless: false,
        channel: 'chrome',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
        ],
      });

      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });

      const page = await context.newPage();

      // 2. 이실장 로그인
      console.log('🔐 이실장 로그인 중...');
      const authService = new AipartnerAuthService();
      let session;

      try {
        // 먼저 자동 로그인 시도
        session = await authService.autoLogin(page);
        console.log('✅ 자동 로그인 성공');
      } catch (autoLoginError) {
        console.log('⚠️  자동 로그인 실패, 수동 로그인으로 전환:', autoLoginError);
        // 자동 로그인 실패 시 수동 로그인
        session = await authService.login(page);
      }

      if (!session || !session.cookies || session.cookies.length === 0) {
        throw new Error('이실장 로그인에 실패했습니다');
      }

      console.log('✅ 로그인 성공');

      // 3. AdModifyScraper로 가격 수정
      const adModifyScraper = new AdModifyScraper();
      const result = await adModifyScraper.modifyPrice(
        page,
        params.numberN,
        params.modifiedPrice,
        params.modifiedRent
      );

      if (!result.success) {
        throw new Error(result.message);
      }

      console.log(`✅ 가격 수정 완료: ${params.numberN}`);
      console.log('💡 브라우저를 열어둡니다. 결과를 확인한 후 수동으로 닫아주세요.');

      return {
        success: true,
        message: `가격 수정이 완료되었습니다 (${params.numberN})`,
        data: result,
      };
    } catch (error) {
      console.error('❌ 가격 수정 테스트 오류:', error);

      // 브라우저 정리
      if (browser) {
        try {
          await browser.close();
        } catch (closeError) {
          console.error('브라우저 종료 실패:', closeError);
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
}
