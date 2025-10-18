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
