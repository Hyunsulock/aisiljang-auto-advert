import axios, { type AxiosInstance } from 'axios';
import { CookieJar } from 'tough-cookie';
import { HttpsProxyAgent } from 'https-proxy-agent';
import type { NaverRankInfo, NaverArticle, RankingAnalysis, CompetingAd } from '../../types/index.js';
import { randomDelay } from '../../utils/delay.js';

export interface NaverRankScraperOptions {
  proxyUrl?: string;
  proxyUsername?: string;
  proxyPassword?: string;
}

/**
 * 네이버 순위 정보 수집
 */
export class NaverRankScraper {
  private api: AxiosInstance;
  private cookieJar: CookieJar;
  private bearerToken: string;
  private articlesCache: Record<string, any[]> = {}; // 캐시: articleNo -> articles[]

  constructor(
    bearerToken: string,
    cookieJar: CookieJar,
    options: NaverRankScraperOptions = {}
  ) {
    this.bearerToken = bearerToken;
    this.cookieJar = cookieJar;

    // 프록시 에이전트 설정
    let httpsAgent;
    if (options.proxyUrl) {
      const proxyUrl = options.proxyUsername
        ? `http://${options.proxyUsername}:${options.proxyPassword}@${options.proxyUrl.replace('http://', '')}`
        : options.proxyUrl;
      httpsAgent = new HttpsProxyAgent(proxyUrl);
    }

    this.api = axios.create({
      baseURL: 'https://new.land.naver.com/api/',
      headers: {
        authorization: `Bearer ${this.bearerToken}`,
        Host: 'new.land.naver.com',
        'sec-ch-ua': '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
      },
      httpsAgent,
    });

    // 요청 인터셉터: 쿠키 자동 추가
    this.api.interceptors.request.use(async (config) => {
      const fullUrl = new URL(config.url ?? '', config.baseURL).toString();
      const cookie = await new Promise<string>((resolve, reject) =>
        this.cookieJar.getCookieString(fullUrl, (err, str) => (err ? reject(err) : resolve(str ?? '')))
      );
      config.headers = config.headers || {};
      if (cookie && !config.headers.Cookie) {
        config.headers.Cookie = cookie;
      }

      // 디버그 로그
      console.log('📤 API 요청 헤더:', {
        url: fullUrl,
        authorization: config.headers.authorization ? `Bearer ${config.headers.authorization.substring(7, 20)}...` : 'None',
        cookie: cookie ? `${cookie.substring(0, 50)}...` : 'None',
        userAgent: config.headers['User-Agent'],
      });

      return config;
    });

    // 응답 인터셉터: Set-Cookie를 jar에 반영
    this.api.interceptors.response.use(async (res) => {
      const setCookie = res.headers['set-cookie'];
      if (Array.isArray(setCookie) && setCookie.length) {
        const fullUrl = new URL(res.config.url ?? '', res.config.baseURL).toString();
        for (const line of setCookie) {
          await new Promise<void>((resolve, reject) =>
            this.cookieJar.setCookie(line, fullUrl, (err) => (err ? reject(err) : resolve()))
          );
        }
      }
      return res;
    });
  }

  /**
   * 네이버 API에서 매물 정보 가져오기 (재시도 포함)
   */
  async fetchWithRetry(url: string, params: any, maxRetries = 10): Promise<any> {
 const userAgents = [
    "Mozilla/5.0 (iPad; CPU OS 6_0 like Mac OS X) AppleWebKit/536.26 (KHTML, like Gecko) Version/6.0 Mobile/10A5355d Safari/8536.25",
    "Mozilla/5.0 (Windows; U; MSIE 9.0; Windows NT 9.0; en-US)",
    "Mozilla/5.0 (compatible; MSIE 10.0; Macintosh; Intel Mac OS X 10_7_3; Trident/6.0)",
    "Mozilla/5.0 (compatible; MSIE 8.0; Windows NT 6.1; Trident/4.0; GTB7.4; InfoPath.2; SV1; .NET CLR 3.3.69573; WOW64; en-US)",
    "Opera/9.80 (X11; Linux i686; U; ru) Presto/2.8.131 Version/11.11",
    "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.2 (KHTML, like Gecko) Chrome/22.0.1216.0 Safari/537.2",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_7_4) AppleWebKit/537.13 (KHTML, like Gecko) Chrome/24.0.1290.1 Safari/537.13",
    "Mozilla/5.0 (X11; CrOS i686 2268.111.0) AppleWebKit/536.11 (KHTML, like Gecko) Chrome/20.0.1132.57 Safari/536.11",
    "Mozilla/5.0 (Windows NT 6.2; Win64; x64; rv:16.0.1) Gecko/20121011 Firefox/16.0.1",
    "Mozilla/5.0 (X11; Ubuntu; Linux i686; rv:15.0) Gecko/20100101 Firefox/15.0.1",
];


    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
      const randomLoc1 = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      const randomLoc2 = Math.floor(Math.random() * 10000).toString().padStart(4, '0');

      const headers = {
        'User-Agent': userAgent,
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        Referer: `https://new.land.naver.com/complexes/`,
      };

      try {
        console.log(`🔄 시도 ${attempt + 1}/${maxRetries}: ${url}`, params);

        const res = await this.api.get(url, {
          params,
          headers,
          timeout: 5000,
          maxRedirects: 0,
          responseType: 'text',
        });

        if (res.status === 200) {
          // Raw data 로그 출력
          console.log('📦 Raw Response Data:', res.data);

          let data;
          try {
            // responseType이 'text'이므로 JSON 파싱 필요
            data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
          } catch (parseError) {
            console.error(`❌ JSON 파싱 실패:`, res.data);
            throw new Error('응답이 JSON 형식이 아님');
          }

          // 파싱된 데이터 로그 출력
          console.log('📊 Parsed Response Data:', JSON.stringify(data, null, 2));

          if (data.error) {
            console.error(`❌ API 에러 응답:`, data);
            throw new Error(`API Error: ${data.error}`);
          }
          console.log(`✅ 성공: ${url}`);
          return data;
        } else {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
      } catch (error: any) {
        const errorDetails = {
          attempt: attempt + 1,
          url,
          params,
          message: error.message,
          response: error.response ? {
            status: error.response.status,
            statusText: error.response.statusText,
            headers: error.response.headers,
            data: error.response.data,
          } : null,
          request: error.request ? {
            method: error.request.method,
            path: error.request.path,
            headers: error.request._header,
          } : null,
          code: error.code,
          stack: error.stack,
        };

        console.error(`❌ 시도 ${attempt + 1}/${maxRetries} 실패:`, JSON.stringify(errorDetails, null, 2));

        if (attempt === maxRetries - 1) {
          throw new Error(`❌ ${maxRetries}번 시도 후 실패: ${url}\n원인: ${error.message}\n상세: ${JSON.stringify(errorDetails, null, 2)}`);
        }
        await randomDelay(1000, 5000); // 1~5초 랜덤 대기
      }
    }

    throw new Error(`❌ fetch failed: ${url}`);
  }

  /**
   * 여러 매물의 네이버 순위 정보 수집 (배치 처리)
   */
  async getRanksForOffers(offerNumbers: string[]): Promise<Record<string, NaverRankInfo>> {
    console.log(`📊 네이버 순위 정보 수집 시작 (${offerNumbers.length}건)...`);

    const naverData: Record<string, any> = {};
    const BATCH_SIZE = 20;

    // 배치 단위로 처리
    for (let i = 0; i < offerNumbers.length; i += BATCH_SIZE) {
      const batch = offerNumbers.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(offerNumbers.length / BATCH_SIZE);

      console.log(`📦 배치 ${batchNumber}/${totalBatches} 처리 중 (${batch.length}건)...`);

      // 배치 내 요청들을 병렬로 처리
      const batchPromises = batch.map(async (numberN) => {
        try {
          const data = await this.fetchWithRetry('articles', {
            representativeArticleNo: numberN,
          });
          return { numberN, data, success: true };
        } catch (error) {
          console.error(`❌ ${numberN} 순위 정보 수집 실패:`, error);
          return { numberN, data: null, success: false };
        }
      });

      // 배치 내 모든 요청이 완료될 때까지 대기
      const batchResults = await Promise.all(batchPromises);

      // 결과 저장
      for (const result of batchResults) {
        naverData[result.numberN] = result.data;
        if (result.success) {
          console.log(`✅ ${result.numberN} 순위 정보 수집 완료`);
        }
      }

      console.log(`✅ 배치 ${batchNumber}/${totalBatches} 완료 (성공: ${batchResults.filter(r => r.success).length}/${batch.length})`);

      // 배치 간 랜덤 대기 (네이버 차단 방지)
      if (i + BATCH_SIZE < offerNumbers.length) {
        const delay = Math.floor(Math.random() * 2000) + 1000; // 2~4초
        console.log(`⏳ 다음 배치까지 ${delay}ms 대기 중...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // 순위 계산
    const rankedData = this.assignRankings(naverData);

    // 캐시에 저장 (analyzeRanking에서 재사용)
    this.articlesCache = rankedData;

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

  /**
   * 랭킹 분석: 내 광고와 경쟁 광고 비교
   */
  async analyzeRanking(
    myArticleNo: string,
    _myBuildingName?: string, // API가 같은 동호수만 반환하므로 사용 안함
    myPrice?: string
  ): Promise<RankingAnalysis> {
    console.log(`🔍 랭킹 분석 시작: ${myArticleNo}`);

    // 1. 캐시 확인 또는 전체 매물 리스트 가져오기
    let data: any;
    if (this.articlesCache[myArticleNo]) {
      console.log(`📦 캐시에서 데이터 로드: ${myArticleNo}`);
      data = { body: { articleList: this.articlesCache[myArticleNo] } };
    } else {
      console.log(`🌐 API에서 데이터 로드: ${myArticleNo}`);
      data = await this.fetchWithRetry('articles', {
        representativeArticleNo: myArticleNo,
      });
    }

    // 2. articles 추출
    const articles: NaverArticle[] = this.articlesCache[myArticleNo] || data?.body?.articleList || [];

    if (!Array.isArray(articles) || articles.length === 0) {
      return {
        myArticle: null,
        myRanking: null,
        myFloorExposed: false,
        totalCount: 0,
        competingAds: [],
        hasFloorExposureAdvantage: false,
      };
    }

    console.log(`📊 전체 매물 수: ${articles.length}개`);

    // 3. 내 광고 찾기
    const myArticle = articles.find(a => a.articleNo === myArticleNo);
    if (!myArticle) {
      console.warn(`⚠️ 내 광고를 찾을 수 없습니다: ${myArticleNo}`);
      return {
        myArticle: null,
        myRanking: null,
        myFloorExposed: false,
        totalCount: articles.length,
        competingAds: [],
        hasFloorExposureAdvantage: false,
      };
    }

    const myRanking = articles.findIndex(a => a.articleNo === myArticleNo) + 1;
    console.log(`📍 내 광고 순위: ${myRanking}/${articles.length}`);

    // 4. 같은 동호수의 다른 광고들 (API가 이미 같은 동호수만 반환하므로 buildingName 필터링 불필요)
    const samePropertyArticles = articles.filter(article => {
      // 내 광고만 제외
      return article.articleNo !== myArticleNo;
    });

    console.log(`🏢 같은 동호수의 다른 광고: ${samePropertyArticles.length}개`);

    // 5. 가격이 다른 광고만 필터링
    // 가격을 만원 단위 숫자로 정규화
    // 예: "24억" -> 240000, "24억 5000" -> 245000, "240000" -> 240000
    const normalizePrice = (price: string): number => {
      const cleaned = price.replace(/[,\s]/g, '');

      // "24억5000" 또는 "24억 5000" 형식 처리
      const eokWithManMatch = cleaned.match(/^(\d+)억(\d+)$/);
      if (eokWithManMatch) {
        const eok = parseInt(eokWithManMatch[1]);
        const man = parseInt(eokWithManMatch[2]);
        return eok * 10000 + man; // 억 -> 만원 + 만원
      }

      // "24억" 형식 처리
      const eokMatch = cleaned.match(/^(\d+)억$/);
      if (eokMatch) {
        return parseInt(eokMatch[1]) * 10000; // 억 -> 만원 단위
      }

      // "240000만원" 또는 "240000" 형식 (만원 단위)
      const manMatch = cleaned.match(/^(\d+)(만원?)?$/);
      if (manMatch) {
        return parseInt(manMatch[1]);
      }

      // 파싱 실패 시 0 반환
      console.warn(`⚠️ 가격 파싱 실패: "${price}"`);
      return 0;
    };

    const myNormalizedPrice = normalizePrice(myPrice || myArticle.dealOrWarrantPrc);
    console.log(`💵 내 광고 가격 (정규화): "${myPrice || myArticle.dealOrWarrantPrc}" -> ${myNormalizedPrice}만원`);

    const differentPriceArticles = samePropertyArticles.filter(article => {
      const articlePrice = normalizePrice(article.dealOrWarrantPrc);
      const isDifferent = articlePrice !== myNormalizedPrice;
      console.log(`  - 광고 ${article.articleNo}: "${article.dealOrWarrantPrc}" -> ${articlePrice}만원 (다름: ${isDifferent})`);
      return isDifferent;
    });

    console.log(`💰 가격이 다른 광고: ${differentPriceArticles.length}개`);

    // 6. 층수 노출 여부 확인
    const isFloorExposed = (floorInfo: string): boolean => {
      // "12/25" 같은 형식 = 노출됨
      // "저/25", "중/25", "고/25" = 노출 안됨
      return /^\d+\/\d+$/.test(floorInfo);
    };

    const myFloorExposed = isFloorExposed(myArticle.floorInfo);
    console.log(`🏠 내 광고 층수 노출: ${myFloorExposed ? '노출' : '미노출'} (${myArticle.floorInfo})`);

    // 7. 내가 미노출일 때만, 층수를 노출한 광고 필터링 (가격 같아도 경쟁 광고)
    const floorExposureCompetingArticles: any[] = [];
    if (!myFloorExposed) {
      const exposedArticles = samePropertyArticles.filter(article => {
        const articleFloorExposed = isFloorExposed(article.floorInfo);
        // 내가 미노출인데 다른 광고는 노출이면 경쟁 광고
        if (articleFloorExposed) {
          console.log(`  - 광고 ${article.articleNo}: 층수 노출 (${article.floorInfo}) - 경쟁 광고!`);
        }
        return articleFloorExposed;
      });
      floorExposureCompetingArticles.push(...exposedArticles);
      console.log(`🏠 내가 미노출인데 층수 노출한 광고: ${exposedArticles.length}개`);
    }

    // 8. 경쟁 광고 = 가격이 다른 광고 + (내가 미노출일 때) 층수 노출한 광고 (중복 제거)
    const competingArticlesSet = new Set([
      ...differentPriceArticles.map(a => a.articleNo),
      ...floorExposureCompetingArticles.map(a => a.articleNo),
    ]);

    const competingArticles = samePropertyArticles.filter(article =>
      competingArticlesSet.has(article.articleNo)
    );

    console.log(`🎯 경쟁 광고 (가격 다름 OR 내가 미노출이고 상대는 노출): ${competingArticles.length}개`);

    // 9. 경쟁 광고 정보 생성
    const competingAds: CompetingAd[] = competingArticles.map(article => {
      const ranking = articles.findIndex(a => a.articleNo === article.articleNo) + 1;
      const competingPrice = normalizePrice(article.dealOrWarrantPrc);
      const isPriceLower = competingPrice < myNormalizedPrice && competingPrice !== 0;
      const isPriceHigher = competingPrice > myNormalizedPrice && competingPrice !== 0;

      return {
        articleNo: article.articleNo,
        ranking,
        price: article.dealOrWarrantPrc,
        floorInfo: article.floorInfo,
        isFloorExposed: isFloorExposed(article.floorInfo),
        articleConfirmYmd: article.articleConfirmYmd,
        realtorName: article.realtorName || '알 수 없음',
        verificationTypeCode: article.verificationTypeCode,
        isPriceLower,
        isPriceHigher,
      };
    });

    // 10. 층수 노출 우위 확인
    // 내가 미노출인데 다른 광고가 층수 노출했는지 (가격 무관, 순위 무관)
    const hasFloorExposureAdvantage = !myFloorExposed && floorExposureCompetingArticles.length > 0;

    if (hasFloorExposureAdvantage) {
      console.log(`⚠️ 같은 건물의 다른 광고들이 층수를 노출하고 있습니다!`);
      differentPriceArticles.filter(article => isFloorExposed(article.floorInfo)).forEach(article => {
        const ranking = articles.findIndex(a => a.articleNo === article.articleNo) + 1;
        console.log(`  - 순위 ${ranking}: ${article.floorInfo} (${article.dealOrWarrantPrc})`);
      });
    }

    // 11. 결과 반환
    console.log(`📋 내 광고 층수 노출 여부: ${myFloorExposed ? '노출됨' : '노출 안됨'} (${myArticle.floorInfo})`);

    return {
      myArticle,
      myRanking,
      myFloorExposed,
      totalCount: articles.length,
      competingAds: competingAds.sort((a, b) => a.ranking - b.ranking),
      hasFloorExposureAdvantage,
    };
  }
}
