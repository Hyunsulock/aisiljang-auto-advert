import { useMemo } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Input } from '../ui/input';
import type { PropertyOwnerInfo } from '../../lib/supabase';

export interface CompetingAd {
  articleNo: string;
  ranking: number;
  price: string;
  floorInfo: string;
  isFloorExposed: boolean;
  articleConfirmYmd: string;
  realtorName: string;
  verificationTypeCode?: string;
  isPriceLower: boolean;
  isPriceHigher: boolean;
}

export interface RankingAnalysis {
  myArticle: any | null;
  myRanking: number | null;
  myFloorExposed: boolean;
  totalCount: number;
  competingAds: CompetingAd[];
  hasFloorExposureAdvantage: boolean;
}

export interface Offer {
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
  rankingAnalysis?: RankingAnalysis | null;
}

export const columnHelper = createColumnHelper<Offer>();

/**
 * 매물 테이블의 컬럼 정의
 */
export const useOfferColumns = (handlePriceChange: (offerId: number, field: 'price' | 'rent', value: string) => void) => {
  return useMemo(() => [
    columnHelper.display({
      id: 'expander',
      header: () => null,
      cell: ({ row }) => (
        <button
          onClick={() => row.toggleExpanded()}
          className="cursor-pointer p-1 hover:bg-gray-200 rounded"
        >
          {row.getIsExpanded() ? (
            <ChevronDown size={16} />
          ) : (
            <ChevronRight size={16} />
          )}
        </button>
      ),
    }),
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
    columnHelper.display({
      id: 'ownerInfo',
      header: '소유자 정보',
      cell: ({ row, table }) => {
        const meta = table.options.meta as any;
        const ownerInfoMap = meta?.ownerInfoMap as Map<string, PropertyOwnerInfo> | undefined;
        const onOwnerInfoClick = meta?.onOwnerInfoClick as ((name: string, dong: string | null, ho: string | null) => void) | undefined;

        const offer = row.original;

        // 로켓등록인 경우 소유자 정보 관리 불필요
        if (offer.adMethod?.includes('로켓')) {
          return <span className="text-gray-400 text-xs">-</span>;
        }

        const key = `${offer.name}|${offer.dong || ''}|${offer.ho || ''}`;
        const ownerInfo = ownerInfoMap?.get(key);

        const hasOwnerInfo = ownerInfo?.hasOwnerInfo || false;

        return (
          <button
            onClick={() => onOwnerInfoClick?.(offer.name, offer.dong, offer.ho)}
            className="w-full text-left hover:bg-gray-100 rounded p-1 transition-colors cursor-pointer"
          >
            {hasOwnerInfo ? (
              <div className="flex flex-col gap-1">
                {ownerInfo?.ownerType && (
                  <div className="px-2 py-1 bg-purple-100 border border-purple-300 rounded text-xs font-medium text-purple-700 text-center">
                    {ownerInfo.ownerType}
                  </div>
                )}
                {ownerInfo && ownerInfo.files.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {ownerInfo.files.map((file, idx) => (
                      <span key={idx} className="px-1.5 py-0.5 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                        {file}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-medium text-gray-500 text-center">
                추가하기
              </div>
            )}
          </button>
        );
      },
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
        const originalPrice = row.original.price;
        const currentPrice = modified?.price ?? originalPrice;
        const isPriceChanged = currentPrice !== originalPrice;

        return (
          <Input
            type="text"
            value={currentPrice}
            onChange={(e) => meta?.handlePriceChange?.(offerId, 'price', e.target.value)}
            onBlur={(e) => {
              const newValue = e.target.value.trim();

              // 원래 값과 비교해서 변경되었는지 확인
              if (newValue !== originalPrice) {
                const confirmed = confirm(`가격을 "${originalPrice}"에서 "${newValue}"로 변경하시겠습니까?\n\n변경 시 "수정후 재광고"로 처리됩니다.`);
                if (!confirmed) {
                  // 취소하면 원래 값으로 되돌림
                  meta?.handlePriceChange?.(offerId, 'price', originalPrice);
                }
              }
            }}
            disabled={!isSelected}
            className={`w-24 ${isPriceChanged ? 'bg-yellow-100 border-yellow-400' : ''}`}
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
        const originalRent = row.original.rent;
        const currentRent = modified?.rent ?? originalRent;
        const isRentChanged = currentRent !== originalRent;

        return (
          <Input
            type="text"
            value={currentRent}
            onChange={(e) => meta?.handlePriceChange?.(offerId, 'rent', e.target.value)}
            onBlur={(e) => {
              const newValue = e.target.value.trim();

              // 원래 값과 비교해서 변경되었는지 확인
              if (newValue !== originalRent) {
                const confirmed = confirm(`월세를 "${originalRent}"에서 "${newValue}"로 변경하시겠습니까?\n\n변경 시 "수정후 재광고"로 처리됩니다.`);
                if (!confirmed) {
                  // 취소하면 원래 값으로 되돌림
                  meta?.handlePriceChange?.(offerId, 'rent', originalRent);
                }
              }
            }}
            disabled={!isSelected}
            className={`w-24 ${isRentChanged ? 'bg-yellow-100 border-yellow-400' : ''}`}
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
    columnHelper.display({
      id: 'adDates',
      header: '노출 기간',
      cell: ({ row }) => {
        const startDate = row.original.adStartDate;
        const endDate = row.original.adEndDate;

        return (
          <div className="flex flex-col text-xs">
            <span className="text-gray-700">{startDate || '-'}</span>
            <span className="text-gray-500">~ {endDate || '-'}</span>
          </div>
        );
      },
    }),
    columnHelper.display({
      id: 'ranking',
      header: '랭킹',
      cell: ({ row }) => {
        const analysis = row.original.rankingAnalysis;
        if (!analysis || analysis.myRanking === null) {
          return <span className="text-gray-400 text-xs">-</span>;
        }

        const ranking = analysis.myRanking;
        let bgClass = '';

        if (ranking <= 3) {
          bgClass = 'bg-yellow-100 text-yellow-700';
        } else if (ranking <= 10) {
          bgClass = 'bg-green-100 text-green-700';
        } else {
          bgClass = 'bg-gray-100 text-gray-700';
        }

        return (
          <div className="flex flex-col items-center gap-1">
            <span className={`inline-block px-2 py-1 rounded-md text-xs font-bold ${bgClass}`}>
              {ranking}위
            </span>
            <span className="text-xs text-gray-500">/ {analysis.totalCount}</span>
          </div>
        );
      },
    }),
    columnHelper.display({
      id: 'floorExposure',
      header: '층수노출',
      cell: ({ row, table }) => {
        const analysis = row.original.rankingAnalysis;
        if (!analysis) {
          return <span className="text-gray-400 text-xs">-</span>;
        }

        const offerId = row.original.id;
        const meta = table.options.meta as any;
        const modified = meta?.modifiedPrices?.[offerId];
        const isSelected = row.getIsSelected();
        const originalExposure = analysis.myFloorExposed;
        const currentExposure = modified?.floorExposure !== undefined ? modified.floorExposure : originalExposure;
        const isChanged = modified?.floorExposure !== undefined && modified.floorExposure !== originalExposure;
        const hasAdvantage = analysis.hasFloorExposureAdvantage;

        return (
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => {
                if (isSelected) {
                  meta?.onFloorExposureToggle?.(offerId, !currentExposure, originalExposure);
                }
              }}
              disabled={!isSelected}
              className={`inline-block px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                !isSelected
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : isChanged
                  ? 'bg-yellow-100 border border-yellow-400 text-yellow-700 hover:bg-yellow-200 cursor-pointer hover:opacity-80'
                  : currentExposure
                  ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 cursor-pointer hover:opacity-80'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 cursor-pointer hover:opacity-80'
              }`}
            >
              {currentExposure ? '노출' : '미노출'}
            </button>
            {hasAdvantage && (
              <span className="text-xs text-red-600 font-medium">⚠️ 불리</span>
            )}
          </div>
        );
      },
    }),
  ], [handlePriceChange]);
};

// Fuzzy filter function for TanStack Table
export const fuzzyFilter = (row: any, columnId: string, value: any) => {
  const itemValue = row.getValue(columnId);
  return String(itemValue).toLowerCase().includes(String(value).toLowerCase());
};

// 가격 문자열을 억 단위 숫자로 변환 (예: "10억" -> 10, "5억 5000" -> 5.5, "5000" -> 0.5)
export const parsePrice = (priceStr: string | null): number | null => {
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
