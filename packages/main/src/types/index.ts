/**
 * 이실장 매물 정보
 */
export interface AipartnerOffer {
  numberA: string;           // 이실장 매물번호
  numberN: string;           // 네이버 매물번호
  type: string;              // 매물 종류 (아파트, 오피스텔 등)
  name: string;              // 매물 이름 (예: "고덕그라시움")
  dong: string | null;       // 동 정보 (예: "101")
  ho: string | null;         // 호수 (예: "701")
  address: string;           // 전체 주소 (예: "고덕그라시움 101동 701호")
  areaPublic: string | null; // 공급면적 (㎡)
  areaPrivate: string | null; // 전용면적 (㎡)
  areaPyeong: string | null;  // 전용면적 (평)
  dealType: string;          // 매매/전세/월세
  price: string;             // 매매가 or 전세가 or 보증금
  rent: string | null;       // 월세 (월세인 경우만)
  adChannel: string | null;  // 노출 채널
  adMethod: string | null;   // 검증 방식
  adStatus: string;          // 광고 상태 (광고중, 거래완료)
  adStartDate: string | null; // 노출 시작일 (예: "25.10.15")
  adEndDate: string | null;   // 노출 종료일 (예: "25.11.14")
  dateRange: string;         // 노출 기간 원본 (예: "25.10.15 ~ 25.11.14")
}

/**
 * 네이버 순위 정보
 */
export interface NaverRankInfo {
  ranking: number;           // 순위
  sharedRank: number;        // 공동 순위
  isShared: boolean;         // 공동 순위 여부
  sharedCount: number;       // 같은 순위 개수
  total: number;             // 전체 매물 수
  articleConfirmYmd?: string; // 등록일자
}

/**
 * 통합 매물 정보 (이실장 + 네이버 순위)
 */
export interface OfferWithRank extends AipartnerOffer {
  ranking: number | null;
  sharedRank: number | null;
  isShared: boolean | null;
  sharedCount: number | null;
  total: number | null;
  rankingAnalysis?: RankingAnalysis | null;
}

/**
 * 크롤러 진행 상황
 */
export interface CrawlerProgress {
  phase: 'auth' | 'fetching' | 'scraping' | 'ranking' | 'completed';
  current: number;
  total: number;
  message: string;
}

/**
 * 네이버 API 응답 매물 정보
 */
export interface NaverArticle {
  articleNo: string;
  articleName: string;
  tradeTypeName: string;
  dealOrWarrantPrc: string;
  floorInfo: string;
  direction: string;
  articleConfirmYmd: string;
  realtorName?: string;
  buildingName?: string;
  detailAddress?: string;
  area1?: number;
  area2?: number;
  areaName?: string;
  verificationTypeCode?: string;
  [key: string]: any;
}

/**
 * 경쟁 광고 분석 결과
 */
export interface CompetingAd {
  articleNo: string;
  ranking: number;
  price: string;
  floorInfo: string;
  isFloorExposed: boolean; // 층수가 숫자로 노출되는지 (예: "12/25")
  articleConfirmYmd: string;
  realtorName: string; // 부동산 이름
  verificationTypeCode?: string;
  isPriceLower: boolean; // 내 광고보다 가격이 낮은지
  isPriceHigher: boolean; // 내 광고보다 가격이 높은지
}

/**
 * 랭킹 분석 결과
 */
export interface RankingAnalysis {
  myArticle: NaverArticle | null;
  myRanking: number | null;
  myFloorExposed: boolean; // 내 광고의 층수 노출 여부
  totalCount: number;
  competingAds: CompetingAd[]; // 나보다 앞선 같은 매물
  hasFloorExposureAdvantage: boolean; // 다른 광고들이 층수 노출하는지
}
