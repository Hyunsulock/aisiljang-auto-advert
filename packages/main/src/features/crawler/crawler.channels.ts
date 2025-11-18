/**
 * Crawler IPC 채널 정의
 * Main과 Renderer 프로세스 간 통신에 사용되는 채널 이름
 */
export const CRAWLER_CHANNELS = {
  // 크롤링 관련
  FETCH_OFFERS: 'crawler:fetch-offers',
  CANCEL: 'crawler:cancel',
  PROGRESS: 'crawler:progress', // Renderer로 전송

  // 매물 조회
  GET_ADVERTISING: 'offers:get-advertising',
  COUNT: 'offers:count',

  // 랭킹 관련
  FETCH_SINGLE_RANK: 'crawler:fetch-single-rank',
  ANALYZE_RANKING: 'crawler:analyze-ranking',
} as const;

export type CrawlerChannel = (typeof CRAWLER_CHANNELS)[keyof typeof CRAWLER_CHANNELS];
