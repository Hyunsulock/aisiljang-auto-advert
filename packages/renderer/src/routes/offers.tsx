import { createRoute, useNavigate } from '@tanstack/react-router';
import type { AnyRootRoute } from '@tanstack/react-router';
import { Button } from '../components/ui/button';
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  getExpandedRowModel,
} from '@tanstack/react-table';
import { RefreshCw, Package, ChevronDown, Filter, Search } from 'lucide-react';
import { type Offer, type CompetingAd, useOfferColumns, fuzzyFilter, parsePrice } from '../components/offers/columns';
import { getPropertyOwnerInfo, syncSessionToMain, type PropertyOwnerInfo } from '../lib/supabase';
import { PropertyOwnerDialog, type PropertyOwnerFormData, type PropertyOwnerFiles } from '../components/offers/PropertyOwnerDialog';
import { offers as offersAPI, crawler } from '@app/preload';

function OffersPage() {
  const navigate = useNavigate();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(false);
  const [crawling, setCrawling] = useState(false);
  const [progress, setProgress] = useState('');
  const [rowSelection, setRowSelection] = useState({});
  const [expanded, setExpanded] = useState({});
  const [modifiedPrices, setModifiedPrices] = useState<Record<number, { price?: string; rent?: string; floorExposure?: boolean }>>({});
  const [shouldReAdvertise, setShouldReAdvertise] = useState<Record<number, boolean>>({});
  const [filterExpanded, setFilterExpanded] = useState(true);
  const [showOnlySelected, setShowOnlySelected] = useState(false);

  // 필터 상태
  const [filterName, setFilterName] = useState('');
  const [filterDong, setFilterDong] = useState('');
  const [filterHo, setFilterHo] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterDealType, setFilterDealType] = useState('');
  const [filterAdMethod, setFilterAdMethod] = useState('');
  const [filterPyeongMin, setFilterPyeongMin] = useState<number | null>(null);
  const [filterPyeongMax, setFilterPyeongMax] = useState<number | null>(null);
  const [filterPriceMin, setFilterPriceMin] = useState<number | null>(null);
  const [filterPriceMax, setFilterPriceMax] = useState<number | null>(null);

  // 소유자 정보
  const [ownerInfoMap, setOwnerInfoMap] = useState<Map<string, PropertyOwnerInfo>>(new Map());
  const [selectedProperty, setSelectedProperty] = useState<{ name: string; dong: string | null; ho: string | null } | null>(null);
  const [isOwnerDialogOpen, setIsOwnerDialogOpen] = useState(false);

  // 스케줄 설정
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  // 기본값: 오늘 날짜
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };
  const [scheduleDate, setScheduleDate] = useState(getTodayDate());
  const [scheduleTime, setScheduleTime] = useState('');

  useEffect(() => {
    loadOffers();
  }, []);

  const loadOffers = async () => {
    try {
      setLoading(true);
      const response = await offersAPI.getAll();
      if (response.success) {
        setOffers(response.data);

        // 소유자 정보 가져오기 (로켓등록 및 (구)홍보확인서 제외)
        const nonRocketOffers = response.data.filter((o: Offer) =>
          !o.adMethod?.includes('로켓') && !o.adMethod?.includes('(구)홍보확인서')
        );
        if (nonRocketOffers.length > 0) {
          const ownerInfo = await getPropertyOwnerInfo(
            nonRocketOffers.map((o: Offer) => ({
              name: o.name,
              dong: o.dong,
              ho: o.ho,
            }))
          );
          setOwnerInfoMap(ownerInfo);
        } else {
          setOwnerInfoMap(new Map());
        }

        // 다음 조건에 해당하는 행 자동으로 펼치기:
        // 1. 경쟁 광고가 있고 (가격이 다르면서 나보다 순위 높음)
        // 2. 내가 층수 노출 안했는데 경쟁 광고가 노출했을 때
        const expandedRows: Record<string, boolean> = {};
        response.data.forEach((offer: Offer) => {
          const hasCompetingAds = offer.rankingAnalysis?.competingAds && offer.rankingAnalysis.competingAds.length > 0;
          const hasFloorAdvantage = offer.rankingAnalysis?.hasFloorExposureAdvantage;

          if (hasCompetingAds || hasFloorAdvantage) {
            expandedRows[String(offer.id)] = true;
          }
        });
        setExpanded(expandedRows);
      }
    } catch (error) {
      console.error('매물 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCrawl = async () => {
    try {
      setCrawling(true);
      setProgress('크롤링 시작 중...');

      const unsubscribe = crawler.onProgress((p: any) => {
        setProgress(p.message);
      });

      const response = await crawler.fetchOffers({
        includeRanking: true,
      });

      unsubscribe();

      if (response.success) {
        setProgress(`✅ 완료! ${response.count}건 수집`);
        await loadOffers();
        setTimeout(() => setProgress(''), 3000);
      } else {
        setProgress('❌ 실패: ' + response.error);
      }
    } catch (error) {
      setProgress('❌ 오류 발생');
      console.error(error);
    } finally {
      setCrawling(false);
    }
  };

  const handlePriceChange = useCallback((offerId: number, field: 'price' | 'rent', value: string) => {
    setModifiedPrices(prev => ({
      ...prev,
      [offerId]: {
        ...prev[offerId],
        [field]: value,
      }
    }));
  }, []);

  const handleFloorExposureToggle = useCallback((offerId: number, newFloorExposure: boolean, originalFloorExposure: boolean) => {
    setModifiedPrices(prev => {
      const current = prev[offerId] || {};

      // 원래 값과 같아지면 floorExposure 속성만 제거
      if (newFloorExposure === originalFloorExposure) {
        const { floorExposure, ...rest } = current;
        return {
          ...prev,
          [offerId]: rest,
        };
      }

      // 원래 값과 다르면 변경사항 저장
      return {
        ...prev,
        [offerId]: {
          ...current,
          floorExposure: newFloorExposure,
        }
      };
    });
  }, []);

  const handleReAdvertiseToggle = useCallback((offerId: number, checked: boolean) => {
    setShouldReAdvertise(prev => ({
      ...prev,
      [offerId]: checked,
    }));
  }, []);

  const handleOwnerInfoClick = useCallback((propertyName: string, dong: string | null, ho: string | null) => {
    setSelectedProperty({ name: propertyName, dong, ho });
    setIsOwnerDialogOpen(true);
  }, []);

  const handleOwnerDialogClose = useCallback(() => {
    setIsOwnerDialogOpen(false);
    setSelectedProperty(null);
  }, []);

  const handleOwnerInfoSave = useCallback(async (data: PropertyOwnerFormData, files: PropertyOwnerFiles) => {
    if (!selectedProperty) return;

    try {
      // Main 프로세스에 세션 동기화 (RLS 정책을 위해 필요)
      const sessionSynced = await syncSessionToMain();
      if (!sessionSynced) {
        alert('세션 동기화에 실패했습니다. 다시 로그인해주세요.');
        return;
      }

      // 기존 소유자 정보 가져오기
      const key = `${selectedProperty.name}|${selectedProperty.dong || ''}|${selectedProperty.ho || ''}`;
      const existingOwnerInfo = ownerInfoMap.get(key);

      // 파일 처리는 IPC 핸들러에서 처리하므로 파일 경로만 전달
      let documentFilePath: string | undefined;
      let powerOfAttorneyFilePath: string | undefined;

      // File 객체에서 경로 추출 (Electron에서는 file.path 사용 가능)
      if (files.document) {
        documentFilePath = (files.document as any).path;
      }

      if (files.powerOfAttorney) {
        powerOfAttorneyFilePath = (files.powerOfAttorney as any).path;
      }

      const response = await (window as any).propertyOwner.save(
        selectedProperty.name,
        selectedProperty.dong || '',
        selectedProperty.ho || '',
        {
          owner_type: data.ownerType,
          // 기존 파일 경로 유지 (새 파일이 없으면)
          document_file_path: existingOwnerInfo?.filePaths?.document || '',
          power_of_attorney_file_path: existingOwnerInfo?.filePaths?.powerOfAttorney || null,
        },
        documentFilePath,
        powerOfAttorneyFilePath
      );

      if (response.success) {
        alert('소유자 정보가 저장되었습니다');
        // 소유자 정보 다시 로드
        await loadOffers();
      } else {
        alert('저장 실패: ' + response.error);
      }
    } catch (error) {
      console.error('소유자 정보 저장 오류:', error);
      alert('저장 중 오류가 발생했습니다');
    }
  }, [selectedProperty, ownerInfoMap]);

  const handleOwnerInfoDelete = useCallback(async () => {
    if (!selectedProperty) return;

    try {
      const response = await (window as any).propertyOwner.delete(
        selectedProperty.name,
        selectedProperty.dong || '',
        selectedProperty.ho || ''
      );

      if (response.success) {
        alert('소유자 정보가 삭제되었습니다');
        // 소유자 정보 다시 로드
        await loadOffers();
      } else {
        alert('삭제 실패: ' + response.error);
      }
    } catch (error) {
      console.error('소유자 정보 삭제 오류:', error);
      alert('삭제 중 오류가 발생했습니다');
    }
  }, [selectedProperty]);

  const handleCreateBatch = async () => {
    try {
      // rowSelection에서 선택된 ID를 직접 가져오기 (필터 상관없이 모든 선택된 매물)
      const selectedOfferIds = Object.keys(rowSelection).map(id => Number(id));

      if (selectedOfferIds.length === 0) {
        alert('매물을 선택해주세요');
        return;
      }

      // 거래완료 매물 체크
      const selectedOffers = offers.filter(o => selectedOfferIds.includes(o.id));
      const completedOffers = selectedOffers.filter(o => o.adStatus === '거래완료');

      if (completedOffers.length > 0) {
        const completedNames = completedOffers.map(o => o.name).join(', ');
        const confirm = window.confirm(
          `⚠️ 거래완료된 매물이 ${completedOffers.length}건 포함되어 있습니다.\n\n` +
          `거래완료 매물: ${completedNames}\n\n` +
          `거래완료된 매물은 가격 변경 및 재광고가 불가능합니다.\n계속하시겠습니까?`
        );
        if (!confirm) {
          return;
        }
      }

      // (신)홍보확인서 매물의 서류 체크 (선택된 매물 중에서만)
      const newVerificationOffers = selectedOffers.filter(o => o.adMethod?.includes('(신)홍보확인서'));
      if (newVerificationOffers.length > 0) {
        const offersWithoutDocs: string[] = [];

        for (const offer of newVerificationOffers) {
          const key = `${offer.name}|${offer.dong || ''}|${offer.ho || ''}`;
          const ownerInfo = ownerInfoMap.get(key);

          // 서류 파일이 없으면 추가
          if (!ownerInfo?.filePaths?.document) {
            offersWithoutDocs.push(`${offer.name} ${offer.dong ? `${offer.dong}동` : ''} ${offer.ho ? `${offer.ho}호` : ''}`.trim());
          }
        }

        if (offersWithoutDocs.length > 0) {
          alert(
            `⚠️ (신)홍보확인서 매물 중 서류가 없는 매물이 있습니다.\n\n` +
            `서류 미등록 매물:\n${offersWithoutDocs.map(n => `• ${n}`).join('\n')}\n\n` +
            `(신)홍보확인서 매물은 반드시 서류(분양계약서/사업자등록증)가 필요합니다.\n` +
            `해당 매물의 소유자 정보에서 서류를 먼저 업로드해주세요.`
          );
          return;
        }
      }

      // 스케줄 설정 검증
      if (scheduleEnabled) {
        if (!scheduleDate || !scheduleTime) {
          alert('예약 실행을 활성화하려면 날짜와 시간을 모두 입력해주세요');
          return;
        }

        const scheduledDateTime = new Date(`${scheduleDate}T${scheduleTime}`);
        const now = new Date();

        if (scheduledDateTime <= now) {
          alert('예약 시간은 현재 시간보다 미래여야 합니다');
          return;
        }
      }

      setLoading(true);

      const offerIds = selectedOfferIds;
      const batchName = scheduleEnabled
        ? `광고 재등록 (예약: ${scheduleDate} ${scheduleTime})`
        : `광고 재등록 ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;

      // scheduledAt 계산
      let scheduledAt: Date | undefined;
      if (scheduleEnabled && scheduleDate && scheduleTime) {
        scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`);
      }

      const response = await (window as any).batch.create({
        name: batchName,
        offerIds,
        modifiedPrices,
        shouldReAdvertise,
        scheduledAt: scheduledAt?.toISOString(),
      });

      if (response.success) {
        const message = scheduleEnabled
          ? `배치 생성 완료!\n이름: ${batchName}\n매물: ${selectedOfferIds.length}건\n실행 예정: ${scheduleDate} ${scheduleTime}`
          : `배치 생성 완료!\n이름: ${batchName}\n매물: ${selectedOfferIds.length}건`;
        alert(message);
        setRowSelection({});
        setModifiedPrices({});
        setShouldReAdvertise({});
        setScheduleEnabled(false);
        setScheduleDate('');
        setScheduleTime('');
        // 배치 관리 페이지로 이동
        navigate({ to: '/batches' });
      } else {
        alert('배치 생성 실패: ' + response.error);
      }
    } catch (error) {
      console.error('배치 생성 오류:', error);
      alert('배치 생성 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm('정말 모든 매물을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) {
      return;
    }

    try {
      setLoading(true);
      const response = await (window as any).offers.deleteAll();

      if (response.success) {
        alert('모든 매물이 삭제되었습니다');
        setOffers([]);
        setRowSelection({});
        setModifiedPrices({});
        setShouldReAdvertise({});
      } else {
        alert('삭제 실패: ' + response.error);
      }
    } catch (error) {
      console.error('매물 삭제 오류:', error);
      alert('삭제 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  // 평형 범위 계산 (전체 매물 기준)
  const pyeongRange = useMemo(() => {
    const pyeongs = offers
      .map(o => o.areaPyeong ? parseFloat(o.areaPyeong) : null)
      .filter((p): p is number => p !== null && !isNaN(p));

    if (pyeongs.length === 0) return { min: 0, max: 100 };

    const minPyeong = Math.floor(Math.min(...pyeongs));
    const maxPyeong = Math.ceil(Math.max(...pyeongs));

    return {
      min: minPyeong,
      max: maxPyeong,
    };
  }, [offers]);

  // 가격 범위 계산 (전체 매물 기준, 억 단위)
  const priceRange = useMemo(() => {
    const prices = offers
      .map(o => parsePrice(o.price))
      .filter((p): p is number => p !== null && !isNaN(p));

    if (prices.length === 0) return { min: 0, max: 100 };

    const minPrice = Math.floor(Math.min(...prices));
    const maxPrice = Math.ceil(Math.max(...prices));

    return {
      min: minPrice,
      max: maxPrice,
    };
  }, [offers]);

  // 평형 및 가격 필터 초기화 (매물이 처음 로드될 때만)
  useEffect(() => {
    if (offers.length > 0 && filterPyeongMin === null) {
      setFilterPyeongMin(pyeongRange.min);
      setFilterPyeongMax(pyeongRange.max);
      setFilterPriceMin(priceRange.min);
      setFilterPriceMax(priceRange.max);
    }
  }, [offers.length, pyeongRange, priceRange, filterPyeongMin]);

  // 필터링된 매물 목록 (useMemo로 최적화)
  const filteredOffers = useMemo(() => {
    return offers.filter(offer => {
      // 선택된 매물만 보기 필터
      if (showOnlySelected) {
        const isSelected = (rowSelection as Record<number, boolean>)[offer.id];
        if (!isSelected) {
          return false;
        }
      }

      if (filterName && !offer.name.toLowerCase().includes(filterName.toLowerCase())) {
        return false;
      }
      if (filterDong && !offer.dong?.toLowerCase().includes(filterDong.toLowerCase())) {
        return false;
      }
      if (filterHo && !offer.ho?.toLowerCase().includes(filterHo.toLowerCase())) {
        return false;
      }
      if (filterType && offer.type !== filterType) {
        return false;
      }
      if (filterDealType && offer.dealType !== filterDealType) {
        return false;
      }
      if (filterAdMethod && offer.adMethod !== filterAdMethod) {
        return false;
      }
      // 평형 범위 필터
      const pyeong = offer.areaPyeong ? parseFloat(offer.areaPyeong) : null;
      if (pyeong !== null && !isNaN(pyeong) && filterPyeongMin !== null && filterPyeongMax !== null) {
        if (pyeong < filterPyeongMin || pyeong > filterPyeongMax) {
          return false;
        }
      }
      // 가격 범위 필터 (억 단위)
      const price = parsePrice(offer.price);
      if (price !== null && !isNaN(price) && filterPriceMin !== null && filterPriceMax !== null) {
        if (price < filterPriceMin || price > filterPriceMax) {
          return false;
        }
      }
      return true;
    });
  }, [offers, showOnlySelected, rowSelection, filterName, filterDong, filterHo, filterType, filterDealType, filterAdMethod, filterPyeongMin, filterPyeongMax, filterPriceMin, filterPriceMax]);

  // 고유한 값들 추출 (드롭다운용)
  const uniqueTypes = useMemo(() => Array.from(new Set(offers.map(o => o.type))), [offers]);
  const uniqueDealTypes = useMemo(() => Array.from(new Set(offers.map(o => o.dealType))), [offers]);
  const uniqueAdMethods = useMemo(() => {
    const methods = offers.map(o => o.adMethod).filter((m): m is string => m !== null && m !== undefined);
    return Array.from(new Set(methods));
  }, [offers]);

  // 컬럼 정의
  const columns = useOfferColumns(handlePriceChange, shouldReAdvertise, handleReAdvertiseToggle);

  const table = useReactTable<Offer>({
    data: filteredOffers,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowId: (row) => String(row.id), // Use offer ID instead of index
    state: {
      rowSelection,
      expanded,
    },
    onRowSelectionChange: setRowSelection,
    onExpandedChange: setExpanded,
    enableRowSelection: true,
    filterFns: {
      fuzzy: fuzzyFilter,
    },
    meta: {
      modifiedPrices,
      handlePriceChange,
      ownerInfoMap,
      onOwnerInfoClick: handleOwnerInfoClick,
      onFloorExposureToggle: handleFloorExposureToggle,
    },
  });

  const selectedCount = Object.keys(rowSelection).length;

  const selectedOwnerInfo = selectedProperty
    ? ownerInfoMap.get(`${selectedProperty.name}|${selectedProperty.dong || ''}|${selectedProperty.ho || ''}`) || null
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-6 py-4 max-w-[1600px] mx-auto">

        {/* 통계 및 액션 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {/* 전체 매물 */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">전체 매물</p>
                  <p className="text-2xl font-bold text-gray-900">{offers.length}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Package className="text-blue-600" size={24} />
                </div>
              </div>
            </div>

            {/* 필터된 매물 */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">필터 적용</p>
                  <p className="text-2xl font-bold text-gray-900">{filteredOffers.length}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <RefreshCw className="text-green-600" size={24} />
                </div>
              </div>
            </div>

            {/* 선택된 매물 */}
            <button
              onClick={() => setShowOnlySelected(!showOnlySelected)}
              className={`bg-white p-4 rounded-xl shadow-sm border-2 transition-all ${
                showOnlySelected
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-100 hover:border-purple-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <p className="text-sm text-gray-600 mb-1">선택된 매물</p>
                  <p className="text-2xl font-bold text-gray-900">{selectedCount}</p>
                  {showOnlySelected && (
                    <p className="text-xs text-purple-600 mt-1 font-medium">필터 활성화됨</p>
                  )}
                </div>
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  showOnlySelected ? 'bg-purple-500' : 'bg-purple-100'
                }`}>
                  <Package className={showOnlySelected ? 'text-white' : 'text-purple-600'} size={24} />
                </div>
              </div>
            </button>

            {/* 크롤링 버튼 or 초기화 버튼 */}
            {offers.length === 0 ? (
              /* 크롤링 버튼 - 매물이 없을 때 */
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-4 rounded-xl shadow-sm">
                <Button
                  onClick={handleCrawl}
                  disabled={crawling}
                  className="w-full h-full flex flex-col items-center justify-center gap-2 bg-white/20 hover:bg-white/30 text-white border-0"
                >
                  <RefreshCw className={crawling ? 'animate-spin' : ''} size={24} />
                  <span className="font-semibold">{crawling ? '크롤링 중...' : '매물 크롤링'}</span>
                </Button>
              </div>
            ) : (
              /* 초기화 버튼 - 매물이 있을 때 */
              <div className="bg-gradient-to-br from-red-500 to-red-600 p-4 rounded-xl shadow-sm">
                <Button
                  onClick={handleDeleteAll}
                  disabled={loading || crawling}
                  className="w-full h-full flex flex-col items-center justify-center gap-2 bg-white/20 hover:bg-white/30 text-white border-0"
                >
                  <RefreshCw size={24} />
                  <span className="font-semibold">초기화</span>
                </Button>
              </div>
            )}
        </div>

        {/* 배치 생성 바 */}
        {selectedCount > 0 && (
          <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-5 rounded-xl shadow-lg mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-white">
                  <p className="text-sm opacity-90">선택한 매물</p>
                  <p className="text-3xl font-bold">{selectedCount}건</p>
                </div>
                <div className="h-14 w-px bg-white/30"></div>
                <label className="flex items-center gap-2 text-white text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={scheduleEnabled}
                    onChange={(e) => setScheduleEnabled(e.target.checked)}
                    className="cursor-pointer w-4 h-4 rounded"
                  />
                  예약 실행
                </label>
                {scheduleEnabled && (
                  <>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const today = new Date();
                          setScheduleDate(today.toISOString().split('T')[0]);
                        }}
                        className="px-3 py-1.5 text-xs bg-white/20 hover:bg-white/30 text-white rounded-lg transition font-medium"
                      >
                        오늘
                      </button>
                      <button
                        onClick={() => {
                          const tomorrow = new Date();
                          tomorrow.setDate(tomorrow.getDate() + 1);
                          setScheduleDate(tomorrow.toISOString().split('T')[0]);
                        }}
                        className="px-3 py-1.5 text-xs bg-white/20 hover:bg-white/30 text-white rounded-lg transition font-medium"
                      >
                        내일
                      </button>
                    </div>
                    <input
                      type="date"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      className="px-3 py-1.5 text-sm rounded-lg bg-white/20 text-white border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
                    />
                    <input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      className="px-3 py-1.5 text-sm rounded-lg bg-white/20 text-white border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
                    />
                  </>
                )}
              </div>
              <Button
                onClick={handleCreateBatch}
                disabled={loading}
                className="bg-white text-purple-600 hover:bg-gray-100 font-semibold px-6 py-2.5"
              >
                <Package size={18} className="mr-2" />
                배치 생성
              </Button>
            </div>
          </div>
        )}

        {/* 진행 상황 바 */}
        {progress && (
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4 rounded-xl shadow-sm mb-6">
            <div className="flex items-center gap-3 text-white">
              <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
              <span className="font-medium">{progress}</span>
            </div>
          </div>
        )}

        {/* 필터 */}
        {offers.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6 overflow-hidden">
            <button
              onClick={() => setFilterExpanded(!filterExpanded)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 transition-all duration-200"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                  <Filter className="text-white" size={20} />
                </div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-gray-900">필터</h3>
                  {filteredOffers.length < offers.length && (
                    <span className="px-2 py-0.5 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs font-medium rounded-full">
                      {filteredOffers.length} / {offers.length}
                    </span>
                  )}
                </div>
              </div>
              <ChevronDown
                className={`transition-transform duration-200 text-gray-600 ${filterExpanded ? 'rotate-180' : ''}`}
                size={20}
              />
            </button>
            {filterExpanded && (
              <div className="px-6 pb-6 pt-2 bg-gradient-to-b from-gray-50/50 to-white">
                {/* 텍스트 및 선택 필터 */}
                <div className="grid grid-cols-6 gap-3 mb-5">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-2">매물명</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="검색..."
                        value={filterName}
                        onChange={(e) => setFilterName(e.target.value)}
                        className="w-full h-10 pl-9 pr-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      />
                      <Search className="absolute left-2.5 top-2.5 text-gray-400" size={16} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-2">동</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="검색..."
                        value={filterDong}
                        onChange={(e) => setFilterDong(e.target.value)}
                        className="w-full h-10 pl-9 pr-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      />
                      <Search className="absolute left-2.5 top-2.5 text-gray-400" size={16} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-2">호</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="검색..."
                        value={filterHo}
                        onChange={(e) => setFilterHo(e.target.value)}
                        className="w-full h-10 pl-9 pr-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      />
                      <Search className="absolute left-2.5 top-2.5 text-gray-400" size={16} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-2">종류</label>
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
                    >
                      <option value="">전체</option>
                      {uniqueTypes.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-2">거래</label>
                    <select
                      value={filterDealType}
                      onChange={(e) => setFilterDealType(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
                    >
                      <option value="">전체</option>
                      {uniqueDealTypes.map(dealType => (
                        <option key={dealType} value={dealType}>{dealType}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-2">검증방식</label>
                    <select
                      value={filterAdMethod}
                      onChange={(e) => setFilterAdMethod(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
                    >
                      <option value="">전체</option>
                      {uniqueAdMethods.map(method => (
                        <option key={method} value={method}>{method}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 범위 필터 카드들 */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  {/* 평형 범위 필터 */}
                  <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-semibold text-gray-800">전용면적</label>
                      <span className="text-sm font-medium text-blue-600">
                        {filterPyeongMin ?? pyeongRange.min}평 ~ {filterPyeongMax ?? pyeongRange.max}평
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 font-medium">{pyeongRange.min}</span>
                      <div className="flex-1 relative h-6 flex items-center">
                        <div className="absolute w-full h-2 bg-gray-200 rounded-lg" />
                        <div
                          className="absolute h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg shadow-sm"
                          style={{
                            left: `${(((filterPyeongMin ?? pyeongRange.min) - pyeongRange.min) / (pyeongRange.max - pyeongRange.min)) * 100}%`,
                            right: `${100 - (((filterPyeongMax ?? pyeongRange.max) - pyeongRange.min) / (pyeongRange.max - pyeongRange.min)) * 100}%`,
                          }}
                        />
                        <input
                          type="range"
                          min={pyeongRange.min}
                          max={pyeongRange.max}
                          value={filterPyeongMin ?? pyeongRange.min}
                          onChange={(e) => {
                            const value = Number(e.target.value);
                            const maxVal = filterPyeongMax ?? pyeongRange.max;
                            if (value <= maxVal) {
                              setFilterPyeongMin(value);
                            }
                          }}
                          className="absolute w-full appearance-none bg-transparent cursor-pointer"
                          style={{ zIndex: 3 }}
                        />
                        <input
                          type="range"
                          min={pyeongRange.min}
                          max={pyeongRange.max}
                          value={filterPyeongMax ?? pyeongRange.max}
                          onChange={(e) => {
                            const value = Number(e.target.value);
                            const minVal = filterPyeongMin ?? pyeongRange.min;
                            if (value >= minVal) {
                              setFilterPyeongMax(value);
                            }
                          }}
                          className="absolute w-full appearance-none bg-transparent cursor-pointer"
                          style={{ zIndex: 4 }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 font-medium">{pyeongRange.max}</span>
                    </div>
                  </div>

                  {/* 가격 범위 필터 */}
                  <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-semibold text-gray-800">가격/보증금</label>
                      <span className="text-sm font-medium text-purple-600">
                        {filterPriceMin ?? priceRange.min}억 ~ {filterPriceMax ?? priceRange.max}억
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 font-medium">{priceRange.min}</span>
                      <div className="flex-1 relative h-6 flex items-center">
                        <div className="absolute w-full h-2 bg-gray-200 rounded-lg" />
                        <div
                          className="absolute h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg shadow-sm"
                          style={{
                            left: `${(((filterPriceMin ?? priceRange.min) - priceRange.min) / (priceRange.max - priceRange.min)) * 100}%`,
                            right: `${100 - (((filterPriceMax ?? priceRange.max) - priceRange.min) / (priceRange.max - priceRange.min)) * 100}%`,
                          }}
                        />
                        <input
                          type="range"
                          min={priceRange.min}
                          max={priceRange.max}
                          value={filterPriceMin ?? priceRange.min}
                          onChange={(e) => {
                            const value = Number(e.target.value);
                            const maxVal = filterPriceMax ?? priceRange.max;
                            if (value <= maxVal) {
                              setFilterPriceMin(value);
                            }
                          }}
                          className="absolute w-full appearance-none bg-transparent cursor-pointer"
                          style={{ zIndex: 3 }}
                        />
                        <input
                          type="range"
                          min={priceRange.min}
                          max={priceRange.max}
                          value={filterPriceMax ?? priceRange.max}
                          onChange={(e) => {
                            const value = Number(e.target.value);
                            const minVal = filterPriceMin ?? priceRange.min;
                            if (value >= minVal) {
                              setFilterPriceMax(value);
                            }
                          }}
                          className="absolute w-full appearance-none bg-transparent cursor-pointer"
                          style={{ zIndex: 4 }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 font-medium">{priceRange.max}</span>
                    </div>
                  </div>
                </div>

                {/* 필터 초기화 버튼 */}
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      setFilterName('');
                      setFilterDong('');
                      setFilterHo('');
                      setFilterType('');
                      setFilterDealType('');
                      setFilterAdMethod('');
                      setFilterPyeongMin(pyeongRange.min);
                      setFilterPyeongMax(pyeongRange.max);
                      setFilterPriceMin(priceRange.min);
                      setFilterPriceMax(priceRange.max);
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                  >
                    <RefreshCw size={16} />
                    필터 초기화
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 테이블 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 sticky top-0 z-10">
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th
                      key={header.id}
                      className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider"
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-500">
                    로딩 중...
                  </td>
                </tr>
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-500">
                    매물이 없습니다. 크롤링 버튼을 눌러 매물을 가져오세요.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map(row => {
                  const isExpanded = row.getIsExpanded();
                  const analysisData = row.original.rankingAnalysis;
                  const isCompleted = row.original.adStatus === '거래완료';

                  return (
                    <>
                      <tr
                        key={row.id}
                        className={`transition-colors ${
                          isCompleted
                            ? 'bg-red-200 hover:bg-red-300'
                            : 'hover:bg-blue-50/50'
                        }`}
                      >
                        {row.getVisibleCells().map(cell => (
                          <td key={cell.id} className="px-6 py-4 text-sm text-gray-900">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                      {isExpanded && (
                        <tr key={`${row.id}-expanded`}>
                          <td colSpan={columns.length} className="px-6 py-6 bg-gradient-to-br from-blue-50 to-purple-50">
                            {!analysisData ? (
                              <div className="flex items-center justify-center">
                                <p className="text-sm text-gray-500">
                                  경쟁 광고 분석 데이터가 없습니다. 크롤링 시 includeRanking 옵션을 활성화해주세요.
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <div className="bg-white p-3 rounded border">
                                  <h4 className="font-semibold mb-2 text-sm">내 광고 정보</h4>
                                  {analysisData.myRanking ? (
                                    <div className="text-xs space-y-1">
                                      <div><strong>랭킹:</strong> {analysisData.myRanking} / {analysisData.totalCount}</div>
                                      <div><strong>가격:</strong> {row.original.price}</div>
                                      <div className="flex items-center gap-2">
                                        <strong>층수 노출:</strong>
                                        {analysisData.myFloorExposed ? (
                                          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                                            노출됨
                                          </span>
                                        ) : (
                                          <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                                            노출 안됨
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-xs text-red-600">랭킹 정보를 찾을 수 없습니다</p>
                                  )}
                                </div>

                                {analysisData.competingAds && analysisData.competingAds.length > 0 ? (
                                  <div className="bg-white p-3 rounded border">
                                    <h4 className="font-semibold mb-2 text-sm">
                                      경쟁 광고 ({analysisData.competingAds.length}건)
                                      {analysisData.competingAds.length > 5 && (
                                        <span className="ml-2 text-xs text-gray-500 font-normal">
                                          - 상위 5개만 표시
                                        </span>
                                      )}
                                      {analysisData.hasFloorExposureAdvantage && (() => {
                                        const exposedAd = analysisData.competingAds.find((ad: CompetingAd) => ad.isFloorExposed);
                                        const floorNumber = exposedAd?.floorInfo.split('/')[0] || '';
                                        return (
                                          <span className="ml-2 text-xs text-orange-600 font-normal">
                                            ⚠️ 경쟁 광고 중 층수를 노출한 광고가 있습니다 (예: {floorNumber}층)
                                          </span>
                                        );
                                      })()}
                                    </h4>
                                    <div className="space-y-2">
                                      {analysisData.competingAds.slice(0, 5).map((ad: CompetingAd, idx: number) => {
                                        // 내 랭킹보다 높은지 확인
                                        const isHigherRanking = ad.ranking < (analysisData.myRanking || Infinity);

                                        return (
                                          <div
                                            key={ad.articleNo}
                                            className={`text-xs p-2 rounded border ${
                                              isHigherRanking ? 'bg-red-50 border-red-200' : 'bg-gray-50'
                                            }`}
                                          >
                                            <div className="flex items-center gap-2 mb-1">
                                              <span className="font-semibold">#{idx + 1}</span>
                                              <span>랭킹: {ad.ranking}</span>
                                              <span>가격: {ad.price}</span>
                                              <span>층: {ad.floorInfo}</span>
                                              <span className="text-gray-500">노출일: {ad.articleConfirmYmd}</span>
                                              {ad.isPriceLower && (
                                                <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">
                                                  가격낮음
                                                </span>
                                              )}
                                              {ad.isPriceHigher && (
                                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                                                  가격높음
                                                </span>
                                              )}
                                              {!analysisData.myFloorExposed && ad.isFloorExposed && (
                                                <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">
                                                  층수 노출
                                                </span>
                                              )}
                                            </div>
                                            <div className="text-gray-600 text-xs">
                                              부동산: {ad.realtorName}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="bg-white p-3 rounded border">
                                    <p className="text-xs text-green-600">
                                      경쟁 광고가 없습니다 (같은 건물에 더 높은 순위의 다른 가격 광고가 없음)
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })
              )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 소유자 정보 다이얼로그 */}
      {selectedProperty && (
        <PropertyOwnerDialog
          isOpen={isOwnerDialogOpen}
          onClose={handleOwnerDialogClose}
          propertyName={selectedProperty.name}
          dong={selectedProperty.dong}
          ho={selectedProperty.ho}
          ownerInfo={selectedOwnerInfo}
          onSave={handleOwnerInfoSave}
          onDelete={handleOwnerInfoDelete}
        />
      )}
    </div>
  );
};

export default (parentRoute: AnyRootRoute) =>
  createRoute({
    path: '/offers',
    component: OffersPage,
    getParentRoute: () => parentRoute,
  });
