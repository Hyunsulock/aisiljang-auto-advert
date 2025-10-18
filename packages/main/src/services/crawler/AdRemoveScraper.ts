import type { Page } from 'playwright';
import type { AipartnerOffer } from '../../types/index.js';

/**
 * 광고 내리기 스크래퍼
 *
 * 이실장 사이트에서 특정 매물의 광고를 내리는 작업을 수행합니다.
 */
export class AdRemoveScraper {
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
   * 단일 매물의 광고 내리기
   *
   * @param page Playwright 페이지 객체
   * @param offer 광고를 내릴 매물 정보
   * @returns 성공 여부
   */
  async removeAd(page: Page, offer: AipartnerOffer): Promise<{ success: boolean; error?: string }> {
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

            // 광고 내리기 버튼 찾기
            const endButton = row.locator('td #naverEnd');

            if (await endButton.count() === 0) {
              throw new Error('광고 내리기 버튼(#naverEnd)을 찾을 수 없습니다');
            }

            // 첫 번째 다이얼로그 핸들러: "네이버에서 노출종료 할까요?"
            const dialogPromise1 = new Promise<boolean>((resolve) => {
              const handler = async (dialog: any) => {
                const message = dialog.message();
                console.log(`📢 다이얼로그 1: ${message}`);

                if (message === '네이버에서 노출종료 할까요?') {
                  console.log('☑️  확인 선택함');
                  await dialog.accept();
                  page.off('dialog', handler);
                  resolve(true);
                } else {
                  console.log('❌ 취소 선택함');
                  await dialog.dismiss();
                  page.off('dialog', handler);
                  resolve(false);
                }
              };
              page.on('dialog', handler);
            });

            // 광고 내리기 버튼 클릭
            await endButton.click();
            const confirmed1 = await dialogPromise1;

            if (!confirmed1) {
              throw new Error('첫 번째 확인 다이얼로그가 거부되었습니다');
            }

            // 두 번째 다이얼로그 핸들러: "네이버에서 노출종료 했어요."
            const dialogPromise2 = new Promise<boolean>((resolve) => {
              const handler = async (dialog: any) => {
                const message = dialog.message();
                console.log(`📢 다이얼로그 2: ${message}`);

                if (message === '네이버에서 노출종료 했어요.') {
                  console.log('☑️  확인 선택함');
                  await dialog.accept();
                  page.off('dialog', handler);
                  resolve(true);
                } else {
                  await dialog.dismiss();
                  page.off('dialog', handler);
                  resolve(false);
                }
              };
              page.on('dialog', handler);
            });

            const confirmed2 = await dialogPromise2;

            if (!confirmed2) {
              throw new Error('두 번째 확인 다이얼로그가 거부되었습니다');
            }

            console.log(`✅ 광고 내리기 완료: ${offer.name}`);
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
   * 여러 매물의 광고를 순차적으로 내리기
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

    console.log(`📦 총 ${offers.length}개 매물의 광고를 내립니다`);

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

    console.log(`\n📊 광고 내리기 완료: 성공 ${successCount}건, 실패 ${failCount}건`);

    return results;
  }
}
