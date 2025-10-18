import axios from 'axios';
import * as cheerio from 'cheerio';
import type { Cookie } from 'playwright';
import type { AipartnerOffer } from '../../types/index.js';
import { parsePrice } from '../../utils/parsePrice.js';
import { parseAddress } from '../../utils/parseAddress.js';
import { parseDateRange } from '../../utils/parseDateRange.js';
import { convertToPyeong } from '../../utils/convertToPyeong.js';

/**
 * 이실장 매물 리스트 크롤링
 */
export class OfferListScraper {
  /**
   * 이실장 광고 리스트에서 모든 매물 수집
   */
  async scrapeAll(cookies: Cookie[], token: string): Promise<AipartnerOffer[]> {
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
    const result: AipartnerOffer[] = [];
    let pageNum = 1;

    console.log('📄 이실장 매물 리스트 크롤링 시작...');

    while (true) {
      const body = new URLSearchParams({
        _token: token,
        page: pageNum.toString(),
        adName: 'ad',
      }).toString();

      try {
        const response = await axios.post('https://www.aipartner.com/offerings/ad_list', body, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Cookie: cookieHeader,
            Referer: 'https://www.aipartner.com/offerings/ad_list',
            Origin: 'https://www.aipartner.com',
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
          },
          responseType: 'text',
        });

        const $ = cheerio.load(response.data);
        const rows = $('table.tableAdSale tbody tr');

        // 매물이 없는 경우
        const firstRowText = rows.first().text().trim();
        if (rows.length === 1 && firstRowText.includes('매물이 존재하지 않습니다')) {
          console.log(`📄 페이지 ${pageNum}에 매물이 없습니다. 종료.`);
          break;
        }

        console.log(`📄 페이지 ${pageNum}에서 ${rows.length}건 수집`);

        // 각 행 파싱
        rows.each((_, el) => {
          const row = $(el);

          // 노출채널/검증방식 파싱
          const adChannelCell = row.find('td').eq(6); // 7번째 <td>
          const adChannel = adChannelCell.find('.channel').text().trim() || null;
          const adMethod = adChannelCell
            .clone()
            .children()
            .remove()
            .end()
            .text()
            .replace('/', '')
            .trim() || null;

          // 가격 파싱 (보증금/월세 분리)
          const priceText = row.find('.price').text().trim();
          const { price, rent } = parsePrice(priceText);

          // 주소 파싱 (매물 이름, 동, 호수 분리)
          const addressText = row.find('.fullName .pre-wrap').text().trim();
          const { name, dong, ho, fullAddress } = parseAddress(addressText);

          // 날짜 범위 파싱 (시작일/종료일 분리)
          const dateRangeText = row.find('td.date').text().trim();
          const { startDate, endDate } = parseDateRange(dateRangeText);

          // 면적 정보 가져오기 및 평형 계산
          const areaPrivate = row.find('.squareMeter[data-gu="[전]"]').attr('data-value') || null;
          const areaPyeong = convertToPyeong(areaPrivate);

          const offer: AipartnerOffer = {
            numberA: row.find('.numberA').text().trim(),
            numberN: row.find('.numberN').text().trim(),
            type: row.find('td').eq(2).text().trim(),
            name,
            dong,
            ho,
            address: fullAddress,
            areaPublic: row.find('.squareMeter[data-gu="[공]"]').attr('data-value') || null,
            areaPrivate: areaPrivate,
            areaPyeong: areaPyeong,
            dealType: row.find('.dealType').text().trim(),
            price,
            rent,
            adChannel: adChannel,
            adMethod: adMethod,
            adStatus: row.find('.statusAd').text().trim(),
            adStartDate: startDate,
            adEndDate: endDate,
            dateRange: dateRangeText,
          };

          result.push(offer);
        });

        pageNum++;
      } catch (error) {
        console.error(`❌ 페이지 ${pageNum} 크롤링 실패:`, error);
        throw error;
      }
    }

    console.log(`✅ 전체 ${result.length}건 매물 수집 완료`);
    return result;
  }
}
