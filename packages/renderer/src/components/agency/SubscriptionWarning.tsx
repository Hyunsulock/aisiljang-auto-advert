import { AlertTriangle, XCircle } from 'lucide-react';

interface SubscriptionWarningProps {
  agencyName: string;
  daysRemaining: number;
  isExpired: boolean;
  subscriptionEndDate: string;
}

export function SubscriptionWarning({
  agencyName,
  daysRemaining,
  isExpired,
  subscriptionEndDate,
}: SubscriptionWarningProps) {
  if (!isExpired && daysRemaining > 7) {
    return null; // 7일 이상 남았으면 표시하지 않음
  }

  const endDate = new Date(subscriptionEndDate).toLocaleDateString('ko-KR');

  if (isExpired) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white px-4 py-3 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <XCircle size={24} className="flex-shrink-0" />
            <div>
              <p className="font-bold">구독이 만료되었습니다</p>
              <p className="text-sm">
                {agencyName}의 구독이 {endDate}에 만료되었습니다. 관리자에게 문의하여 구독을 갱신해주세요.
              </p>
            </div>
          </div>
          <button className="bg-white text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg font-medium text-sm transition">
            구독 갱신
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-white px-4 py-3 shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle size={24} className="flex-shrink-0" />
          <div>
            <p className="font-bold">구독 만료가 임박했습니다</p>
            <p className="text-sm">
              {agencyName}의 구독이 {daysRemaining}일 후 ({endDate})에 만료됩니다. 관리자에게 문의하여 구독을 갱신해주세요.
            </p>
          </div>
        </div>
        <button className="bg-white text-yellow-600 hover:bg-yellow-50 px-4 py-2 rounded-lg font-medium text-sm transition">
          구독 갱신
        </button>
      </div>
    </div>
  );
}