import { useState } from 'react';
import { createRoute } from '@tanstack/react-router';
import type { AnyRootRoute } from '@tanstack/react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { crawler, offers as offersAPI } from '@app/preload';

function CrawlerTest() {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [offerCount, setOfferCount] = useState<number | null>(null);

  // 네이버 랭킹 조회용 상태
  const [offerId, setOfferId] = useState('');
  const [isLoadingRank, setIsLoadingRank] = useState(false);
  const [rankResult, setRankResult] = useState<any>(null);
  const [rankError, setRankError] = useState('');

  // 랭킹 분석용 상태
  const [analysisOfferId, setAnalysisOfferId] = useState('');
  const [analysisBuilding, setAnalysisBuilding] = useState('');
  const [analysisPrice, setAnalysisPrice] = useState('');
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [analysisError, setAnalysisError] = useState('');

  // 광고 내리기 테스트용 상태
  const [removeOfferId, setRemoveOfferId] = useState('');
  const [isRemovingAd, setIsRemovingAd] = useState(false);
  const [removeResult, setRemoveResult] = useState<any>(null);
  const [removeError, setRemoveError] = useState('');

  // 가격 수정 테스트용 상태
  const [modifyOfferId, setModifyOfferId] = useState('');
  const [modifyPrice, setModifyPrice] = useState('');
  const [modifyRent, setModifyRent] = useState('');
  const [isModifyingPrice, setIsModifyingPrice] = useState(false);
  const [modifyResult, setModifyResult] = useState<any>(null);
  const [modifyError, setModifyError] = useState('');

  // (신)홍보확인서 테스트용 상태
  const [verificationName, setVerificationName] = useState('');
  const [verificationDong, setVerificationDong] = useState('');
  const [verificationHo, setVerificationHo] = useState('');
  const [isTestingVerification, setIsTestingVerification] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [verificationError, setVerificationError] = useState('');

  // (구)홍보확인서 테스트용 상태
  const [isTestingOldVerification, setIsTestingOldVerification] = useState(false);
  const [oldVerificationResult, setOldVerificationResult] = useState<any>(null);
  const [oldVerificationError, setOldVerificationError] = useState('');

  // 더미 데이터
  const dummyData = {
    myArticle: {
      articleNo: '2557864260',
      articleName: '고덕그라시움 5406동',
      dealOrWarrantPrc: '17억',
      floorInfo: '고/25',
      buildingName: '5406동',
      articleConfirmYmd: '2025.01.15',
    },
    myRanking: 5,
    myFloorExposed: false, // 내가 층수 노출 안함
    totalCount: 20,
    competingAds: [
      {
        articleNo: '2557864261',
        ranking: 2,
        price: '16억 5000',
        floorInfo: '12/25', // 층수 노출함!
        isFloorExposed: true,
        articleConfirmYmd: '2025.01.14',
        verificationTypeCode: 'OWNER',
      },
      {
        articleNo: '2557864262',
        ranking: 3,
        price: '17억 5000',
        floorInfo: '중/25', // 층수 노출 안함
        isFloorExposed: false,
        articleConfirmYmd: '2025.01.13',
        verificationTypeCode: 'AGENT',
      },
      {
        articleNo: '2557864263',
        ranking: 4,
        price: '16억 8000',
        floorInfo: '18/25', // 층수 노출함!
        isFloorExposed: true,
        articleConfirmYmd: '2025.01.12',
        verificationTypeCode: 'OWNER',
      },
    ],
    hasFloorExposureAdvantage: true, // 경쟁 광고가 층수 노출함
  };

  const handleFetchOffers = async () => {
    let unsubscribe: (() => void) | null = null;

    try {
      setIsLoading(true);
      setError('');
      setResult(null);
      setProgress('크롤링 시작 중...');

      // 진행 상황 수신
      unsubscribe = crawler.onProgress((p: any) => {
        setProgress(p.message);
      });

      // 크롤링 실행
      const response = await crawler.fetchOffers({
        includeRanking: false,
      });

      if (response.success) {
        setResult(response);
        setProgress(`✅ 완료! ${response.count}건 수집`);

        // DB 저장된 개수 확인
        const countResponse = await offersAPI.count();
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
      const response = await offersAPI.getAll();

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
      await crawler.cancel();
      setProgress('취소됨');
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleFetchSingleRank = async () => {
    if (!offerId.trim()) {
      setRankError('네이버 매물 ID를 입력해주세요');
      return;
    }

    try {
      setIsLoadingRank(true);
      setRankError('');
      setRankResult(null);

      const response = await crawler.fetchSingleRank(offerId.trim());

      if (response.success) {
        setRankResult(response.data);
      } else {
        setRankError(response.error || '랭킹 조회 실패');
      }
    } catch (err) {
      setRankError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoadingRank(false);
    }
  };

  const handleAnalyzeRanking = async () => {
    if (!analysisOfferId.trim()) {
      setAnalysisError('네이버 매물 ID를 입력해주세요');
      return;
    }

    try {
      setIsLoadingAnalysis(true);
      setAnalysisError('');
      setAnalysisResult(null);

      const response = await crawler.analyzeRanking(
        analysisOfferId.trim(),
        analysisBuilding.trim() || undefined,
        analysisPrice.trim() || undefined
      );

      if (response.success) {
        setAnalysisResult(response.data);
      } else {
        setAnalysisError(response.error || '랭킹 분석 실패');
      }
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoadingAnalysis(false);
    }
  };

  const handleRemoveAd = async () => {
    if (!removeOfferId.trim()) {
      setRemoveError('네이버 매물 ID를 입력해주세요 (예: 2557864260)');
      return;
    }

    try {
      setIsRemovingAd(true);
      setRemoveError('');
      setRemoveResult(null);

      console.log('🔽 광고 내리기 테스트 시작:', removeOfferId.trim());

      const response = await (window as any).adTest.removeAd(removeOfferId.trim());

      if (response.success) {
        setRemoveResult(response);
        console.log('✅ 광고 내리기 성공:', response);
      } else {
        setRemoveError(response.error || '광고 내리기 실패');
        console.error('❌ 광고 내리기 실패:', response);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setRemoveError(errorMessage);
      console.error('❌ 광고 내리기 오류:', err);
    } finally {
      setIsRemovingAd(false);
    }
  };

  const handleModifyPrice = async () => {
    if (!modifyOfferId.trim()) {
      setModifyError('네이버 매물 ID를 입력해주세요');
      return;
    }

    if (!modifyPrice.trim() && !modifyRent.trim()) {
      setModifyError('수정할 가격 또는 월세를 입력해주세요');
      return;
    }

    try {
      setIsModifyingPrice(true);
      setModifyError('');
      setModifyResult(null);

      console.log('💰 가격 수정 테스트 시작:', {
        numberN: modifyOfferId.trim(),
        modifiedPrice: modifyPrice.trim() || undefined,
        modifiedRent: modifyRent.trim() || undefined,
      });

      const response = await (window as any).adTest.modifyPrice({
        numberN: modifyOfferId.trim(),
        modifiedPrice: modifyPrice.trim() || undefined,
        modifiedRent: modifyRent.trim() || undefined,
      });

      if (response.success) {
        setModifyResult(response);
        console.log('✅ 가격 수정 성공:', response);
      } else {
        setModifyError(response.error || '가격 수정 실패');
        console.error('❌ 가격 수정 실패:', response);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setModifyError(errorMessage);
      console.error('❌ 가격 수정 오류:', err);
    } finally {
      setIsModifyingPrice(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">크롤러 테스트</h1>

      {/* 더미 데이터 미리보기 섹션 */}
      <div className="space-y-4 mb-8 pb-8 border-b">
        <h2 className="text-xl font-semibold">📊 경쟁 광고 분석 미리보기 (더미 데이터)</h2>
        <div className="border rounded-lg p-4 bg-blue-50">
          <h3 className="font-bold mb-4 text-lg">분석 결과 예시</h3>

          {/* 내 광고 정보 */}
          <div className="mb-4 p-3 bg-white rounded border">
            <h4 className="font-semibold mb-2 text-sm">내 광고 정보</h4>
            <div className="text-xs space-y-1">
              <div><strong>랭킹:</strong> {dummyData.myRanking} / {dummyData.totalCount}</div>
              <div><strong>매물명:</strong> {dummyData.myArticle.articleName}</div>
              <div><strong>가격:</strong> {dummyData.myArticle.dealOrWarrantPrc}</div>
              <div className="flex items-center gap-2">
                <strong>층수 노출:</strong>
                {dummyData.myFloorExposed ? (
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                    노출됨
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                    노출 안됨
                  </span>
                )}
              </div>
              <div><strong>층 정보:</strong> {dummyData.myArticle.floorInfo}</div>
            </div>
          </div>

          {/* 경쟁 광고 리스트 */}
          {dummyData.competingAds && dummyData.competingAds.length > 0 && (
            <div className="mb-4 p-3 bg-white rounded border">
              <h4 className="font-semibold mb-2 text-sm">
                경쟁 광고 ({dummyData.competingAds.length}건)
                {dummyData.hasFloorExposureAdvantage && (
                  <span className="ml-2 text-xs text-orange-600 font-normal">
                    ⚠️ 경쟁 광고 중 층수를 노출한 광고가 있습니다
                  </span>
                )}
              </h4>
              <div className="space-y-2">
                {dummyData.competingAds.map((ad, idx) => (
                  <div key={ad.articleNo} className="text-xs p-2 bg-gray-50 rounded border">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">#{idx + 1}</span>
                      <span>랭킹: {ad.ranking}</span>
                      <span>가격: {ad.price}</span>
                      <span>층: {ad.floorInfo}</span>
                      {ad.isFloorExposed && (
                        <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">
                          층수 노출
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-gray-600">등록일: {ad.articleConfirmYmd}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 분석 요약 */}
          <div className="p-3 bg-yellow-50 border border-yellow-300 rounded">
            <p className="font-semibold text-yellow-800 mb-2">💡 분석 요약</p>
            <ul className="text-xs space-y-1 text-yellow-900">
              <li>• 내 광고는 5위 / 20개 중입니다</li>
              <li>• 나보다 순위가 높은 경쟁 광고 3건이 있습니다 (같은 건물, 다른 가격)</li>
              <li>• 내 광고는 층수를 노출하지 않았습니다 (고/25)</li>
              <li>• 경쟁 광고 중 2건이 층수를 숫자로 노출하고 있습니다!</li>
              <li className="font-semibold text-orange-700">⚠️ 제안: 층수 노출을 고려해보세요 (12/25 형식)</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 매물 크롤링 섹션 */}
      <div className="space-y-4 mb-8">
        <h2 className="text-xl font-semibold">매물 크롤링</h2>
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

      {/* 네이버 랭킹 조회 섹션 */}
      <div className="space-y-4 mb-8 pb-8 border-b">
        <h2 className="text-xl font-semibold">네이버 매물 랭킹 조회</h2>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-2">네이버 매물 ID (numberN)</label>
            <Input
              type="text"
              placeholder="예: 2510629479"
              value={offerId}
              onChange={(e) => setOfferId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleFetchSingleRank();
                }
              }}
              disabled={isLoadingRank}
            />
          </div>
          <Button
            onClick={handleFetchSingleRank}
            disabled={isLoadingRank || !offerId.trim()}
          >
            {isLoadingRank ? '조회 중...' : '랭킹 조회'}
          </Button>
        </div>

        {rankError && (
          <div className="p-4 bg-red-50 rounded-lg text-red-700">
            <p className="font-medium">오류:</p>
            <p>{rankError}</p>
          </div>
        )}

        {rankResult && (
          <div className="border rounded-lg p-4 bg-green-50">
            <h3 className="font-bold mb-4 text-lg">랭킹 정보</h3>
            <div className="space-y-2">
              <p><strong>순위:</strong> {rankResult.ranking}</p>
              <p><strong>공유 순위:</strong> {rankResult.sharedRank}</p>
              <p><strong>공유 여부:</strong> {rankResult.isShared ? '예' : '아니오'}</p>
              <p><strong>공유 개수:</strong> {rankResult.sharedCount}</p>
              <p><strong>전체 매물 수:</strong> {rankResult.total}</p>
              <p><strong>확인일:</strong> {rankResult.articleConfirmYmd}</p>
            </div>
          </div>
        )}
      </div>

      {/* 랭킹 분석 섹션 */}
      <div className="space-y-4 mb-8 pb-8 border-b">
        <h2 className="text-xl font-semibold">네이버 랭킹 분석 (경쟁 광고 비교)</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">네이버 매물 ID (필수)</label>
            <Input
              type="text"
              placeholder="예: 2557864260"
              value={analysisOfferId}
              onChange={(e) => setAnalysisOfferId(e.target.value)}
              disabled={isLoadingAnalysis}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">동/건물명 (선택)</label>
            <Input
              type="text"
              placeholder="예: 5406동"
              value={analysisBuilding}
              onChange={(e) => setAnalysisBuilding(e.target.value)}
              disabled={isLoadingAnalysis}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">내 가격 (선택)</label>
            <Input
              type="text"
              placeholder="예: 17억"
              value={analysisPrice}
              onChange={(e) => setAnalysisPrice(e.target.value)}
              disabled={isLoadingAnalysis}
            />
          </div>
        </div>
        <Button
          onClick={handleAnalyzeRanking}
          disabled={isLoadingAnalysis || !analysisOfferId.trim()}
        >
          {isLoadingAnalysis ? '분석 중...' : '랭킹 분석'}
        </Button>

        {analysisError && (
          <div className="p-4 bg-red-50 rounded-lg text-red-700">
            <p className="font-medium">오류:</p>
            <p>{analysisError}</p>
          </div>
        )}

        {analysisResult && (
          <div className="border rounded-lg p-4 bg-blue-50">
            <h3 className="font-bold mb-4 text-lg">분석 결과</h3>

            {/* 내 광고 정보 */}
            <div className="mb-4 p-3 bg-white rounded">
              <h4 className="font-semibold mb-2">내 광고</h4>
              {analysisResult.myArticle ? (
                <div className="space-y-1 text-sm">
                  <p><strong>매물명:</strong> {analysisResult.myArticle.articleName}</p>
                  <p><strong>순위:</strong> {analysisResult.myRanking}/{analysisResult.totalCount}</p>
                  <p><strong>가격:</strong> {analysisResult.myArticle.dealOrWarrantPrc}</p>
                  <p><strong>층:</strong> {analysisResult.myArticle.floorInfo}</p>
                  <p><strong>동:</strong> {analysisResult.myArticle.buildingName || '-'}</p>
                  <p><strong>등록일:</strong> {analysisResult.myArticle.articleConfirmYmd}</p>
                </div>
              ) : (
                <p className="text-red-600">내 광고를 찾을 수 없습니다.</p>
              )}
            </div>

            {/* 경쟁 광고 리스트 */}
            {analysisResult.competingAds && analysisResult.competingAds.length > 0 ? (
              <div className="mb-4">
                <h4 className="font-semibold mb-2">
                  나보다 앞선 경쟁 광고 ({analysisResult.competingAds.length}개)
                </h4>
                <div className="space-y-2">
                  {analysisResult.competingAds.map((ad: any, index: number) => (
                    <div
                      key={index}
                      className={`p-3 rounded ${ad.isFloorExposed ? 'bg-yellow-50 border border-yellow-300' : 'bg-white'}`}
                    >
                      <div className="grid grid-cols-4 gap-2 text-sm">
                        <div><strong>순위:</strong> {ad.ranking}</div>
                        <div><strong>가격:</strong> {ad.price}</div>
                        <div><strong>층:</strong> {ad.floorInfo}</div>
                        <div><strong>등록일:</strong> {ad.articleConfirmYmd}</div>
                      </div>
                      {ad.isFloorExposed && (
                        <p className="text-xs text-yellow-700 mt-1">
                          ⚠️ 이 광고는 층수를 숫자로 노출하고 있습니다!
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-green-50 rounded">
                <p className="text-green-700">✅ 나보다 앞선 경쟁 광고가 없습니다!</p>
              </div>
            )}

            {/* 층수 노출 우위 경고 */}
            {analysisResult.hasFloorExposureAdvantage && (
              <div className="p-3 bg-orange-50 border border-orange-300 rounded">
                <p className="font-semibold text-orange-700">
                  💡 제안: 다른 광고들이 층수를 노출하고 있습니다. 층수 노출을 고려해보세요!
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 가격 수정 테스트 섹션 */}
      <div className="space-y-4 mb-8 pb-8 border-b">
        <h2 className="text-xl font-semibold">💰 가격 수정 테스트</h2>
        <div className="text-sm text-gray-600 mb-4">
          <p>이실장 사이트에서 단일 매물의 가격을 수정하는 기능을 테스트합니다.</p>
          <p className="text-orange-600 font-medium mt-1">
            ⚠️ 실제로 가격이 수정되므로 테스트용 매물 번호를 사용하세요!
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">네이버 매물 ID (numberN)</label>
            <Input
              type="text"
              placeholder="예: 2557864260"
              value={modifyOfferId}
              onChange={(e) => setModifyOfferId(e.target.value)}
              disabled={isModifyingPrice}
            />
            <p className="text-xs text-gray-500 mt-1">광고 진행 중인 매물 번호</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">수정할 가격 (만원)</label>
            <Input
              type="text"
              placeholder="예: 170000 (콤마 없이)"
              value={modifyPrice}
              onChange={(e) => setModifyPrice(e.target.value)}
              disabled={isModifyingPrice}
            />
            <p className="text-xs text-gray-500 mt-1">매매가/전세가/보증금</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">수정할 월세 (만원, 선택)</label>
            <Input
              type="text"
              placeholder="예: 65 (월세인 경우)"
              value={modifyRent}
              onChange={(e) => setModifyRent(e.target.value)}
              disabled={isModifyingPrice}
            />
            <p className="text-xs text-gray-500 mt-1">월세만 해당</p>
          </div>
        </div>

        <Button
          onClick={handleModifyPrice}
          disabled={isModifyingPrice || !modifyOfferId.trim()}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {isModifyingPrice ? '가격 수정 중...' : '가격 수정 실행'}
        </Button>

        {modifyError && (
          <div className="p-4 bg-red-50 rounded-lg text-red-700 border border-red-200">
            <p className="font-medium">❌ 오류 발생:</p>
            <p className="mt-1">{modifyError}</p>
          </div>
        )}

        {modifyResult && (
          <div className="border rounded-lg p-4 bg-green-50 border-green-200">
            <h3 className="font-bold mb-3 text-lg text-green-800">✅ 가격 수정 성공!</h3>
            <div className="space-y-2 text-sm">
              <p><strong>매물 ID:</strong> {modifyOfferId}</p>
              {modifyPrice && <p><strong>수정한 가격:</strong> {modifyPrice}만원</p>}
              {modifyRent && <p><strong>수정한 월세:</strong> {modifyRent}만원</p>}
              <p><strong>처리 시간:</strong> {new Date().toLocaleString()}</p>
              {modifyResult.message && (
                <p><strong>메시지:</strong> {modifyResult.message}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* (신)홍보확인서 테스트 섹션 */}
      <div className="space-y-4 mb-8 pb-8 border-b">
        <h2 className="text-xl font-semibold">📎 (신)홍보확인서 파일 업로드 테스트</h2>
        <div className="text-sm text-gray-600 mb-4">
          <p>이실장 사이트에서 (신)홍보확인서 파일 업로드 기능을 테스트합니다.</p>
          <p className="text-blue-600 font-medium mt-1">
            ℹ️ ad_list 페이지에서 대기 후, 수동으로 광고하기 버튼 클릭 시 파일 업로드 진행
          </p>
          <p className="text-green-600 font-medium mt-1">
            ✅ 테스트 모드: naverSendSave 버튼은 클릭하지 않습니다
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">매물명 (필수)</label>
            <Input
              type="text"
              placeholder="예: 고덕그라시움"
              value={verificationName}
              onChange={(e) => setVerificationName(e.target.value)}
              disabled={isTestingVerification}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">동 (선택)</label>
            <Input
              type="text"
              placeholder="예: 103"
              value={verificationDong}
              onChange={(e) => setVerificationDong(e.target.value)}
              disabled={isTestingVerification}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">호 (선택)</label>
            <Input
              type="text"
              placeholder="예: 704"
              value={verificationHo}
              onChange={(e) => setVerificationHo(e.target.value)}
              disabled={isTestingVerification}
            />
          </div>
        </div>

        <Button
          onClick={async () => {
            if (!verificationName.trim()) {
              setVerificationError('매물명을 입력해주세요');
              return;
            }

            try {
              setIsTestingVerification(true);
              setVerificationError('');
              setVerificationResult(null);

              console.log('📎 (신)홍보확인서 테스트 시작:', {
                name: verificationName.trim(),
                dong: verificationDong.trim() || undefined,
                ho: verificationHo.trim() || undefined,
              });

              const response = await (window as any).adTest.testNewVerification({
                name: verificationName.trim(),
                dong: verificationDong.trim() || undefined,
                ho: verificationHo.trim() || undefined,
              });

              if (response.success) {
                setVerificationResult(response);
                console.log('✅ (신)홍보확인서 테스트 성공:', response);
              } else {
                setVerificationError(response.error || '테스트 실패');
                console.error('❌ (신)홍보확인서 테스트 실패:', response);
              }
            } catch (err) {
              const errorMessage = err instanceof Error ? err.message : String(err);
              setVerificationError(errorMessage);
              console.error('❌ (신)홍보확인서 테스트 오류:', err);
            } finally {
              setIsTestingVerification(false);
            }
          }}
          disabled={isTestingVerification || !verificationName.trim()}
          className="bg-purple-600 hover:bg-purple-700"
        >
          {isTestingVerification ? '테스트 진행 중...' : '신홍보 테스트 시작'}
        </Button>

        {verificationError && (
          <div className="p-4 bg-red-50 rounded-lg text-red-700 border border-red-200">
            <p className="font-medium">❌ 오류 발생:</p>
            <p className="mt-1">{verificationError}</p>
          </div>
        )}

        {verificationResult && (
          <div className="border rounded-lg p-4 bg-green-50 border-green-200">
            <h3 className="font-bold mb-3 text-lg text-green-800">✅ 테스트 완료!</h3>
            <div className="space-y-2 text-sm">
              <p><strong>매물:</strong> {verificationName} {verificationDong && `${verificationDong}동`} {verificationHo && `${verificationHo}호`}</p>
              <p><strong>처리 시간:</strong> {new Date().toLocaleString()}</p>
              {verificationResult.message && (
                <p><strong>메시지:</strong> {verificationResult.message}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* (구)홍보확인서 테스트 섹션 */}
      <div className="space-y-4 mb-8 pb-8 border-b">
        <h2 className="text-xl font-semibold">✍️ (구)홍보확인서 전자 서명 테스트</h2>
        <div className="text-sm text-gray-600 mb-4">
          <p>이실장 사이트에서 (구)홍보확인서 전자 서명 기능을 테스트합니다.</p>
          <p className="text-blue-600 font-medium mt-1">
            ℹ️ ad_list 페이지에서 대기 후, 수동으로 (구)홍보확인서 매물의 광고하기 버튼 클릭
          </p>
          <p className="text-green-600 font-medium mt-1">
            ✅ 테스트 모드: 전자 서명만 진행하고 최종 제출은 하지 않습니다
          </p>
        </div>

        <Button
          onClick={async () => {
            try {
              setIsTestingOldVerification(true);
              setOldVerificationError('');
              setOldVerificationResult(null);

              console.log('✍️ (구)홍보확인서 전자 서명 테스트 시작');

              const response = await (window as any).adTest.testOldVerification();

              if (response.success) {
                setOldVerificationResult(response);
                console.log('✅ (구)홍보확인서 테스트 성공:', response);
              } else {
                setOldVerificationError(response.error || '테스트 실패');
                console.error('❌ (구)홍보확인서 테스트 실패:', response);
              }
            } catch (err) {
              const errorMessage = err instanceof Error ? err.message : String(err);
              setOldVerificationError(errorMessage);
              console.error('❌ (구)홍보확인서 테스트 오류:', err);
            } finally {
              setIsTestingOldVerification(false);
            }
          }}
          disabled={isTestingOldVerification}
          className="bg-orange-600 hover:bg-orange-700"
        >
          {isTestingOldVerification ? '테스트 진행 중...' : '구홍보 테스트 시작'}
        </Button>

        {oldVerificationError && (
          <div className="p-4 bg-red-50 rounded-lg text-red-700 border border-red-200">
            <p className="font-medium">❌ 오류 발생:</p>
            <p className="mt-1">{oldVerificationError}</p>
          </div>
        )}

        {oldVerificationResult && (
          <div className="border rounded-lg p-4 bg-green-50 border-green-200">
            <h3 className="font-bold mb-3 text-lg text-green-800">✅ 테스트 완료!</h3>
            <div className="space-y-2 text-sm">
              <p><strong>처리 시간:</strong> {new Date().toLocaleString()}</p>
              {oldVerificationResult.message && (
                <p><strong>메시지:</strong> {oldVerificationResult.message}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 광고 내리기 테스트 섹션 */}
      <div className="space-y-4 mb-8 pb-8 border-b">
        <h2 className="text-xl font-semibold">🔽 광고 내리기 테스트</h2>
        <div className="text-sm text-gray-600 mb-4">
          <p>이실장 사이트에서 단일 매물의 광고를 내리는 기능을 테스트합니다.</p>
          <p className="text-orange-600 font-medium mt-1">
            ⚠️ 실제로 광고가 내려지므로 테스트용 매물 번호를 사용하세요!
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">네이버 매물 ID (numberN)</label>
          <Input
            type="text"
            placeholder="예: 2557864260"
            value={removeOfferId}
            onChange={(e) => setRemoveOfferId(e.target.value)}
            disabled={isRemovingAd}
            className="max-w-md"
          />
          <p className="text-xs text-gray-500 mt-1">
            광고 진행 중 상태의 매물 번호를 입력하세요
          </p>
        </div>

        <Button
          onClick={handleRemoveAd}
          disabled={isRemovingAd || !removeOfferId.trim()}
          variant="destructive"
        >
          {isRemovingAd ? '광고 내리는 중...' : '광고 내리기 실행'}
        </Button>

        {removeError && (
          <div className="p-4 bg-red-50 rounded-lg text-red-700 border border-red-200">
            <p className="font-medium">❌ 오류 발생:</p>
            <p className="mt-1">{removeError}</p>
          </div>
        )}

        {removeResult && (
          <div className="border rounded-lg p-4 bg-green-50 border-green-200">
            <h3 className="font-bold mb-3 text-lg text-green-800">✅ 광고 내리기 성공!</h3>
            <div className="space-y-2 text-sm">
              <p><strong>매물 ID:</strong> {removeOfferId}</p>
              <p><strong>처리 시간:</strong> {new Date().toLocaleString()}</p>
              {removeResult.message && (
                <p><strong>메시지:</strong> {removeResult.message}</p>
              )}
            </div>
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
