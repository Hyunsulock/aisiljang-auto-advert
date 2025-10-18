import { createRoute, useNavigate } from '@tanstack/react-router';
import type { AnyRootRoute } from '@tanstack/react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import { RefreshCw, Package } from 'lucide-react';

interface Offer {
  id: number;
  numberN: string;
  numberA: string;
  type: string;
  name: string;
  dong: string | null;
  ho: string | null;
  address: string;
  dealType: string;
  price: string;
  rent: string | null;
  adStatus: string;
  adChannel: string | null;
  adMethod: string | null;
  adStartDate: string | null;
  adEndDate: string | null;
  areaPrivate: string | null;
  areaPyeong: string | null;
  dateRange: string | null;
}

const columnHelper = createColumnHelper<Offer>();

// Fuzzy filter function for TanStack Table
const fuzzyFilter = (row: any, columnId: string, value: any, addMeta: any) => {
  const itemValue = row.getValue(columnId);
  return String(itemValue).toLowerCase().includes(String(value).toLowerCase());
};

// 가격 문자열을 억 단위 숫자로 변환 (예: "10억" -> 10, "5억 5000" -> 5.5, "5000" -> 0.5)
const parsePrice = (priceStr: string | null): number | null => {
  if (!priceStr) return null;

  const cleaned = priceStr.replace(/[,\s]/g, '');

  // "10억" 형식
  const eokMatch = cleaned.match(/(\d+(?:\.\d+)?)억/);
  if (eokMatch) {
    const eok = parseFloat(eokMatch[1]);
    // "10억5000" 같은 형식 처리
    const manMatch = cleaned.match(/억(\d+)/);
    if (manMatch) {
      const man = parseFloat(manMatch[1]);
      return eok + (man / 10000);
    }
    return eok;
  }

  // "5000만원" 또는 "5000" 형식 (만원 단위)
  const manMatch = cleaned.match(/(\d+)만?원?/);
  if (manMatch) {
    return parseFloat(manMatch[1]) / 10000;
  }

  // 숫자만 있는 경우 (만원으로 가정)
  const numMatch = cleaned.match(/^(\d+)$/);
  if (numMatch) {
    return parseFloat(numMatch[1]) / 10000;
  }

  return null;
};

function OffersPage() {
  const navigate = useNavigate();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(false);
  const [crawling, setCrawling] = useState(false);
  const [progress, setProgress] = useState('');
  const [rowSelection, setRowSelection] = useState({});
  const [modifiedPrices, setModifiedPrices] = useState<Record<number, { price: string; rent?: string }>>({});

  // 필터 상태
  const [filterName, setFilterName] = useState('');
  const [filterDong, setFilterDong] = useState('');
  const [filterHo, setFilterHo] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterDealType, setFilterDealType] = useState('');
  const [filterAdMethod, setFilterAdMethod] = useState('');
  const [filterPyeongMin, setFilterPyeongMin] = useState<number>(0);
  const [filterPyeongMax, setFilterPyeongMax] = useState<number>(100);
  const [filterPriceMin, setFilterPriceMin] = useState<number>(0);
  const [filterPriceMax, setFilterPriceMax] = useState<number>(100);

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
      const response = await (window as any).offers.getAll();
      if (response.success) {
        setOffers(response.data);
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

      const unsubscribe = (window as any).crawler.onProgress((p: any) => {
        setProgress(p.message);
      });

      const response = await (window as any).crawler.fetchOffers({
        includeRanking: false,
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

  const handleCreateBatch = async () => {
    try {
      const selectedRows = table.getSelectedRowModel().rows;
      if (selectedRows.length === 0) {
        alert('매물을 선택해주세요');
        return;
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

      const offerIds = selectedRows.map(row => row.original.id);
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
        scheduledAt: scheduledAt?.toISOString(),
      });

      if (response.success) {
        const message = scheduleEnabled
          ? `배치 생성 완료!\n이름: ${batchName}\n매물: ${selectedRows.length}건\n실행 예정: ${scheduleDate} ${scheduleTime}`
          : `배치 생성 완료!\n이름: ${batchName}\n매물: ${selectedRows.length}건`;
        alert(message);
        setRowSelection({});
        setModifiedPrices({});
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

  // 평형 필터 초기화
  useEffect(() => {
    setFilterPyeongMin(pyeongRange.min);
    setFilterPyeongMax(pyeongRange.max);
  }, [pyeongRange]);

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

  // 가격 필터 초기화
  useEffect(() => {
    setFilterPriceMin(priceRange.min);
    setFilterPriceMax(priceRange.max);
  }, [priceRange]);

  // 필터링된 매물 목록 (useMemo로 최적화)
  const filteredOffers = useMemo(() => {
    return offers.filter(offer => {
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
      if (pyeong !== null && !isNaN(pyeong)) {
        if (pyeong < filterPyeongMin || pyeong > filterPyeongMax) {
          return false;
        }
      }
      // 가격 범위 필터 (억 단위)
      const price = parsePrice(offer.price);
      if (price !== null && !isNaN(price)) {
        if (price < filterPriceMin || price > filterPriceMax) {
          return false;
        }
      }
      return true;
    });
  }, [offers, filterName, filterDong, filterHo, filterType, filterDealType, filterAdMethod, filterPyeongMin, filterPyeongMax, filterPriceMin, filterPriceMax]);

  // 고유한 값들 추출 (드롭다운용)
  const uniqueTypes = useMemo(() => Array.from(new Set(offers.map(o => o.type))), [offers]);
  const uniqueDealTypes = useMemo(() => Array.from(new Set(offers.map(o => o.dealType))), [offers]);
  const uniqueAdMethods = useMemo(() => {
    const methods = offers.map(o => o.adMethod).filter((m): m is string => m !== null && m !== undefined);
    return Array.from(new Set(methods));
  }, [offers]);

  const columns = useMemo(() => [
    columnHelper.display({
      id: 'select',
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllRowsSelected()}
          onChange={table.getToggleAllRowsSelectedHandler()}
          className="cursor-pointer"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          className="cursor-pointer"
        />
      ),
    }),
    columnHelper.accessor('name', {
      header: '매물명',
      cell: info => (
        <div className="max-w-xs truncate" title={info.getValue()}>
          {info.getValue()}
        </div>
      ),
    }),
    columnHelper.accessor('dong', {
      header: '동',
      cell: info => info.getValue() || '-',
    }),
    columnHelper.accessor('ho', {
      header: '호',
      cell: info => info.getValue() || '-',
    }),
    columnHelper.accessor('type', {
      header: '종류',
      cell: info => info.getValue(),
    }),
    columnHelper.accessor('dealType', {
      header: '거래',
      cell: info => {
        const dealType = info.getValue();
        let bgClass = '';

        if (dealType === '매매') {
          bgClass = 'bg-blue-100 text-blue-700';
        } else if (dealType === '전세') {
          bgClass = 'bg-green-100 text-green-700';
        } else if (dealType === '월세') {
          bgClass = 'bg-orange-100 text-orange-700';
        }

        return (
          <span className={`inline-block px-2 py-1 rounded-md text-xs font-medium ${bgClass}`}>
            {dealType}
          </span>
        );
      },
    }),
    columnHelper.accessor('price', {
      header: '가격/보증금',
      cell: ({ row, table }) => {
        const offerId = row.original.id;
        const meta = table.options.meta as any;
        const modified = meta?.modifiedPrices?.[offerId];
        const isSelected = row.getIsSelected();
        return (
          <Input
            type="text"
            value={modified?.price ?? row.original.price}
            onChange={(e) => meta?.handlePriceChange?.(offerId, 'price', e.target.value)}
            disabled={!isSelected}
            className="w-24"
          />
        );
      },
    }),
    columnHelper.accessor('rent', {
      header: '월세',
      cell: ({ row, table }) => {
        if (!row.original.rent) return '-';
        const offerId = row.original.id;
        const meta = table.options.meta as any;
        const modified = meta?.modifiedPrices?.[offerId];
        const isSelected = row.getIsSelected();
        return (
          <Input
            type="text"
            value={modified?.rent ?? row.original.rent}
            onChange={(e) => meta?.handlePriceChange?.(offerId, 'rent', e.target.value)}
            disabled={!isSelected}
            className="w-24"
          />
        );
      },
    }),
    columnHelper.accessor('areaPyeong', {
      header: '전용면적',
      cell: ({ row }) => {
        const pyeong = row.original.areaPyeong;
        const sqm = row.original.areaPrivate;

        if (!pyeong && !sqm) return '-';

        return (
          <div className="text-sm">
            {pyeong && <div>{pyeong}평</div>}
            {sqm && <div className="text-xs text-gray-500">{sqm}㎡</div>}
          </div>
        );
      },
    }),
    columnHelper.accessor('adMethod', {
      header: '검증방식',
      cell: info => {
        const method = info.getValue();
        if (!method) return '-';

        let bgClass = '';
        if (method === '로켓등록') {
          bgClass = 'bg-purple-100 text-purple-700';
        } else if (method.includes('홍보확인서')) {
          bgClass = 'bg-pink-100 text-pink-700';
        }

        return (
          <span className={`inline-block px-2 py-1 rounded-md text-xs font-medium ${bgClass}`}>
            {method}
          </span>
        );
      },
    }),
    columnHelper.accessor('adStartDate', {
      header: '노출 시작일',
      cell: info => info.getValue() || '-',
    }),
    columnHelper.accessor('adEndDate', {
      header: '노출 종료일',
      cell: info => info.getValue() || '-',
    }),
  ], [handlePriceChange]);

  const table = useReactTable<Offer>({
    data: filteredOffers,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => String(row.id), // Use offer ID instead of index
    state: {
      rowSelection,
    },
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
    filterFns: {
      fuzzy: fuzzyFilter,
    },
    meta: {
      modifiedPrices,
      handlePriceChange,
    },
  });

  const selectedCount = Object.keys(rowSelection).length;

  return (
    <div className="px-3 max-w-7xl mx-auto">
      {/* 상단 액션 바 */}
      <div className="bg-white p-4 rounded-lg shadow mb-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            onClick={handleCrawl}
            disabled={crawling}
            className="flex items-center gap-2"
          >
            <RefreshCw className={crawling ? 'animate-spin' : ''} size={16} />
            {crawling ? '크롤링 중...' : '매물 크롤링'}
          </Button>
          {offers.length > 0 && (
            <Button
              onClick={handleDeleteAll}
              disabled={loading || crawling}
              variant="destructive"
              className="flex items-center gap-2"
            >
              전체 삭제
            </Button>
          )}
          {progress && (
            <span className="text-sm text-gray-600">{progress}</span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">
            전체 {offers.length}건 / 필터 {filteredOffers.length}건 / 선택 {selectedCount}건
          </span>
          {selectedCount > 0 && (
            <>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={scheduleEnabled}
                    onChange={(e) => setScheduleEnabled(e.target.checked)}
                    className="cursor-pointer"
                  />
                  예약 실행
                </label>
                {scheduleEnabled && (
                  <>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          const today = new Date();
                          setScheduleDate(today.toISOString().split('T')[0]);
                        }}
                        className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition"
                      >
                        오늘
                      </button>
                      <button
                        onClick={() => {
                          const tomorrow = new Date();
                          tomorrow.setDate(tomorrow.getDate() + 1);
                          setScheduleDate(tomorrow.toISOString().split('T')[0]);
                        }}
                        className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition"
                      >
                        내일
                      </button>
                    </div>
                    <input
                      type="date"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      className="px-2 py-1 text-sm border rounded"
                    />
                    <input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      className="px-2 py-1 text-sm border rounded"
                    />
                  </>
                )}
              </div>
              <Button
                variant="default"
                className="flex items-center gap-2"
                onClick={handleCreateBatch}
                disabled={loading}
              >
                <Package size={16} />
                배치 생성 ({selectedCount}건)
              </Button>
            </>
          )}
        </div>
      </div>

      {/* 필터 */}
      {offers.length > 0 && (
        <div className="bg-white px-4 rounded-lg shadow mb-2">
          <div className="grid grid-cols-6 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">매물명</label>
              <input
                type="text"
                placeholder="검색..."
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">동</label>
              <input
                type="text"
                placeholder="검색..."
                value={filterDong}
                onChange={(e) => setFilterDong(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">호</label>
              <input
                type="text"
                placeholder="검색..."
                value={filterHo}
                onChange={(e) => setFilterHo(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">종류</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">전체</option>
                {uniqueTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">거래</label>
              <select
                value={filterDealType}
                onChange={(e) => setFilterDealType(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">전체</option>
                {uniqueDealTypes.map(dealType => (
                  <option key={dealType} value={dealType}>{dealType}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">검증방식</label>
              <select
                value={filterAdMethod}
                onChange={(e) => setFilterAdMethod(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">전체</option>
                {uniqueAdMethods.map(method => (
                  <option key={method} value={method}>{method}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 평형 범위 필터 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              전용면적: {filterPyeongMin}평 ~ {filterPyeongMax}평
            </label>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">{pyeongRange.min}평</span>
              <div className="flex-1 relative h-6 flex items-center">
                {/* 배경 트랙 */}
                <div className="absolute w-full h-2 bg-gray-200 rounded-lg" />

                {/* 선택된 범위 하이라이트 */}
                <div
                  className="absolute h-2 bg-blue-500 rounded-lg"
                  style={{
                    left: `${((filterPyeongMin - pyeongRange.min) / (pyeongRange.max - pyeongRange.min)) * 100}%`,
                    right: `${100 - ((filterPyeongMax - pyeongRange.min) / (pyeongRange.max - pyeongRange.min)) * 100}%`,
                  }}
                />

                {/* 최소값 슬라이더 */}
                <input
                  type="range"
                  min={pyeongRange.min}
                  max={pyeongRange.max}
                  value={filterPyeongMin}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    if (value <= filterPyeongMax) {
                      setFilterPyeongMin(value);
                    }
                  }}
                  className="absolute w-full appearance-none bg-transparent cursor-pointer"
                  style={{
                    zIndex: 3,
                  }}
                />

                {/* 최대값 슬라이더 */}
                <input
                  type="range"
                  min={pyeongRange.min}
                  max={pyeongRange.max}
                  value={filterPyeongMax}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    if (value >= filterPyeongMin) {
                      setFilterPyeongMax(value);
                    }
                  }}
                  className="absolute w-full appearance-none bg-transparent cursor-pointer"
                  style={{
                    zIndex: 4,
                  }}
                />
              </div>
              <span className="text-xs text-gray-500">{pyeongRange.max}평</span>
            </div>
          </div>

          {/* 가격 범위 필터 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              가격/보증금: {filterPriceMin}억 ~ {filterPriceMax}억
            </label>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">{priceRange.min}억</span>
              <div className="flex-1 relative h-6 flex items-center">
                {/* 배경 트랙 */}
                <div className="absolute w-full h-2 bg-gray-200 rounded-lg" />

                {/* 선택된 범위 하이라이트 */}
                <div
                  className="absolute h-2 bg-green-500 rounded-lg"
                  style={{
                    left: `${((filterPriceMin - priceRange.min) / (priceRange.max - priceRange.min)) * 100}%`,
                    right: `${100 - ((filterPriceMax - priceRange.min) / (priceRange.max - priceRange.min)) * 100}%`,
                  }}
                />

                {/* 최소값 슬라이더 */}
                <input
                  type="range"
                  min={priceRange.min}
                  max={priceRange.max}
                  value={filterPriceMin}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    if (value <= filterPriceMax) {
                      setFilterPriceMin(value);
                    }
                  }}
                  className="absolute w-full appearance-none bg-transparent cursor-pointer"
                  style={{
                    zIndex: 3,
                  }}
                />

                {/* 최대값 슬라이더 */}
                <input
                  type="range"
                  min={priceRange.min}
                  max={priceRange.max}
                  value={filterPriceMax}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    if (value >= filterPriceMin) {
                      setFilterPriceMax(value);
                    }
                  }}
                  className="absolute w-full appearance-none bg-transparent cursor-pointer"
                  style={{
                    zIndex: 4,
                  }}
                />
              </div>
              <span className="text-xs text-gray-500">{priceRange.max}억</span>
            </div>
          </div>
        </div>
      )}

      {/* 테이블 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b sticky top-0">
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50"
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-gray-200">
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
                table.getRowModel().rows.map(row => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="px-4 py-3 text-sm">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default (parentRoute: AnyRootRoute) =>
  createRoute({
    path: '/offers',
    component: OffersPage,
    getParentRoute: () => parentRoute,
  });
