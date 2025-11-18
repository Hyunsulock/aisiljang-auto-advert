import type { Page } from 'playwright';
import type { AipartnerOffer } from '../../types/index.js';
import { FileStorageService } from '../FileStorageService.js';
import { app } from 'electron';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';

/**
 * 광고 올리기 스크래퍼
 *
 * 이실장 사이트에서 "광고 종료" 상태의 매물을 다시 광고 등록하는 작업을 수행합니다.
 */
export class AdUploadScraper {
  private fileStorageService: FileStorageService;

  constructor() {
    this.fileStorageService = new FileStorageService();
  }

  /**
   * 지연 함수
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 임시 다운로드 디렉토리 경로 반환
   */
  private getTempDownloadDir(): string {
    const tempDir = app.isPackaged
      ? join(app.getPath('userData'), 'temp_downloads')
      : join(process.cwd(), 'temp_downloads');

    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true });
    }

    return tempDir;
  }

  /**
   * 단일 매물의 광고 올리기
   *
   * @param page Playwright 페이지 객체
   * @param offer 광고를 올릴 매물 정보
   * @param modifiedPrice 수정할 가격 (선택사항)
   * @param modifiedRent 수정할 월세 (선택사항)
   * @param verificationFiles (신)홍보확인서 파일들 (선택사항)
   * @returns 성공 여부
   */
  async uploadAd(
    page: Page,
    offer: AipartnerOffer,
    modifiedPrice?: string,
    modifiedRent?: string,
    verificationFiles?: {
      documentFilePath?: string; // 서류 첨부 파일 (Supabase Storage 경로)
      powerOfAttorneyFilePath?: string; // 위임장 파일 (Supabase Storage 경로)
      registerFilePath?: string; // 등기부등본 파일 (Supabase Storage 경로)
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`🔼 광고 올리기 시작: ${offer.name} (numberN: ${offer.numberN})`);

      // 1. "광고 종료" 탭 클릭
      console.log('📍 광고 종료 탭으로 이동 중...');
      const endAdTab = page.locator(
        '#wrap > div > div > div > div.sectionWrap > div.statusWrap.ver3 > div.statusItem.statusAdEnd.GTM_offerings_ad_list_end_ad'
      );

      if (await endAdTab.count() > 0) {
        await endAdTab.click();
        await this.delay(2000);
      } else {
        throw new Error('광고 종료 탭을 찾을 수 없습니다');
      }

      // 2. 페이지네이션을 통해 매물 찾기
      let isFound = false;
      let maxPages = 20;
      let currentPage = 0;

      while (!isFound && currentPage < maxPages) {
        currentPage++;
        console.log(`📄 페이지 ${currentPage} 검색 중...`);

        // 테이블 로드 대기
        await page.waitForSelector('table > tbody > tr', { timeout: 5000 });

        // 매물 행들 가져오기
        const rows = await page.locator(
          '#wrap > div > div > div > div.sectionWrap > div.singleSection.listSection > div.listWrap > table > tbody > tr'
        ).all();

        console.log(`📊 현재 페이지에 ${rows.length}개 매물`);

        // 각 행을 순회하면서 numberN 확인
        for (const row of rows) {
          const numberNElement = row.locator('.numberN');
          const numberText = await numberNElement.textContent();
          const cleanedNumber = numberText?.replace(/\D/g, '').trim();

          if (cleanedNumber === offer.numberN) {
            console.log(`✅ 매물 발견: ${cleanedNumber}`);

            // 재등록 버튼 찾기
            const reAdButton = row.locator('a.management.GTM_offerings_ad_list_listing_adre');

            if (await reAdButton.count() === 0) {
              throw new Error('재등록 버튼을 찾을 수 없습니다');
            }

            // 재등록 버튼 클릭 (페이지 이동 발생)
            console.log('🔘 재등록 버튼 클릭 중...');
            await Promise.all([
              page.waitForURL('**/offerings/ad_regist**', { timeout: 30000 }),
              reAdButton.click(),
            ]);

            console.log('✅ 광고 등록 페이지로 이동 완료');
            isFound = true;
            break;
          }
        }

        if (isFound) break;

        // 다음 페이지로 이동
        const nextButton = page.locator('div.pagination a.btnArrow.next');
        const currentButton = page.locator('div.pagination a.btnPage.on');

        if (await nextButton.count() === 0 || await currentButton.count() === 0) {
          console.log('❌ 페이지네이션 버튼이 없습니다');
          break;
        }

        const nextValue = await nextButton.getAttribute('data-value');
        const currentValue = await currentButton.getAttribute('data-value');

        if (nextValue === currentValue) {
          console.log('✅ 마지막 페이지 도달');
          break;
        }

        // 다음 페이지 버튼 클릭
        await nextButton.scrollIntoViewIfNeeded();
        await nextButton.click();
        await this.delay(1000);
      }

      if (!isFound) {
        throw new Error(`매물을 찾을 수 없습니다: ${offer.numberN}`);
      }

      // 3. 광고 등록 페이지에서 작업
      console.log('📝 광고 등록 페이지 작업 중...');

      // 페이지 로드 대기
      await page.waitForSelector('#offeringsAdSave', { timeout: 30000 });

      // 가격 수정 (필요시)
      if (modifiedPrice) {
        console.log(`💰 가격 수정: ${offer.price} → ${modifiedPrice}`);
        const priceInput = page.locator('input[name="price"], #price');
        if (await priceInput.count() > 0) {
          await priceInput.fill(modifiedPrice);
          console.log('✅ 가격 수정 완료');
        }
      }

      // 월세 수정 (필요시)
      if (modifiedRent) {
        console.log(`💰 월세 수정: ${offer.rent} → ${modifiedRent}`);
        const rentInput = page.locator('input[name="rent"], #rent');
        if (await rentInput.count() > 0) {
          await rentInput.fill(modifiedRent);
          console.log('✅ 월세 수정 완료');
        }
      }

      // 4. 저장 버튼 클릭 (verification 페이지로 이동)
      console.log('💾 저장 버튼 클릭 중...');
      const saveButton = page.locator('#offeringsAdSave');
      await saveButton.scrollIntoViewIfNeeded();
      await this.delay(500);
      await saveButton.click();
      console.log('🔘 저장 버튼 클릭 완료');

      // 5. verification 페이지 이동 대기
      console.log('⏳ verification 페이지 이동 대기 중...');
      await page.waitForFunction(
        () => location.href.includes('/offerings/verification/'),
        { timeout: 60000, polling: 500 }
      );
      console.log('✅ verification 페이지 이동 완료');
      await this.delay(2000);

      // 6. 모바일확인v2 동의 체크박스 클릭
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

      // 7. payMsg 요소로 스크롤 (필요시)
      const payMsg = page.locator('#payMsg');
      if (await payMsg.count() > 0) {
        await payMsg.scrollIntoViewIfNeeded();
        await this.delay(1000);
      }

      // 8. 최종 저장 버튼 (#naverSendSave) 클릭
      console.log('💾 naverSendSave 버튼 대기 중...');
      await page.waitForSelector('#naverSendSave', { timeout: 10000 });

      const naverSaveBtn = page.locator('#naverSendSave');
      await naverSaveBtn.scrollIntoViewIfNeeded();
      await this.delay(500);

      // 저장 확인 다이얼로그 핸들러
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

          if (message.includes('로켓전송이 완료')) {
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

      // Step 10: Wait for verify page (not verification!)
      console.log('📄 verify 페이지 이동 대기 중...');
      await page.waitForFunction(
        () => location.href.includes('/offerings/verify/'),
        { timeout: 60000, polling: 500 }
      );
      console.log('🟢 verify 페이지로 이동 완료');

      await this.delay(2000);

      // Step 11: Click cancel button to return to ad_list
      await page.waitForSelector('#btnCancel');
      const cancelBtn = page.locator('#btnCancel');
      await cancelBtn.scrollIntoViewIfNeeded();
      await this.delay(2000);

      await Promise.all([
        cancelBtn.click(),
      ]);

      // Step 12: Wait for ad_list page
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

      console.log(`✅ 광고 올리기 완료: ${offer.name}`);

      return {
        success: true,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ 광고 올리기 실패: ${offer.name}`, errorMessage);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * 여러 매물의 광고를 순차적으로 올리기
   *
   * @param page Playwright 페이지 객체
   * @param offers 광고를 올릴 매물 목록
   * @param modifiedPrices 수정할 가격 정보
   * @param onProgress 진행 상황 콜백
   * @returns 결과 목록
   */
  async uploadAdsInBatch(
    page: Page,
    offers: AipartnerOffer[],
    modifiedPrices?: Record<string, { price?: string; rent?: string }>,
    onProgress?: (current: number, total: number, offer: AipartnerOffer, result: { success: boolean; error?: string }) => void
  ): Promise<Array<{ offer: AipartnerOffer; success: boolean; error?: string }>> {
    const results: Array<{ offer: AipartnerOffer; success: boolean; error?: string }> = [];

    console.log(`📦 총 ${offers.length}개 매물의 광고를 올립니다`);

    for (let i = 0; i < offers.length; i++) {
      const offer = offers[i];
      console.log(`\n[${i + 1}/${offers.length}] 처리 중...`);

      // 수정할 가격 정보 가져오기
      const priceInfo = modifiedPrices?.[offer.numberN];
      const modifiedPrice = priceInfo?.price;
      const modifiedRent = priceInfo?.rent;

      const result = await this.uploadAd(page, offer, modifiedPrice, modifiedRent);
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

    console.log(`\n📊 광고 올리기 완료: 성공 ${successCount}건, 실패 ${failCount}건`);

    return results;
  }
}
