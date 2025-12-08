import { ipcMain } from 'electron';
import type { AppModule } from '../AppModule.js';
import type { ModuleContext } from '../ModuleContext.js';
import { chromium } from 'playwright';
import { AipartnerAuthService } from '../services/crawler/AipartnerAuthService.js';
import { PropertyOwnerRepository } from '../repositories/PropertyOwnerRepository.js';
import { FileStorageService } from '../services/FileStorageService.js';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { AdModifyScraper } from '../services/crawler/AdModifyScraper.js';
import { loadFont, getNamePaths } from '../utils/koreanSignature.js';

/**
 * 광고 테스트 모듈
 * 단일 광고 내리기/올리기 테스트용
 */
export class AdTestModule implements AppModule {
  constructor() {}

  async enable(_context: ModuleContext): Promise<void> {
    console.log('[AdTestModule] Initializing...');

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

    /**
     * (신)홍보확인서 파일 업로드 테스트
     * - 이실장 로그인 후 ad_list 페이지에서 대기
     * - 사용자가 수동으로 광고하기 버튼 클릭하여 verification 페이지로 이동
     * - verification 페이지 감지 시 파일 업로드 테스트 진행
     * - naverSendSave는 클릭하지 않음 (테스트 모드)
     */
    ipcMain.handle('adTest:testNewVerification', async (_event, params: {
      name: string;
      dong?: string;
      ho?: string;
    }) => {
      let browser;
      try {
        console.log(`📎 (신)홍보확인서 파일 업로드 테스트 시작`);
        console.log(`   매물: ${params.name} ${params.dong || ''}동 ${params.ho || ''}호`);

        const propertyOwnerRepo = new PropertyOwnerRepository();
        const fileStorageService = new FileStorageService();

        // 임시 다운로드 디렉토리
        const tempDir = path.join(os.tmpdir(), 'aisiljang-verification-test');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        // 1. PropertyOwner 정보 조회
        console.log('📋 매물 소유자 정보 조회 중...');
        const propertyInfo = await propertyOwnerRepo.getPropertyByKey({
          name: params.name,
          dong: params.dong,
          ho: params.ho,
        });

        if (!propertyInfo) {
          throw new Error(`매물 소유자 정보를 찾을 수 없습니다: ${params.name}`);
        }

        console.log('✅ 매물 소유자 정보 조회 완료');
        console.log(`   분양계약서: ${propertyInfo.document_file_path || '없음'}`);
        console.log(`   위임장: ${propertyInfo.power_of_attorney_file_path || '없음'}`);

        // 2. 브라우저 시작
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

        // 3. 이실장 로그인
        console.log('🔐 이실장 로그인 중...');
        const authService = new AipartnerAuthService();
        let session;

        try {
          session = await authService.autoLogin(page);
          console.log('✅ 자동 로그인 성공');
        } catch (autoLoginError) {
          console.log('⚠️  자동 로그인 실패, 수동 로그인으로 전환:', autoLoginError);
          session = await authService.login(page);
        }

        if (!session || !session.cookies || session.cookies.length === 0) {
          throw new Error('이실장 로그인에 실패했습니다');
        }

        console.log('✅ 로그인 성공');

        // 4. 광고 목록 페이지로 이동
        console.log('📍 광고 목록 페이지로 이동 중...');
        await page.goto('https://www.aipartner.com/offerings/ad_list', {
          waitUntil: 'networkidle',
          timeout: 30000,
        });
        console.log('✅ 광고 목록 페이지 로드 완료');
        console.log('');
        console.log('🔔 ========================================');
        console.log('🔔 지금 수동으로 광고하기 버튼을 클릭해주세요!');
        console.log('🔔 verification 페이지로 이동하면 자동으로');
        console.log('🔔 파일 업로드 테스트가 시작됩니다.');
        console.log('🔔 ========================================');
        console.log('');

        // 5. verification 페이지 이동 대기 (최대 5분)
        console.log('⏳ verification 페이지 이동 대기 중... (최대 5분)');
        await page.waitForFunction(
          () => location.href.includes('/offerings/verification/'),
          { timeout: 300000, polling: 1000 }
        );
        console.log('✅ verification 페이지 감지!');

        await page.waitForTimeout(2000);

        // 6. 파일 업로드 테스트
        const uploadedFiles: string[] = [];

        // 분양계약서/사업자등록증 업로드
        if (propertyInfo.document_file_path) {
          console.log('📄 분양계약서/사업자등록증 다운로드 중...');
          const localPath = path.join(tempDir, `document_${Date.now()}${path.extname(propertyInfo.document_file_path)}`);
          await fileStorageService.downloadFile(propertyInfo.document_file_path, localPath);
          console.log(`✅ 다운로드 완료: ${localPath}`);

          // 파일첨부 라벨 클릭하여 파일 선택 다이얼로그 열기 + 파일 설정
          console.log('📎 파일첨부 버튼 클릭 및 파일 설정 중...');
          const fileLabel = page.locator('label[for="fileReferenceFileUrl1"]');

          if (await fileLabel.count() === 0) {
            throw new Error('파일첨부 라벨을 찾을 수 없습니다 (fileReferenceFileUrl1)');
          }

          // filechooser 이벤트 대기하면서 라벨 클릭
          const [fileChooser] = await Promise.all([
            page.waitForEvent('filechooser', { timeout: 5000 }),
            fileLabel.click(),
          ]);

          // 파일 선택
          await fileChooser.setFiles(localPath);
          console.log('✅ 분양계약서/사업자등록증 업로드 완료');
          uploadedFiles.push(localPath);
          await page.waitForTimeout(1000);
        } else {
          console.log('⚠️  분양계약서/사업자등록증 파일이 없습니다');
        }

        // 위임장 업로드
        if (propertyInfo.power_of_attorney_file_path) {
          console.log('📄 위임장 다운로드 중...');
          const localPath = path.join(tempDir, `power_of_attorney_${Date.now()}${path.extname(propertyInfo.power_of_attorney_file_path)}`);
          await fileStorageService.downloadFile(propertyInfo.power_of_attorney_file_path, localPath);
          console.log(`✅ 다운로드 완료: ${localPath}`);

          // 파일첨부 라벨 클릭하여 파일 선택 다이얼로그 열기 + 파일 설정
          console.log('📎 위임장 파일첨부 버튼 클릭 및 파일 설정 중...');
          const fileLabel = page.locator('label[for="fileReferenceFileUrl2"]');

          if (await fileLabel.count() === 0) {
            console.log('⚠️  위임장 파일첨부 라벨을 찾을 수 없습니다 (fileReferenceFileUrl2)');
          } else {
            // filechooser 이벤트 대기하면서 라벨 클릭
            const [fileChooser] = await Promise.all([
              page.waitForEvent('filechooser', { timeout: 5000 }),
              fileLabel.click(),
            ]);

            // 파일 선택
            await fileChooser.setFiles(localPath);
            console.log('✅ 위임장 업로드 완료');
            uploadedFiles.push(localPath);
            await page.waitForTimeout(1000);
          }
        } else {
          console.log('ℹ️  위임장 파일이 없습니다 (선택사항)');
        }

        console.log('');
        console.log('✅ ========================================');
        console.log('✅ 파일 업로드 테스트 완료!');
        console.log('✅ naverSendSave 버튼은 클릭하지 않았습니다.');
        console.log('✅ 브라우저에서 결과를 확인해주세요.');
        console.log('✅ ========================================');

        // 임시 파일 정리
        for (const filePath of uploadedFiles) {
          try {
            fs.unlinkSync(filePath);
            console.log(`🗑️  임시 파일 삭제: ${filePath}`);
          } catch (err) {
            console.warn(`⚠️  임시 파일 삭제 실패: ${filePath}`);
          }
        }

        return {
          success: true,
          message: '(신)홍보확인서 파일 업로드 테스트 완료',
        };
      } catch (error) {
        console.error('❌ (신)홍보확인서 테스트 오류:', error);

        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    /**
     * (구)홍보확인서 전자 서명 테스트
     * - 이실장 로그인 후 ad_list 페이지에서 대기
     * - 사용자가 수동으로 광고하기 버튼 클릭하여 verification 페이지로 이동
     * - verification 페이지 감지 시 전자 서명 테스트 진행
     * - 최종 제출 버튼은 클릭하지 않음 (테스트 모드)
     */
    ipcMain.handle('adTest:testOldVerification', async () => {
      let browser;
      try {
        console.log(`📎 (구)홍보확인서 전자 서명 테스트 시작`);

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
          session = await authService.autoLogin(page);
          console.log('✅ 자동 로그인 성공');
        } catch (autoLoginError) {
          console.log('⚠️  자동 로그인 실패, 수동 로그인으로 전환:', autoLoginError);
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
        console.log('');
        console.log('🔔 ========================================');
        console.log('🔔 지금 수동으로 광고하기 버튼을 클릭해주세요!');
        console.log('🔔 (구)홍보확인서 매물을 선택하세요.');
        console.log('🔔 verification 페이지로 이동하면 자동으로');
        console.log('🔔 전자 서명 테스트가 시작됩니다.');
        console.log('🔔 ========================================');
        console.log('');

        // 4. verification 페이지 이동 대기 (최대 5분)
        console.log('⏳ verification 페이지 이동 대기 중... (최대 5분)');
        await page.waitForFunction(
          () => location.href.includes('/offerings/verification/'),
          { timeout: 300000, polling: 1000 }
        );
        console.log('✅ verification 페이지 감지!');

        await page.waitForTimeout(2000);

        // 5. (구)홍보확인서 전자 서명 테스트
        console.log('📎 (구)홍보확인서 - 전자 홍보확인서 작성 시작...');

        // 5-0. 소유자명 미리 읽어두기 (나중에 typingOname에 입력해야 함)
        let ownerName = '';
        const inputOname = page.locator('input#inputOname');
        if (await inputOname.count() > 0) {
          ownerName = await inputOname.inputValue();
          console.log(`📋 소유자명 복사: "${ownerName}"`);
        }

        // 5-1. 전자 홍보확인서 작성하기 라벨 클릭 (팝업 열기)
        const elecConfirmLabel = page.locator('label[for="elecConfirmdocUrl"]');
        if (await elecConfirmLabel.count() > 0) {
          await elecConfirmLabel.click();
          console.log('✅ 전자 홍보확인서 팝업 열기 완료');
          await page.waitForTimeout(1500);
        } else {
          throw new Error('전자 홍보확인서 작성 라벨을 찾을 수 없습니다 (label[for="elecConfirmdocUrl"])');
        }

        // 5-2. 팝업 내 "작성하기" 버튼 클릭
        const elecSendStartButton = page.locator('button#elecSendStart');
        if (await elecSendStartButton.count() > 0) {
          await elecSendStartButton.click();
          console.log('✅ 전자 홍보확인서 "작성하기" 버튼 클릭 완료');
          await page.waitForTimeout(2000);
        } else {
          throw new Error('"작성하기" 버튼을 찾을 수 없습니다 (#elecSendStart)');
        }

        // 5-3. Canvas에 체크 표시 그리기 (첫 번째 서명)
        const canvas = page.locator('canvas#canvasSignature');
        if (await canvas.count() > 0) {
          console.log('📝 Canvas에 체크 표시 그리기 시작 (1/2)...');

          const box = await canvas.boundingBox();
          if (box) {
            // Canvas 중앙에 체크 표시 그리기
            const centerX = box.x + box.width / 2;
            const centerY = box.y + box.height / 2;

            // 체크 표시(✓) 그리기 - 중앙 기준, 1.3배 크기 + 자연스러운 오차
            const checkSize = 30 * 1.3;  // 39
            const widthRatio = 1.3;
            const jitter = () => (Math.random() - 0.5) * 6;  // -3 ~ +3 픽셀 오차
            const startX = centerX - checkSize * widthRatio / 2 + jitter();
            const startY = centerY + jitter();
            const midX = centerX - checkSize / 6 + jitter();
            const midY = centerY + checkSize / 2 + jitter();
            const endX = centerX + checkSize * widthRatio / 2 + jitter();
            const endY = centerY - checkSize / 2 + jitter();

            await page.mouse.move(startX, startY);
            await page.mouse.down();
            await page.mouse.move(midX, midY, { steps: 5 });
            await page.mouse.move(endX, endY, { steps: 5 });
            await page.mouse.up();

            console.log(`✅ 첫 번째 체크 표시 그리기 완료 (중앙: ${centerX}, ${centerY})`);
            await page.waitForTimeout(500);

            // 5-4. "다음" 버튼 클릭 (onclick="saveImg()" 있는 버튼)
            const nextButton = page.locator('button.next[onclick="saveImg();"]');
            if (await nextButton.count() > 0) {
              await nextButton.click();
              console.log('✅ "다음" 버튼 클릭 완료');
              await page.waitForTimeout(1500);
            }

            // 5-5. 소유자명 입력 (typingOname) - 다음 버튼 클릭 후 바로 입력
            console.log(`📋 저장된 소유자명: "${ownerName}" (길이: ${ownerName.length})`);
            const typingOname = page.locator('input#typingOname');
            const typingOnameCount = await typingOname.count();
            console.log(`📋 typingOname 요소 개수: ${typingOnameCount}`);

            if (typingOnameCount > 0 && ownerName) {
              await typingOname.fill(ownerName);
              console.log(`✅ 소유자명 입력 완료: "${ownerName}"`);
              await page.waitForTimeout(500);
            } else {
              console.log(`⚠️ 소유자명 입력 스킵 - 요소없음: ${typingOnameCount === 0}, 소유자명없음: ${!ownerName}`);
            }

            // 5-5-1. "다음 (2/3)" 버튼 클릭 (onclick="saveImg(true)" 있는 버튼)
            const nextButton2of3 = page.locator('button.next[onclick="saveImg(true);"]');
            if (await nextButton2of3.count() > 0) {
              await nextButton2of3.click();
              console.log('✅ "다음 (2/3)" 버튼 클릭 완료');
              await page.waitForTimeout(1500);
            }

            // 5-6. 두 번째 서명 (3/3) - 소유자명 필기 서명
            console.log('📝 두 번째 Canvas 대기 중...');
            const canvas2 = page.locator('canvas#canvasSignature');
            await canvas2.waitFor({ state: 'visible', timeout: 10000 });
            await page.waitForTimeout(500);

            const canvas2Count = await canvas2.count();
            console.log(`📝 Canvas에 소유자명 서명 그리기 시작... (canvas2 개수: ${canvas2Count})`);

            if (canvas2Count > 0 && ownerName) {
              const box2 = await canvas2.boundingBox();
              if (box2) {
                // 폰트 로드 및 경로 추출
                await loadFont();
                const strokes = getNamePaths(ownerName, box2.width, box2.height);

                console.log(`✏️ 소유자명 "${ownerName}" 서명 중... (${strokes.length}개 획)`);

                // 각 획을 마우스로 그리기
                for (const stroke of strokes) {
                  if (stroke.length < 2) continue;

                  // 첫 점으로 이동
                  const first = stroke[0];
                  await page.mouse.move(box2.x + first.x, box2.y + first.y);
                  await page.mouse.down();

                  // 나머지 점들 따라 그리기
                  for (let i = 1; i < stroke.length; i++) {
                    const pt = stroke[i];
                    await page.mouse.move(box2.x + pt.x, box2.y + pt.y, { steps: 2 });
                  }

                  await page.mouse.up();
                  await page.waitForTimeout(30); // 획 사이 짧은 딜레이
                }

                console.log(`✅ 소유자명 서명 완료: "${ownerName}"`);
                await page.waitForTimeout(500);
              }

              // "다음" 버튼 클릭 (onclick="saveImg()" 있는 버튼) - 테스트용으로 비활성화
              // const nextButton2 = page.locator('button.next[onclick="saveImg();"]');
              // if (await nextButton2.count() > 0) {
              //   await nextButton2.click();
              //   console.log('✅ "다음 (3/3)" 버튼 클릭 완료');
              //   await page.waitForTimeout(1500);
              // }
              console.log('⏸️ "다음 (3/3)" 버튼 클릭 생략 (테스트 모드)');
            }
          }
        } else {
          throw new Error('Canvas를 찾을 수 없습니다 (#canvasSignature)');
        }

        console.log('');
        console.log('✅ ========================================');
        console.log('✅ (구)홍보확인서 전자 서명 테스트 완료!');
        console.log('✅ 최종 제출 버튼은 클릭하지 않았습니다.');
        console.log('✅ 브라우저에서 결과를 확인해주세요.');
        console.log('✅ ========================================');

        return {
          success: true,
          message: '(구)홍보확인서 전자 서명 테스트 완료',
        };
      } catch (error) {
        console.error('❌ (구)홍보확인서 테스트 오류:', error);

        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    console.log('[AdTestModule] AdTest handlers registered');
  }
}
