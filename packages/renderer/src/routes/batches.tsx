import { createRoute, useNavigate } from '@tanstack/react-router';
import type { AnyRootRoute } from '@tanstack/react-router';
import { Button } from '../components/ui/button';
import { useState, useEffect } from 'react';
import { Play, Trash2, RefreshCw, RotateCcw, Eye } from 'lucide-react';
import { batch } from '@app/preload';

interface Batch {
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
  // 실시간 진행 정보 (UI 상태용)
  currentItem?: {
    name: string;
    index: number;
    step?: string;
    stepLabel?: string;
  };
}

export default function createBatchRoute(rootRoute: AnyRootRoute) {
  return createRoute({
    getParentRoute: () => rootRoute,
    path: '/batches',
    component: BatchesPage,
  });
}

function BatchesPage() {
  const navigate = useNavigate();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadBatches();

    // 실시간 배치 진행 상태 구독
    const unsubscribe = batch.onProgress((progress: any) => {
      console.log('배치 진행 상태 수신:', progress);

      // 해당 배치의 상태를 실시간으로 업데이트
      setBatches((prevBatches) =>
        prevBatches.map((b) =>
          b.id === progress.batchId
            ? {
                ...b,
                status: progress.status,
                completedCount: progress.completedCount,
                failedCount: progress.failedCount,
                // 완료 상태일 때만 currentItem 초기화 (실패 시에는 마지막 상태 유지)
                currentItem: progress.status === 'completed'
                  ? undefined
                  : progress.currentItem,
              }
            : b
        )
      );
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const loadBatches = async () => {
    try {
      setLoading(true);
      const response = await batch.getAll();
      if (response.success) {
        setBatches(response.data);
      }
    } catch (error) {
      console.error('배치 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteBatch = async (batchId: number) => {
    if (!confirm('이 배치를 실행하시겠습니까?')) {
      return;
    }

    try {
      // 배치 실행은 백그라운드에서 실행되므로 await하지 않음
      batch.execute(batchId).then((response: any) => {
        if (!response.success) {
          alert('배치 실행 실패: ' + response.error);
          loadBatches();
        } else {
          // 배치 완료 후 최종 상태 갱신
          loadBatches();
        }
      }).catch((error: any) => {
        console.error('배치 실행 오류:', error);
        alert('배치 실행 중 오류가 발생했습니다');
        loadBatches();
      });

      // 즉시 상태를 'removing'으로 업데이트하여 UI 반영
      setBatches((prevBatches) =>
        prevBatches.map((batch) =>
          batch.id === batchId
            ? { ...batch, status: 'removing' }
            : batch
        )
      );
    } catch (error) {
      console.error('배치 실행 오류:', error);
      alert('배치 실행 중 오류가 발생했습니다');
    }
  };

  const handleDeleteBatch = async (batchId: number) => {
    if (!confirm('이 배치를 삭제하시겠습니까?')) {
      return;
    }

    try {
      setLoading(true);
      const response = await batch.delete(batchId);

      if (response.success) {
        alert('배치가 삭제되었습니다');
        await loadBatches();
      } else {
        alert('배치 삭제 실패: ' + response.error);
      }
    } catch (error) {
      console.error('배치 삭제 오류:', error);
      alert('배치 삭제 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleRetryBatch = async (batchId: number) => {
    if (!confirm('실패한 항목만 다시 실행하시겠습니까?')) {
      return;
    }

    try {
      // 배치 재시도는 백그라운드에서 실행되므로 await하지 않음
      batch.retry(batchId).then((response: any) => {
        if (!response.success) {
          alert('재시도 실패: ' + response.error);
          loadBatches();
        } else {
          // 배치 완료 후 최종 상태 갱신
          loadBatches();
        }
      }).catch((error: any) => {
        console.error('재시도 오류:', error);
        alert('재시도 중 오류가 발생했습니다');
        loadBatches();
      });

      // 즉시 상태를 'uploading'으로 업데이트하여 UI 반영
      setBatches((prevBatches) =>
        prevBatches.map((batch) =>
          batch.id === batchId
            ? { ...batch, status: 'uploading' }
            : batch
        )
      );
    } catch (error) {
      console.error('재시도 오류:', error);
      alert('재시도 중 오류가 발생했습니다');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      pending: { label: '대기중', className: 'bg-gray-100 text-gray-700' },
      scheduled: { label: '예약됨', className: 'bg-indigo-100 text-indigo-700' },
      modifying: { label: '가격 수정 중', className: 'bg-orange-100 text-orange-700' },
      removing: { label: '광고 내리는 중', className: 'bg-yellow-100 text-yellow-700' },
      removed: { label: '광고 내리기 완료', className: 'bg-blue-100 text-blue-700' },
      readvertising: { label: '재광고 중', className: 'bg-purple-100 text-purple-700' },
      uploading: { label: '광고 올리는 중', className: 'bg-purple-100 text-purple-700' },
      completed: { label: '완료', className: 'bg-green-100 text-green-700' },
      failed: { label: '실패', className: 'bg-red-100 text-red-700' },
    };

    const config = statusConfig[status] || { label: status, className: 'bg-gray-100 text-gray-700' };

    return (
      <span className={`inline-block px-2 py-1 rounded-md text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const formatDate = (date: Date | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('ko-KR');
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">배치 목록</h2>
        <Button
          onClick={loadBatches}
          disabled={loading}
          variant="outline"
          className="flex items-center gap-2"
        >
          <RefreshCw className={loading ? 'animate-spin' : ''} size={16} />
          새로고침
        </Button>
      </div>

      {batches.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          배치가 없습니다. 매물 관리 페이지에서 매물을 선택하여 배치를 생성하세요.
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  배치명
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  상태
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  진행률
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  예약 시간
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  생성일
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  시작일
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  완료일
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {batches.map((batch) => {
                const progressPercent = batch.totalCount > 0 ? (batch.completedCount / batch.totalCount) * 100 : 0;
                const isRunning = batch.status === 'modifying' || batch.status === 'removing' || batch.status === 'readvertising' || batch.status === 'uploading';

                return (
                  <tr key={batch.id} className="hover:bg-gray-50 relative">
                    {/* 진행률 바 - row 전체 배경 */}
                    <td colSpan={8} className="absolute inset-0 p-0">
                      <div className="h-full w-full">
                        <div
                          className={`h-full transition-all duration-300 ${
                            batch.status === 'completed' ? 'bg-green-100' :
                            batch.status === 'failed' ? 'bg-red-50' :
                            isRunning ? 'bg-blue-50' : 'bg-transparent'
                          }`}
                          style={{
                            width: isRunning || batch.status === 'completed' || batch.status === 'failed' ? `${progressPercent}%` : '0%',
                          }}
                        />
                      </div>
                    </td>
                    {/* 실제 콘텐츠 */}
                    <td className="px-4 py-3 text-sm font-medium relative z-10">
                      {batch.name}
                    </td>
                    <td className="px-4 py-3 text-sm relative z-10">
                      {getStatusBadge(batch.status)}
                    </td>
                    <td className="px-4 py-3 text-sm relative z-10">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700">
                          {batch.completedCount}/{batch.totalCount}
                        </span>
                        <span className="text-xs text-gray-500">
                          ({progressPercent.toFixed(0)}%)
                        </span>
                      </div>
                      {batch.failedCount > 0 && (
                        <div className="text-xs text-red-600 mt-1 font-medium">
                          실패: {batch.failedCount}건
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 relative z-10">
                      {batch.scheduledAt ? (
                        <span className="text-indigo-600 font-medium">
                          {formatDate(batch.scheduledAt)}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 relative z-10">
                      {formatDate(batch.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 relative z-10">
                      {formatDate(batch.startedAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 relative z-10">
                      {formatDate(batch.completedAt)}
                    </td>
                    <td className="px-4 py-3 text-sm relative z-10">
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => navigate({ to: '/batches/$batchId', params: { batchId: String(batch.id) } })}
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-1"
                        >
                          <Eye size={14} />
                          상세
                        </Button>
                        {(batch.status === 'pending' || batch.status === 'scheduled') && (
                          <Button
                            onClick={() => handleExecuteBatch(batch.id)}
                            disabled={loading}
                            size="sm"
                            className="flex items-center gap-1"
                          >
                            <Play size={14} />
                            {batch.status === 'scheduled' ? '즉시 실행' : '실행'}
                          </Button>
                        )}
                        {isRunning && (
                          <div className="flex flex-col">
                            <span className="text-xs text-blue-600 font-medium px-2 py-1 bg-blue-100 rounded inline-block">
                              {batch.currentItem ? (
                                <>
                                  [{batch.currentItem.index}/{batch.totalCount}] {batch.currentItem.name}
                                  {batch.currentItem.stepLabel && (
                                    <span className="ml-1 text-purple-600">
                                      - {batch.currentItem.stepLabel}
                                    </span>
                                  )}
                                </>
                              ) : (
                                '실행 중...'
                              )}
                            </span>
                          </div>
                        )}
                        {(batch.status === 'completed' || batch.status === 'failed') && batch.failedCount > 0 && (
                          <Button
                            onClick={() => handleRetryBatch(batch.id)}
                            disabled={loading}
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-1"
                          >
                            <RotateCcw size={14} />
                            재시도 ({batch.failedCount}건)
                          </Button>
                        )}
                        {!isRunning && (
                          <Button
                            onClick={() => handleDeleteBatch(batch.id)}
                            disabled={loading}
                            variant="destructive"
                            size="sm"
                            className="flex items-center gap-1"
                          >
                            <Trash2 size={14} />
                            삭제
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
