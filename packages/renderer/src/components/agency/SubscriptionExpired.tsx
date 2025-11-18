import { Button } from '../ui/button';

interface SubscriptionExpiredProps {
  agencyName: string;
  subscriptionEndDate: string;
  onLogout: () => void;
}

export function SubscriptionExpired({ agencyName, subscriptionEndDate, onLogout }: SubscriptionExpiredProps) {
  const endDate = new Date(subscriptionEndDate);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-red-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
        <div className="mb-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-red-600 mb-2">구독이 만료되었습니다</h1>
          <p className="text-gray-600">
            {agencyName}의 구독이 만료되었습니다
          </p>
        </div>

        <div className="mb-6 p-4 bg-gray-50 rounded-lg space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">중개사무소</span>
            <span className="text-sm font-semibold text-gray-900">{agencyName}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">만료일</span>
            <span className="text-sm font-semibold text-red-600">
              {endDate.toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>
        </div>

        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800">
            서비스를 계속 사용하시려면<br />
            관리자에게 문의하여 구독을 갱신해주세요.
          </p>
        </div>

        <Button onClick={onLogout} variant="outline" className="w-full">
          로그아웃
        </Button>
      </div>
    </div>
  );
}
