import { Button } from '../ui/button';

interface MachineIdMismatchProps {
  onRequestChange: () => void;
  onLogout: () => void;
}

export function MachineIdMismatch({ onRequestChange, onLogout }: MachineIdMismatchProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 p-4">
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
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-red-600 mb-2">기기 불일치</h1>
          <p className="text-gray-600">
            이 계정은 다른 기기에서 등록되었습니다.
          </p>
        </div>

        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-700 mb-2">
            관리자에게 기기 변경을 요청하거나
          </p>
          <p className="text-sm text-gray-700">
            등록된 기기에서 로그인해주세요.
          </p>
        </div>

        <div className="space-y-3">
          <Button
            onClick={onRequestChange}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
          >
            기기 변경 요청
          </Button>
          <Button onClick={onLogout} variant="outline" className="w-full">
            로그아웃
          </Button>
        </div>
      </div>
    </div>
  );
}
