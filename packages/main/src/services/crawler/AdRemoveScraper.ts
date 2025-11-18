import type { Page } from 'playwright';
import type { AipartnerOffer } from '../../types/index.js';
import { PropertyOwnerRepository } from '../../repositories/PropertyOwnerRepository.js';
import { FileStorageService } from '../FileStorageService.js';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

/**
 * 광고 내리기 스크래퍼
 *
 * 이실장 사이트에서 특정 매물의 광고를 내리는 작업을 수행합니다.
 */
export class AdRemoveScraper {
  private propertyOwnerRepo: PropertyOwnerRepository;
  private fileStorageService: FileStorageService;

  constructor() {
    this.propertyOwnerRepo = new PropertyOwnerRepository();
    this.fileStorageService = new FileStorageService();
  }

  /**
   * 임시 다운로드 디렉토리 생성
   */
  private getTempDownloadDir(): string {
    const tempDir = path.join(os.tmpdir(), 'aisiljang-verification-files');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    return tempDir;
  }
  /**
   * 지연 함수
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 팝업 닫기 ("오늘 하루 보지 않기" 체크박스 클릭)
   */
  private async closeNoticePopup(page: Page): Promise<void> {
    try {
      // 짧은 대기 시간 (팝업이 완전히 렌더링될 때까지)
      await this.delay(1000);

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
            await this.delay(500);

            console.log(`✅ ${i + 1}번째 팝업 닫기 완료 (오늘 하루 보지 않기 설정)`);
          } else {
            // 체크박스가 없으면 cancel 버튼으로 폴백
            console.log(`⚠️  체크박스가 없어서 cancel 버튼 사용`);
            const cancelButton = popup.locator('button.cancel');
            if (await cancelButton.count() > 0) {
              await cancelButton.first().waitFor({ state: 'visible', timeout: 5000 });
              await cancelButton.first().click({ force: true });
              await this.delay(500);
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
   * 단일 매물의 광고 내리기 (재광고)
   *
   * 가격은 이실장 사이트에서 미리 수정된 상태이므로 "바로 재광고" 모드만 사용
   *
   * @param page Playwright 페이지 객체
   * @param offer 광고를 내릴 매물 정보
   * @returns 성공 여부
   */
  async removeAd(
    page: Page,
    offer: AipartnerOffer
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`🔽 광고 내리기 시작: ${offer.name} (numberN: ${offer.numberN})`);

      // 1. 광고 관리 페이지는 이미 로그인 시 이동했으므로 생략
      // 현재 페이지가 광고 리스트 페이지인지 확인
      
      const currentUrl = page.url();
      if (!currentUrl.includes('/offerings/ad_list')) {
        console.log('📍 광고 관리 페이지로 이동 중...');
        await page.goto('https://www.aipartner.com/offerings/ad_list', {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        });
      } else {
        console.log('✅ 이미 광고 관리 페이지에 있습니다');
      }

      // 광고중 버튼 대기
      await page.waitForSelector(
        '#wrap > div > div > div > div.sectionWrap > div.statusWrap.ver3 > div.statusItem.statusIng.GTM_offerings_ad_list_ad_ing',
        { timeout: 30000 }
      );
        await page.click(
      '#wrap > div > div > div > div.sectionWrap > div.statusWrap.ver3 > div.statusItem.statusIng.GTM_offerings_ad_list_ad_ing'
    );


      await page.waitForLoadState('networkidle');

      await this.delay(2000);

      // 2. 페이지네이션을 통해 매물 찾기
      let isFound = false;
      let maxPages = 20; // 최대 20페이지까지만 검색
      let currentPage = 0;

      while (!isFound && currentPage < maxPages) {
        currentPage++;
        console.log(`📄 페이지 ${currentPage} 검색 중...`);

        // 페이지네이션 로드 대기
        await page.waitForSelector('div.pagination a.btnPage.on', { timeout: 10000 });

        // 매물 행들 가져오기
        const rows = await page.locator(
          '#wrap > div > div > div > div.sectionWrap > div.singleSection.listSection > div.listWrap > table > tbody > tr'
        ).all();

        console.log(`📊 현재 페이지에 ${rows.length}개 매물`);

        // 각 행을 순회하면서 numberN 확인
        for (const row of rows) {
          const numberNElement = row.locator('td .numberN');
          const numberText = await numberNElement.textContent();
          const cleanedNumber = numberText?.replace(/\D/g, '').trim();

          if (cleanedNumber === offer.numberN) {
            console.log(`✅ 매물 발견: ${cleanedNumber}`);
            console.log(`📋 "바로 재광고" 모드 사용 (가격은 이미 수정된 상태)`);

            // 재광고 버튼 찾기 및 클릭
            const reAdButton = row.locator('.management.GTM_offerings_ad_list_rocket_add.btn-re-ad-pop');

            if (await reAdButton.count() === 0) {
              throw new Error('재광고 버튼을 찾을 수 없습니다');
            }

            console.log('🔘 재광고 버튼 클릭 중...');
            await reAdButton.click();
            await this.delay(1000);

            // 첫 번째 팝업 대기 (.wrap-pop-tooltip.pop-re-ad.active)
            console.log('⏳ 재광고 선택 팝업 (1차) 대기 중...');
            await page.waitForSelector('.wrap-pop-tooltip.pop-re-ad.active', { timeout: 5000 });
            console.log('✅ 재광고 선택 팝업 (1차) 나타남');

            await this.delay(500);

            // 활성화된 팝업 안에서 "바로 재광고" 라디오 버튼 선택
            console.log('🔘 "바로 재광고" 라디오 버튼 선택 중...');
            const activePopup = page.locator('.wrap-pop-tooltip.pop-re-ad.active');
            const directReAdRadio = activePopup.locator('.radio-check.naverReAd input[type="radio"]#reAd2');

            if (await directReAdRadio.count() === 0) {
              throw new Error('활성화된 팝업에서 바로 재광고 라디오 버튼을 찾을 수 없습니다');
            }

            await directReAdRadio.click();
            await this.delay(1500);
            console.log('✅ "바로 재광고" 라디오 버튼 선택 완료');

            // 두 번째 팝업 대기 (.SYlayerPopupWrap.monitoring-regist-pop)
            console.log('⏳ 재광고 안내 팝업 (2차) 대기 중...');
            await page.waitForSelector('.SYlayerPopupWrap.monitoring-regist-pop', { timeout: 5000 });
            console.log('✅ 재광고 안내 팝업 (2차) 나타남');

            await this.delay(1000);

            // 재광고 안내 팝업 안에서 노출종료 동의 체크박스 라벨 클릭
            console.log('☑️  노출종료 동의 체크박스 라벨 클릭 중...');
            const secondPopup = page.locator('.SYlayerPopupWrap.monitoring-regist-pop');
            const checkboxLabel = secondPopup.locator('label[for="popAdEndCheck"]');

            if (await checkboxLabel.count() === 0) {
              throw new Error('재광고 안내 팝업에서 노출종료 동의 체크박스 라벨을 찾을 수 없습니다');
            }

            await checkboxLabel.click();
            await this.delay(500);
            console.log('✅ 노출종료 동의 체크박스 라벨 클릭 완료');

            // alert 다이얼로그 핸들러 설정 (버튼 클릭 후 alert가 뜸)
            const alertPromise = new Promise<boolean>((resolve) => {
              const timeoutId = setTimeout(() => {
                console.log('⚠️  alert 다이얼로그 대기 타임아웃');
                page.off('dialog', handler);
                resolve(false);
              }, 10000);

              const handler = async (dialog: any) => {
                // 즉시 핸들러 제거 (중복 처리 방지)
                page.off('dialog', handler);
                clearTimeout(timeoutId);

                const message = dialog.message();
                console.log(`📢 Alert 다이얼로그: ${message}`);

                try {
                  if (message.includes('노출종료가 진행됩니다') || message.includes('복구는 불가능합니다')) {
                    console.log('☑️  확인 버튼 클릭 중...');
                    await dialog.accept();
                    console.log('✅ Alert 확인 완료');
                    resolve(true);
                  } else {
                    console.log('❌ 예상치 못한 다이얼로그');
                    await dialog.dismiss();
                    resolve(false);
                  }
                } catch (error) {
                  console.log('⚠️  다이얼로그 처리 중 에러:', error);
                  resolve(false);
                }
              };
              page.on('dialog', handler);
            });

            // "바로 재광고" 버튼 클릭
            console.log('🔘 "바로 재광고" 버튼 클릭 중...');
            const directReAdButton = page.locator('button.register.startReAdOfferings.GTM_offerings_monitoring_my_ana_re_ad_ri[data-callback="verification"]');

            if (await directReAdButton.count() === 0) {
              throw new Error('바로 재광고 버튼을 찾을 수 없습니다');
            }

            await directReAdButton.click();
            console.log('✅ "바로 재광고" 버튼 클릭 완료');

            // alert 확인 대기
            const alertConfirmed = await alertPromise;
            if (!alertConfirmed) {
              throw new Error('노출종료 확인 alert가 나타나지 않았거나 확인에 실패했습니다');
            }

            // verification 페이지로 바로 이동
            console.log('⏳ verification 페이지 이동 대기 중...');
            await page.waitForFunction(
              () => location.href.includes('/offerings/verification/'),
              { timeout: 60000, polling: 500 }
            );
            console.log('✅ verification 페이지 이동 완료');
            await this.delay(2000);

            // (신)홍보확인서인 경우 파일 업로드
            if (offer.adMethod && offer.adMethod.includes('(신)홍보확인서')) {
              console.log('📎 (신)홍보확인서 파일 업로드 시작...');

              try {
                // 1. PropertyOwnerRepository에서 파일 경로 조회
                const propertyInfo = await this.propertyOwnerRepo.getPropertyByKey({
                  name: offer.name,
                  dong: offer.dong || undefined,
                  ho: offer.ho || undefined,
                });

                if (!propertyInfo) {
                  throw new Error(`매물 정보를 찾을 수 없습니다: ${offer.name}`);
                }

                const tempDir = this.getTempDownloadDir();
                const uploadedFiles: string[] = [];

                // 2. 분양계약서/사업자등록증 (document_file_path) - 필수
                if (propertyInfo.document_file_path) {
                  console.log('📄 분양계약서/사업자등록증 다운로드 중...');
                  const localPath = path.join(tempDir, `document_${Date.now()}${path.extname(propertyInfo.document_file_path)}`);
                  await this.fileStorageService.downloadFile(propertyInfo.document_file_path, localPath);

                  // 라디오 버튼 선택 (fileReferenceFileType11)
                  const documentRadio = page.locator('label[for="fileReferenceFileType11"]');
                  if (await documentRadio.count() > 0) {
                    await documentRadio.click();
                    await this.delay(300);
                  }

                  // 파일 업로드
                  const documentInput = page.locator('input#fileReferenceFileUrl1');
                  await documentInput.setInputFiles(localPath);
                  console.log('✅ 분양계약서/사업자등록증 업로드 완료');
                  uploadedFiles.push(localPath);
                }

                // 3. 위임장 (power_of_attorney_file_path) - 선택
                if (propertyInfo.power_of_attorney_file_path) {
                  console.log('📄 위임장 다운로드 중...');
                  const localPath = path.join(tempDir, `power_of_attorney_${Date.now()}${path.extname(propertyInfo.power_of_attorney_file_path)}`);
                  await this.fileStorageService.downloadFile(propertyInfo.power_of_attorney_file_path, localPath);

                  // 라디오 버튼 선택 (fileReferenceFileType21)
                  const poaRadio = page.locator('label[for="fileReferenceFileType21"]');
                  if (await poaRadio.count() > 0) {
                    await poaRadio.click();
                    await this.delay(300);
                  }

                  // 파일 업로드
                  const poaInput = page.locator('input#fileReferenceFileUrl2');
                  await poaInput.setInputFiles(localPath);
                  console.log('✅ 위임장 업로드 완료');
                  uploadedFiles.push(localPath);
                }

                // 4. 등기부등본 (register_file_path) - 선택
                if (propertyInfo.register_file_path) {
                  console.log('📄 등기부등본 다운로드 중...');
                  const localPath = path.join(tempDir, `register_${Date.now()}${path.extname(propertyInfo.register_file_path)}`);
                  await this.fileStorageService.downloadFile(propertyInfo.register_file_path, localPath);

                  // 라디오 버튼 선택 (fileRegisterUrlImgType1)
                  const registerRadio = page.locator('label[for="fileRegisterUrlImgType1"]');
                  if (await registerRadio.count() > 0) {
                    await registerRadio.click();
                    await this.delay(300);
                  }

                  // 파일 업로드
                  const registerInput = page.locator('input#fileRegisterUrl');
                  await registerInput.setInputFiles(localPath);
                  console.log('✅ 등기부등본 업로드 완료');
                  uploadedFiles.push(localPath);
                }

                console.log('✅ (신)홍보확인서 파일 업로드 완료');

                // 임시 파일 정리
                for (const filePath of uploadedFiles) {
                  try {
                    fs.unlinkSync(filePath);
                  } catch (err) {
                    console.warn(`⚠️ 임시 파일 삭제 실패: ${filePath}`);
                  }
                }
              } catch (error) {
                console.error('❌ 파일 업로드 실패:', error);
                throw error;
              }
            }

            // 이후 공통 프로세스 (verification 페이지에서 진행)
            // consentMobile2 체크박스 클릭
            console.log('☑️  consentMobile2 체크박스 대기 중...');
            await page.waitForSelector('label[for="consentMobile2"]', { timeout: 10000 });

            const consentLabel = page.locator('label[for="consentMobile2"]');
            if (await consentLabel.count() > 0) {
              await consentLabel.scrollIntoViewIfNeeded();
              await this.delay(500);
              await consentLabel.click();
              console.log('✅ consentMobile2 클릭 완료');
            } else {
              throw new Error('consentMobile2 버튼을 찾을 수 없습니다');
            }

            // payMsg 요소로 스크롤
            const payMsg = page.locator('#payMsg');
            if (await payMsg.count() > 0) {
              await payMsg.scrollIntoViewIfNeeded();
              await this.delay(1000);
            }

            // naverSendSave 버튼 클릭
            console.log('💾 naverSendSave 버튼 대기 중...');
            await page.waitForSelector('#naverSendSave', { timeout: 10000 });

            const naverSaveBtn = page.locator('#naverSendSave');
            await naverSaveBtn.scrollIntoViewIfNeeded();
            await this.delay(500);

            // 저장 확인 다이얼로그 핸들러 - adMethod에 따라 다른 메시지 확인
            const expectedMessage = offer.adMethod && offer.adMethod.includes('(신)홍보확인서')
              ? '홍보확인이 접수'
              : '로켓전송이 완료';

            const dialogPromise = new Promise<boolean>((resolve) => {
              const timeoutId = setTimeout(() => {
                console.log('⚠️  다이얼로그 대기 타임아웃');
                page.off('dialog', handler);
                resolve(false);
              }, 10000);

              const handler = async (dialog: any) => {
                clearTimeout(timeoutId);
                const message = dialog.message();
                console.log(`📢 다이얼로그: ${message}`);

                if (message.includes(expectedMessage)) {
                  console.log('☑️  확인 버튼 클릭 중...');
                  await this.delay(500);
                  await dialog.accept();
                  console.log('✅ 확인 완료');
                  page.off('dialog', handler);
                  resolve(true);
                } else {
                  console.log('❌ 다이얼로그 취소');
                  await dialog.dismiss();
                  page.off('dialog', handler);
                  resolve(false);
                }
              };
              page.on('dialog', handler);
            });

            await naverSaveBtn.click();
            console.log('🔘 naverSendSave 버튼 클릭 완료, 다이얼로그 대기 중...');

            const saved = await dialogPromise;
            if (!saved) {
              throw new Error('저장 확인 다이얼로그가 나타나지 않았거나 거부되었습니다');
            }

            // verify 페이지 대기
            console.log('📄 verify 페이지 이동 대기 중...');
            await page.waitForFunction(
              () => location.href.includes('/offerings/verify/'),
              { timeout: 60000, polling: 500 }
            );
            console.log('🟢 verify 페이지로 이동 완료');

            await this.delay(2000);

            // 취소 버튼 클릭해서 ad_list로 돌아가기
            await page.waitForSelector('#btnCancel');
            const cancelBtn = page.locator('#btnCancel');
            await cancelBtn.scrollIntoViewIfNeeded();
            await this.delay(2000);

            await cancelBtn.click();

            // ad_list 페이지 대기
            await page.waitForFunction(
              () => location.href.includes('/offerings/ad_list'),
              { timeout: 60000, polling: 500 }
            );

            await this.delay(2000);

            const currentUrl = page.url();
            if (currentUrl.startsWith('https://www.aipartner.com/offerings/ad_list')) {
              console.log('✅ ad_list 페이지로 이동 완료');
            } else {
              throw new Error('❌ ad_list 페이지로 이동 실패');
            }

            console.log(`✅ 재광고 완료: ${offer.name}`);
            isFound = true;
            break;
          }
        }

        if (isFound) break;

        // 다음 페이지로 이동
        await page.waitForSelector('div.pagination a.btnArrow.next', { timeout: 5000 });
        await page.waitForSelector('div.pagination a.btnPage.on', { timeout: 5000 });
        await this.delay(2000);

        const nextValue = await page.locator('div.pagination a.btnArrow.next').getAttribute('data-value');
        const currentValue = await page.locator('div.pagination a.btnPage.on').getAttribute('data-value');

        if (nextValue === currentValue) {
          console.log('✅ 마지막 페이지 도달');
          break;
        }

        // 다음 페이지 버튼 클릭
        const nextButton = page.locator('div.pagination a.btnArrow.next');
        if (await nextButton.count() > 0) {
          await nextButton.scrollIntoViewIfNeeded();
          await nextButton.click();
          await this.delay(1000);
        } else {
          console.log('❌ 다음 페이지 버튼이 없습니다');
          break;
        }
      }

      if (!isFound) {
        throw new Error(`매물을 찾을 수 없습니다: ${offer.numberN}`);
      }

      return {
        success: true,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ 광고 내리기 실패: ${offer.name}`, errorMessage);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * 여러 매물의 광고를 순차적으로 내리고 재등록하기
   *
   * @param page Playwright 페이지 객체
   * @param offers 광고를 내릴 매물 목록
   * @param onProgress 진행 상황 콜백
   * @returns 결과 목록
   */
  async removeAdsInBatch(
    page: Page,
    offers: AipartnerOffer[],
    onProgress?: (current: number, total: number, offer: AipartnerOffer, result: { success: boolean; error?: string }) => void
  ): Promise<Array<{ offer: AipartnerOffer; success: boolean; error?: string }>> {
    const results: Array<{ offer: AipartnerOffer; success: boolean; error?: string }> = [];

    console.log(`📦 총 ${offers.length}개 매물의 재광고를 진행합니다`);

    // 배치 시작 전 팝업 닫기 (한 번만)
    await this.closeNoticePopup(page);

    for (let i = 0; i < offers.length; i++) {
      const offer = offers[i];
      console.log(`\n[${i + 1}/${offers.length}] 처리 중...`);

      const result = await this.removeAd(page, offer);
      results.push({
        offer,
        ...result,
      });

      if (onProgress) {
        onProgress(i + 1, offers.length, offer, result);
      }

      // 요청 사이 간격 (서버 부하 방지)
      if (i < offers.length - 1) {
        const delay = 2000 + Math.random() * 1000; // 2~3초 랜덤 대기
        console.log(`⏳ ${delay.toFixed(0)}ms 대기 중...`);
        await this.delay(delay);
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`\n📊 재광고 완료: 성공 ${successCount}건, 실패 ${failCount}건`);

    return results;
  }
}
