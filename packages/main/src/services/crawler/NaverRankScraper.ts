import axios, { type AxiosInstance } from 'axios';
import type { NaverRankInfo } from '../../types/index.js';
import { delay, randomDelay } from '../../utils/delay.js';

/**
 * 네이버 순위 정보 수집
 */
export class NaverRankScraper {
  private api: AxiosInstance;

  constructor(bearerToken: string) {
    this.api = axios.create({
      baseURL: 'https://new.land.naver.com/api/',
      headers: {
        authorization: `Bearer ${bearerToken}`,
        Host: 'new.land.naver.com',
        'sec-ch-ua': '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
      },
    });
  }

  /**
   * 네이버 API에서 매물 정보 가져오기 (재시도 포함)
   */
  async fetchWithRetry(url: string, params: any, maxRetries = 10): Promise<any> {
    const userAgents = [
      'Mozilla/5.0 (iPad; CPU OS 6_0 like Mac OS X) AppleWebKit/536.26',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_7_4) AppleWebKit/537.13',
    ];

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
      const randomLoc1 = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      const randomLoc2 = Math.floor(Math.random() * 10000).toString().padStart(4, '0');

      const headers = {
        'User-Agent': userAgent,
        Referer: `https://new.land.naver.com/complexes/364?ms=37.55${randomLoc1},127.1${randomLoc2},17&a=APT:ABYG:JGC&e=RETAIL&ad=true`,
      };

      try {
        const res = await this.api.get(url, {
          params,
          headers,
          timeout: 5000,
        });

        if (res.status === 200) {
          const data = res.data;
          if (data.error) {
            throw new Error(`API Error: ${data.error}`);
          }
          return data;
        } else {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
      } catch (error) {
        console.warn(`⚠️ 시도 ${attempt + 1}/${maxRetries} 실패: ${url}`);
        if (attempt === maxRetries - 1) {
          throw new Error(`❌ ${maxRetries}번 시도 후 실패: ${url}`);
        }
        await randomDelay(1000, 5000); // 1~5초 랜덤 대기
      }
    }

    throw new Error(`❌ fetch failed: ${url}`);
  }

  /**
   * 여러 매물의 네이버 순위 정보 수집
   */
  async getRanksForOffers(offerNumbers: string[]): Promise<Record<string, NaverRankInfo>> {
    console.log(`📊 네이버 순위 정보 수집 시작 (${offerNumbers.length}건)...`);

    const naverData: Record<string, any> = {};

    for (const numberN of offerNumbers) {
      try {
        const data = await this.fetchWithRetry('articles', {
          representativeArticleNo: numberN,
        });
        naverData[numberN] = data;
        console.log(`✅ ${numberN} 순위 정보 수집 완료`);
      } catch (error) {
        console.error(`❌ ${numberN} 순위 정보 수집 실패:`, error);
        naverData[numberN] = null;
      }

      // 요청 간 랜덤 대기 (네이버 차단 방지)
      await randomDelay(1000, 3000);
    }

    // 순위 계산
    const rankedData = this.assignRankings(naverData);

    // 대표 매물 정보만 추출
    const representativeData: Record<string, NaverRankInfo> = {};
    for (const [repNo, articles] of Object.entries(rankedData)) {
      if (!articles || !Array.isArray(articles) || articles.length === 0) continue;

      const matched = articles.find((article: any) => article.articleNo === repNo);
      if (matched) {
        matched.total = articles.length;
        representativeData[repNo] = {
          ranking: matched.ranking,
          sharedRank: matched.sharedRank,
          isShared: matched.isShared,
          sharedCount: matched.sharedCount,
          total: matched.total,
          articleConfirmYmd: matched.articleConfirmYmd,
        };
      }
    }

    console.log(`✅ 네이버 순위 정보 수집 완료`);
    return representativeData;
  }

  /**
   * 순위 계산 (기존 로직 유지)
   */
  private assignRankings(representativeMap: Record<string, any>): Record<string, any[]> {
    for (const [repNo, articles] of Object.entries(representativeMap)) {
      if (!articles || !Array.isArray(articles)) continue;

      let ranking = 1;
      let sharedRank = 1;
      let currentGroupDate = '';
      let currentGroup: any[] = [];
      const allGroups: any[][] = [];

      // 순위 부여
      for (const article of articles) {
        article.ranking = ranking++;

        const date = article.articleConfirmYmd;

        if (currentGroup.length === 0 || date === currentGroupDate) {
          currentGroup.push(article);
          currentGroupDate = date;
        } else {
          allGroups.push([...currentGroup]);
          currentGroup = [article];
          currentGroupDate = date;
        }
      }

      // 마지막 그룹 추가
      if (currentGroup.length > 0) {
        allGroups.push(currentGroup);
      }

      // sharedRank, sharedCount, isShared 추가
      for (const group of allGroups) {
        const isShared = group.length > 1;
        const sharedCount = group.length;
        for (const article of group) {
          article.sharedRank = sharedRank;
          article.sharedCount = sharedCount;
          article.isShared = isShared;
        }
        sharedRank += sharedCount;
      }
    }

    return representativeMap;
  }
}
