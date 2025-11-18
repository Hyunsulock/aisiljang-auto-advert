import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Monitor, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { agency } from '@app/preload';

interface MachineIdRegistrationProps {
  onComplete: () => void;
  onLogout?: () => void;
}

export function MachineIdRegistration({ onComplete, onLogout }: MachineIdRegistrationProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const [currentMachineId, setCurrentMachineId] = useState<string>('');

  useEffect(() => {
    // 현재 기기의 Machine ID 가져오기 (Main 프로세스에서)
    (async () => {
      const result = await agency.getCurrentMachineId();
      if (result.success) {
        setCurrentMachineId(result.machineId);
      }
    })();
  }, []);

  const handleSubmitRequest = async () => {
    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('로그인이 필요합니다');
        return;
      }

      if (!currentMachineId) {
        alert('Machine ID를 가져올 수 없습니다');
        return;
      }

      // 이미 요청이 있는지 확인
      const { data: existingRequest } = await supabase
        .from('machine_id_requests')
        .select('id, status')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .single();

      if (existingRequest) {
        alert('이미 대기 중인 기기 등록 요청이 있습니다');
        return;
      }

      // Machine ID 등록 요청 생성
      const { error } = await supabase
        .from('machine_id_requests')
        .insert({
          user_id: user.id,
          machine_id: currentMachineId,
          status: 'pending',
        });

      if (error) {
        console.error('Machine ID request error:', error);
        alert(`요청 전송 실패: ${error.message}`);
        return;
      }

      alert('기기 등록 요청이 전송되었습니다!\n관리자가 승인할 때까지 기다려주세요.');
      setRequestSubmitted(true);
    } catch (error: any) {
      console.error('Failed to submit machine ID request:', error);
      alert(`오류가 발생했습니다: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);

    try {
      // 프로필 다시 로드
      onComplete();
    } catch (error: any) {
      console.error('Failed to refresh profile:', error);
      alert(`새로고침 실패: ${error.message}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="space-y-4">
          <div className="mx-auto bg-blue-100 rounded-full p-4 w-16 h-16 flex items-center justify-center">
            <Monitor className="w-8 h-8 text-blue-600" />
          </div>
          <CardTitle className="text-2xl text-center">기기 등록</CardTitle>
          <CardDescription className="text-center text-base">
            이 컴퓨터에서 계정을 사용하시겠습니까?
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-semibold mb-1">중요 안내</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>한 계정은 한 대의 컴퓨터에서만 사용할 수 있습니다</li>
                <li>등록 후에는 이 컴퓨터에서만 로그인이 가능합니다</li>
                <li>다른 컴퓨터에서 사용하려면 관리자에게 문의하세요</li>
              </ul>
            </div>
          </div>

          {!requestSubmitted ? (
            <>
              {currentMachineId && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-600 text-center">
                    기기 ID: <code className="font-mono text-xs bg-gray-200 px-2 py-1 rounded">
                      {currentMachineId.substring(0, 16)}...
                    </code>
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <Button
                  onClick={handleSubmitRequest}
                  disabled={isSubmitting}
                  className="w-full h-12 text-base"
                  size="lg"
                >
                  {isSubmitting ? '요청 중...' : '이 컴퓨터 등록 요청하기'}
                </Button>

                {onLogout && (
                  <Button
                    onClick={onLogout}
                    variant="outline"
                    className="w-full"
                  >
                    로그아웃
                  </Button>
                )}

                <p className="text-xs text-center text-gray-500">
                  요청 후 관리자가 승인하면 이 컴퓨터에서 사용할 수 있습니다
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800 text-center">
                  기기 등록 요청이 전송되었습니다.<br />
                  관리자가 승인하면 아래 새로고침 버튼을 눌러주세요.
                </p>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="w-full h-12 text-base"
                  size="lg"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                  {isRefreshing ? '새로고침 중...' : '승인 여부 확인'}
                </Button>

                {onLogout && (
                  <Button
                    onClick={onLogout}
                    variant="outline"
                    className="w-full"
                  >
                    로그아웃
                  </Button>
                )}

                <p className="text-xs text-center text-gray-500">
                  승인이 완료되지 않았다면 관리자에게 문의하세요
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}