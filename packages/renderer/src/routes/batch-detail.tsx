import { createRoute, useParams, useNavigate } from '@tanstack/react-router';
import type { AnyRootRoute } from '@tanstack/react-router';
import { Button } from '../components/ui/button';
import { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle, XCircle, Clock, MinusCircle } from 'lucide-react';
import { batch } from '@app/preload';

interface BatchItem {
  id: number;
  batchId: number;
  offerId: number | null;
  status: string;
  modifyStatus: string | null;
  reAdvertiseStatus: string | null;
  modifiedPrice: string | null;
  modifiedRent: string | null;
  modifiedFloorExposure: boolean | null;
  shouldReAdvertise: boolean;
  errorMessage: string | null;
  retryCount: number;
  // 매물 정보 스냅샷 (매물 삭제 후에도 유지)
  offerName: string | null;
  offerDong: string | null;
  offerHo: string | null;
  offerDealType: string | null;
  // 현재 매물 정보 (매물이 존재하는 경우)
  offer?: {
    id: number;
    name: string;
    dong: string | null;
    ho: string | null;
    type: string;
    dealType: string;
    price: string;
    rent: string | null;
    numberN: string;
  } | null;
}

interface BatchDetail {
  id: number;
  name: string;
  status: string;
  totalCount: number;
  completedCount: number;
  failedCount: number;
  scheduledAt: Date | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  items: BatchItem[];
}

export default function createBatchDetailRoute(rootRoute: AnyRootRoute) {
  return createRoute({
    getParentRoute: () => rootRoute,
    path: '/batches/$batchId',
    component: BatchDetailPage,
  });
}

function BatchDetailPage() {
  const { batchId } = useParams({ from: '/batches/$batchId' });
  const navigate = useNavigate();
  const [detail, setDetail] = useState<BatchDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadBatchDetail();
  }, [batchId]);

  const loadBatchDetail = async () => {
    try {
      setLoading(true);
      const response = await batch.getDetail(Number(batchId));
      if (response.success) {
        setDetail(response.data);
      } else {
        alert('배치 상세 정보를 불러오는데 실패했습니다: ' + response.error);
      }
    } catch (error) {
      console.error('배치 상세 정보 로드 실패:', error);
      alert('배치 상세 정보를 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      pending: { label: '대기', className: 'bg-gray-100 text-gray-700' },
      scheduled: { label: '예약됨', className: 'bg-blue-100 text-blue-700' },
      modifying: { label: '수정 중', className: 'bg-yellow-100 text-yellow-700' },
      readvertising: { label: '재광고 중', className: 'bg-orange-100 text-orange-700' },
      completed: { label: '완료', className: 'bg-green-100 text-green-700' },
      failed: { label: '실패', className: 'bg-red-100 text-red-700' },
      skipped: { label: '건너뜀', className: 'bg-gray-100 text-gray-600' },
    };

    const config = statusMap[status] || { label: status, className: 'bg-gray-100 text-gray-700' };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const getStepIcon = (status: string | null) => {
    if (!status) return <Clock size={16} className="text-gray-400" />;

    switch (status) {
      case 'completed':
        return <CheckCircle size={16} className="text-green-500" />;
      case 'failed':
        return <XCircle size={16} className="text-red-500" />;
      case 'skipped':
        return <MinusCircle size={16} className="text-gray-400" />;
      case 'pending':
        return <Clock size={16} className="text-gray-400" />;
      default:
        return <Clock size={16} className="text-yellow-500" />;
    }
  };

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('ko-KR');
  };

  if (loading || !detail) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => navigate({ to: '/batches' })}
            className="gap-2"
          >
            <ArrowLeft size={16} />
            뒤로
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{detail.name}</h1>
            <p className="text-sm text-gray-500">배치 ID: {detail.id}</p>
          </div>
        </div>
        <div>{getStatusBadge(detail.status)}</div>
      </div>

      {/* 배치 정보 카드 */}
      <div className="bg-white rounded-lg border p-6 space-y-4">
        <h2 className="text-lg font-semibold">배치 정보</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-500">총 매물</p>
            <p className="text-2xl font-bold">{detail.totalCount}건</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">완료</p>
            <p className="text-2xl font-bold text-green-600">{detail.completedCount}건</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">실패</p>
            <p className="text-2xl font-bold text-red-600">{detail.failedCount}건</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">진행률</p>
            <p className="text-2xl font-bold">
              {Math.round(((detail.completedCount + detail.failedCount) / detail.totalCount) * 100)}%
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
          <div>
            <p className="text-sm text-gray-500">생성 시간</p>
            <p className="text-sm font-medium">{formatDate(detail.createdAt)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">시작 시간</p>
            <p className="text-sm font-medium">{formatDate(detail.startedAt)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">완료 시간</p>
            <p className="text-sm font-medium">{formatDate(detail.completedAt)}</p>
          </div>
        </div>
      </div>

      {/* 매물별 작업 상태 */}
      <div className="bg-white rounded-lg border">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold">매물별 작업 상태</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  매물명
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  거래유형
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  변경 정보
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  정보 수정
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  재광고
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  전체 상태
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  오류 메시지
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {detail.items.map((item) => {
                // 스냅샷 데이터 우선, 없으면 현재 매물 정보 사용
                const name = item.offerName || item.offer?.name || '(삭제된 매물)';
                const dong = item.offerDong || item.offer?.dong;
                const ho = item.offerHo || item.offer?.ho;
                const dealType = item.offerDealType || item.offer?.dealType;

                return (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">
                    <div className="font-medium">
                      {name}
                      {dong && ` ${dong}동`}
                      {ho && ` ${ho}호`}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                      dealType === '매매' ? 'bg-blue-100 text-blue-700' :
                      dealType === '전세' ? 'bg-green-100 text-green-700' :
                      'bg-orange-100 text-orange-700'
                    }`}>
                      {dealType || '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {item.modifiedPrice && (
                      <div className="text-xs">
                        <span className="text-gray-500">가격:</span> {item.modifiedPrice}
                      </div>
                    )}
                    {item.modifiedRent && (
                      <div className="text-xs">
                        <span className="text-gray-500">월세:</span> {item.modifiedRent}
                      </div>
                    )}
                    {item.modifiedFloorExposure !== null && (
                      <div className="text-xs">
                        <span className="text-gray-500">층노출:</span> {item.modifiedFloorExposure ? 'O' : 'X'}
                      </div>
                    )}
                    {!item.modifiedPrice && !item.modifiedRent && item.modifiedFloorExposure === null && (
                      <span className="text-xs text-gray-400">변경 없음</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {item.modifiedPrice || item.modifiedRent || item.modifiedFloorExposure !== null ? (
                      <div className="flex items-center justify-center gap-2">
                        {getStepIcon(item.modifyStatus)}
                        {getStatusBadge(item.modifyStatus || 'pending')}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">건너뜀</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {item.shouldReAdvertise ? (
                      <div className="flex items-center justify-center gap-2">
                        {getStepIcon(item.reAdvertiseStatus)}
                        {getStatusBadge(item.reAdvertiseStatus || 'pending')}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">건너뜀</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {getStatusBadge(item.status)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {item.errorMessage ? (
                      <div className="text-xs text-red-600 max-w-xs truncate" title={item.errorMessage}>
                        {item.errorMessage}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
