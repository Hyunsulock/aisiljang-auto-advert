import type { Page } from 'playwright';

export class AdModifyScraper {

  /**
   * 지연 함수
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 날짜 문자열을 Date 객체로 변환 (예: "25.10.15" -> Date)
   */
  private parseAdDate(dateStr: string): Date | null {
    try {
      const parts = dateStr.trim().split('.');
      if (parts.length !== 3) return null;

      const year = parseInt('20' + parts[0]); // "25" -> 2025
      const month = parseInt(parts[1]) - 1; // 0-based
      const day = parseInt(parts[2]);

      return new Date(year, month, day);
    } catch {
      return null;
    }
  }

  /**
   * 두 날짜의 일수 차이 계산
   */
  private getDaysDifference(date1: Date, date2: Date): number {
    const msPerDay = 1000 * 60 * 60 * 24;
    return Math.floor((date1.getTime() - date2.getTime()) / msPerDay);
  }

  /**
   * 가격 수정만 수행 (재광고 없이)
   */
  async modifyPrice(
    page: Page,
    numberN: string,
    modifiedPrice?: string,
    modifiedRent?: string,
    targetAdStartDate?: string, // 찾으려는 매물의 광고 시작일 (예: "25.10.15")
    floorExposure?: boolean // 층수 노출 여부 (true: 노출, false: 미노출)
  ): Promise<{ success: boolean; message: string }> {

    try {
          // 광고중 버튼 대기
      await page.waitForSelector(
        '#wrap > div > div > div > div.sectionWrap > div.statusWrap.ver3 > div.statusItem.statusIng.GTM_offerings_ad_list_ad_ing',
        { timeout: 30000 }
      );
      await page.click(
      '#wrap > div > div > div > div.sectionWrap > div.statusWrap.ver3 > div.statusItem.statusIng.GTM_offerings_ad_list_ad_ing'
    );
      await page.waitForLoadState('networkidle');
      console.log(`[AdModifyScraper] 매물 ${numberN} 가격 수정 시작`);


      // 2. 페이지네이션을 통해 매물 찾기
      let isFound = false;
      let maxPages = 20;
      let currentPage = 0;
      let shouldStopSearch = false;

      // 타겟 날짜 파싱 (최적화용)
      const targetDate = targetAdStartDate ? this.parseAdDate(targetAdStartDate) : null;

      while (!isFound && !shouldStopSearch && currentPage < maxPages) {
        currentPage++;
        console.log(`[AdModifyScraper] 📄 페이지 ${currentPage} 검색 중...`);

        // 테이블 로드 대기
        await page.waitForSelector('table > tbody > tr', { timeout: 5000 });

        // 매물 행들 가져오기
        const rows = await page.locator(
          '#wrap > div > div > div > div.sectionWrap > div.singleSection.listSection > div.listWrap > table > tbody > tr'
        ).all();

        console.log(`[AdModifyScraper] 📊 현재 페이지에 ${rows.length}개 매물`);

        // 각 행을 순회하면서 numberN 확인
        for (const row of rows) {
          const numberNElement = row.locator('.numberN');
          const numberText = await numberNElement.textContent();
          const cleanedNumber = numberText?.replace(/\D/g, '').trim();

          if (cleanedNumber === numberN) {
            console.log(`[AdModifyScraper] ✅ 매물 발견: ${cleanedNumber}`);

            // 수정하기 버튼 찾기 (클래스: management GTM_offerings_ad_list_listing_re)
            const modifyButton = row.locator('.management.GTM_offerings_ad_list_listing_re');

            if (await modifyButton.count() === 0) {
              throw new Error('수정하기 버튼을 찾을 수 없습니다');
            }

            // 수정하기 버튼 클릭 (페이지 이동 발생)
            console.log('[AdModifyScraper] 🔘 수정하기 버튼 클릭 중...');
            await Promise.all([
              page.waitForURL('**/offerings/ad_regist**', { timeout: 30000 }),
              modifyButton.click(),
            ]);

            console.log('[AdModifyScraper] ✅ 광고 수정 페이지로 이동 완료');
            isFound = true;
            break;
          }

          // 최적화: 등록일 체크 (타겟 날짜보다 2일 이상 오래된 매물이면 검색 중단)
          if (targetDate) {
            const dateCell = row.locator('td.date');
            if (await dateCell.count() > 0) {
              const dateRangeText = await dateCell.textContent();
              // "25.10.15 ~ 25.11.14" 형식에서 앞부분 추출
              const match = dateRangeText?.trim().match(/^(\d{2}\.\d{2}\.\d{2})/);
              if (match) {
                const rowStartDate = this.parseAdDate(match[1]);
                if (rowStartDate) {
                  const daysDiff = this.getDaysDifference(targetDate, rowStartDate);
                  if (daysDiff >= 2) {
                    console.log(`[AdModifyScraper] ⏸️  최적화: 타겟 날짜(${targetAdStartDate})보다 ${daysDiff}일 오래된 매물 발견. 검색 중단.`);
                    shouldStopSearch = true;
                    break;
                  }
                }
              }
            }
          }
        }

        if (isFound) break;

        // 다음 페이지로 이동
        const nextButton = page.locator('div.pagination a.btnArrow.next');
        const currentButton = page.locator('div.pagination a.btnPage.on');

        if (await nextButton.count() === 0 || await currentButton.count() === 0) {
          console.log('[AdModifyScraper] ❌ 페이지네이션 버튼이 없습니다');
          break;
        }

        const nextValue = await nextButton.getAttribute('data-value');
        const currentValue = await currentButton.getAttribute('data-value');

        if (nextValue === currentValue) {
          console.log('[AdModifyScraper] ✅ 마지막 페이지 도달');
          break;
        }

        // 다음 페이지 버튼 클릭
        await nextButton.scrollIntoViewIfNeeded();
        await nextButton.click();
        await this.delay(1000);
      }

      if (!isFound) {
        throw new Error(`매물을 찾을 수 없습니다: ${numberN}`);
      }

      // 3. ad_regist 페이지에서 작업
      await page.waitForLoadState('networkidle');

      console.log(`[AdModifyScraper] ad_regist 페이지 진입 완료`);

      // 4. 거래 유형 확인
      const offerGbnChecked = await page.locator('input[name="offerGbn"]:checked').getAttribute('value');
      console.log(`[AdModifyScraper] 거래 유형: ${offerGbnChecked}`);

      // 5. 가격 수정
      if (modifiedPrice) {
        let priceInput;

        if (offerGbnChecked === 'S') {
          // 매매
          priceInput = page.locator('input[name="sellPrc"]#setSellPrc');
          console.log('[AdModifyScraper] 매매가 수정');
        } else if (offerGbnChecked === 'L') {
          // 전세
          priceInput = page.locator('input[name="leasePrc"]#setLeasePrc');
          console.log('[AdModifyScraper] 전세가 수정');
        } else if (offerGbnChecked === 'M' || offerGbnChecked === 'T') {
          // 월세 - 보증금
          priceInput = page.locator('input[name="depositPrc"]#setDepositPrc');
          console.log('[AdModifyScraper] 월세 보증금 수정');
        }

        if (priceInput && await priceInput.count() > 0) {
          await priceInput.clear();
          await priceInput.fill(modifiedPrice.replace(/,/g, ''));
          console.log(`[AdModifyScraper] 가격 입력 완료: ${modifiedPrice}`);
        }
      }

      // 6. 월세인 경우 월세가도 수정
      if (modifiedRent && (offerGbnChecked === 'M' || offerGbnChecked === 'T')) {
        const rentInput = page.locator('input[name="monthlyPrc"]#setMonthlyPrc');
        if (await rentInput.count() > 0) {
          await rentInput.clear();
          await rentInput.fill(modifiedRent.replace(/,/g, ''));
          console.log(`[AdModifyScraper] 월세가 입력 완료: ${modifiedRent}`);
        }
      }

      // 7. 층수 노출 여부 변경
      if (floorExposure !== undefined) {
        // isFloorDisplay: Y=직접노출(층수 노출), N=고/중/저(층수 미노출)
        const targetId = floorExposure ? 'setIsFloorDisplay1' : 'setIsFloorDisplay2';
        const floorLabel = page.locator(`label[for="${targetId}"]`);

        if (await floorLabel.count() > 0) {
          // 라벨이 화면에 보이도록 스크롤
          await floorLabel.scrollIntoViewIfNeeded();
          await this.delay(300);

          // 라벨 클릭 (라디오 버튼이 숨겨져 있어도 동작)
          await floorLabel.click();
          console.log(`[AdModifyScraper] 층수 노출 변경: ${floorExposure ? '직접노출' : '고/중/저'}`);
        } else {
          console.warn('[AdModifyScraper] ⚠️ 층수 노출 라벨을 찾을 수 없습니다.');
        }
      }

      // 8. 수정하기 버튼 클릭
      const saveButton = page.locator('button#offeringsAdSave');
      await saveButton.waitFor({ state: 'visible', timeout: 5000 });
      await saveButton.click();

      console.log('[AdModifyScraper] 수정하기 버튼 클릭 완료');

      // 8. 팝업 또는 완료 확인
      await page.waitForTimeout(2000);

      // Alert 처리 (once로 한 번만 처리하고 자동 제거)
      const dialogHandler = async (dialog: any) => {
        console.log(`[AdModifyScraper] Alert: ${dialog.message()}`);
        try {
          await dialog.accept();
        } catch (error) {
          console.log(`[AdModifyScraper] 다이얼로그 이미 처리됨`);
        }
      };
      page.once('dialog', dialogHandler);

      await page.waitForTimeout(2000);

      // 다이얼로그 핸들러가 사용되지 않았다면 제거
      page.off('dialog', dialogHandler);

      console.log(`[AdModifyScraper] 매물 ${numberN} 가격 수정 완료`);

      return {
        success: true,
        message: '가격 수정 완료',
      };
    } catch (error: any) {
      console.error(`[AdModifyScraper] 가격 수정 실패:`, error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * 여러 매물의 가격/층수 노출을 일괄 수정
   */
  async modifyPricesBatch(
    page: Page,
    offers: Array<{
      numberN: string;
      modifiedPrice?: string;
      modifiedRent?: string;
      floorExposure?: boolean; // 층수 노출 여부
      adStartDate?: string; // 최적화를 위한 광고 시작일
    }>,
    onProgress?: (message: string) => void
  ): Promise<{ success: boolean; results: any[] }> {
    const results = [];

    for (let i = 0; i < offers.length; i++) {
      const offer = offers[i];
      const progress = `[${i + 1}/${offers.length}] 매물 ${offer.numberN} 수정 중...`;

      if (onProgress) {
        onProgress(progress);
      }
      console.log(progress);

      const result = await this.modifyPrice(
        page,
        offer.numberN,
        offer.modifiedPrice,
        offer.modifiedRent,
        offer.adStartDate,
        offer.floorExposure
      );

      results.push({
        numberN: offer.numberN,
        ...result,
      });

      // 다음 매물 처리 전 대기
      if (i < offers.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;

    console.log(`[AdModifyScraper] 일괄 수정 완료: 성공 ${successCount}건, 실패 ${failCount}건`);

    return {
      success: failCount === 0,
      results,
    };
  }
}
