import { CrawlerService } from './services/crawler/CrawlerService.js';
import { OfferRepository } from './repositories/OfferRepository.js';

/**
 * 크롤러 테스트 코드
 *
 * 실행 방법:
 * cd packages/main
 * npx tsx src/test-crawler.ts
 */
async function testCrawler() {
  console.log('🚀 크롤러 테스트 시작\n');

  const crawler = new CrawlerService({
    headless: false, // 브라우저 보이게
    includeRanking: false, // 네이버 순위 정보 건너뛰기
    onProgress: (progress) => {
      console.log(`📊 진행: ${progress.message}`);
    },
  });

  const offerRepo = new OfferRepository();

  try {
    const offers = await crawler.fetchOffers();

    console.log('\n✅ 수집 완료!\n');
    console.log(`총 ${offers.length}건 수집`);

    // 데이터베이스에 저장
    console.log('\n💾 데이터베이스에 저장 중...\n');
    await offerRepo.upsertMany(offers);
    console.log('\n=== 샘플 데이터 (처음 3개) ===\n');

    offers.slice(0, 3).forEach((offer, index) => {
      console.log(`\n[${index + 1}] 매물 정보:`);
      console.log(`  - 네이버 매물번호: ${offer.numberN}`);
      console.log(`  - 이실장 매물번호: ${offer.numberA}`);
      console.log(`  - 주소: ${offer.address}`);
      console.log(`  - 매물 종류: ${offer.type}`);
      console.log(`  - 거래 유형: ${offer.dealType}`);
      if (offer.rent) {
        console.log(`  - 보증금/월세: ${offer.price} / ${offer.rent}`);
      } else {
        console.log(`  - 가격: ${offer.price}`);
      }
      console.log(`  - 전용면적: ${offer.areaPrivate}㎡`);
      console.log(`  - 순위: ${offer.ranking ?? 'N/A'}/${offer.total ?? 'N/A'}`);
      console.log(`  - 광고 상태: ${offer.adStatus}`);
      console.log(`  - 노출 기간: ${offer.dateRange}`);
    });

    console.log('\n=== 통계 ===');
    console.log(`광고중: ${offers.filter((o) => o.adStatus.includes('광고')).length}건`);
    console.log(`거래완료: ${offers.filter((o) => o.adStatus.includes('완료')).length}건`);

    // DB 저장 확인
    const dbCount = await offerRepo.count();
    console.log(`\n📊 DB에 저장된 총 매물 수: ${dbCount}건`);

    // 브라우저 닫기
    await crawler.close();
  } catch (error) {
    console.error('\n❌ 오류 발생:', error);
    await crawler.close();
    process.exit(1);
  }
}

// 실행
testCrawler();
