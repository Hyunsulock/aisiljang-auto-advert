import { useState } from 'react';
import { createRoute } from '@tanstack/react-router';
import type { AnyRootRoute } from '@tanstack/react-router';
import { Button } from '../components/ui/button';

function CrawlerTest() {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [offerCount, setOfferCount] = useState<number | null>(null);

  const handleFetchOffers = async () => {
    let unsubscribe: (() => void) | null = null;

    try {
      setIsLoading(true);
      setError('');
      setResult(null);
      setProgress('크롤링 시작 중...');

      // 진행 상황 수신
      unsubscribe = (window as any).crawler.onProgress((p: any) => {
        setProgress(p.message);
      });

      // 크롤링 실행
      const response = await (window as any).crawler.fetchOffers({
        includeRanking: false,
      });

      if (response.success) {
        setResult(response);
        setProgress(`✅ 완료! ${response.count}건 수집`);

        // DB 저장된 개수 확인
        const countResponse = await (window as any).offers.count();
        if (countResponse.success) {
          setOfferCount(countResponse.data);
        }
      } else {
        setError(response.error || '알 수 없는 오류');
        setProgress('❌ 실패');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setProgress('❌ 오류 발생');
    } finally {
      if (unsubscribe) {
        unsubscribe();
      }
      setIsLoading(false);
    }
  };

  const handleGetOffers = async () => {
    try {
      setError('');
      const response = await (window as any).offers.getAll();

      if (response.success) {
        setResult(response);
        setProgress(`DB에서 ${response.data.length}건 조회`);
      } else {
        setError(response.error || '조회 실패');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleCancel = async () => {
    try {
      await (window as any).crawler.cancel();
      setProgress('취소됨');
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">크롤러 테스트</h1>

      <div className="space-y-4 mb-8">
        <div className="flex gap-4">
          <Button
            onClick={handleFetchOffers}
            disabled={isLoading}
          >
            {isLoading ? '크롤링 중...' : '매물 크롤링 시작'}
          </Button>

          <Button
            onClick={handleCancel}
            disabled={!isLoading}
            variant="destructive"
          >
            취소
          </Button>

          <Button
            onClick={handleGetOffers}
            variant="secondary"
          >
            DB에서 조회
          </Button>
        </div>

        {progress && (
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="font-medium">진행 상황:</p>
            <p>{progress}</p>
          </div>
        )}

        {offerCount !== null && (
          <div className="p-4 bg-green-50 rounded-lg">
            <p className="font-medium">DB 저장된 매물 수: {offerCount}건</p>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 rounded-lg text-red-700">
            <p className="font-medium">오류:</p>
            <p>{error}</p>
          </div>
        )}
      </div>

      {result && (
        <div className="border rounded-lg p-4">
          <h2 className="text-xl font-bold mb-4">결과</h2>

          {result.count && (
            <p className="mb-4">총 {result.count}건 수집</p>
          )}

          {result.data && result.data.length > 0 && (
            <div>
              <h3 className="font-bold mb-2">샘플 데이터 (최대 3개):</h3>
              <div className="space-y-4">
                {result.data.slice(0, 3).map((offer: any, index: number) => (
                  <div key={index} className="p-4 bg-gray-50 rounded">
                    <p><strong>주소:</strong> {offer.address}</p>
                    <p><strong>거래유형:</strong> {offer.dealType}</p>
                    <p>
                      <strong>가격:</strong>{' '}
                      {offer.rent
                        ? `${offer.price} / ${offer.rent}`
                        : offer.price}
                    </p>
                    <p><strong>광고상태:</strong> {offer.adStatus}</p>
                    <p><strong>네이버번호:</strong> {offer.numberN}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default (parentRoute: AnyRootRoute) =>
  createRoute({
    path: '/crawler-test',
    component: CrawlerTest,
    getParentRoute: () => parentRoute,
  });
