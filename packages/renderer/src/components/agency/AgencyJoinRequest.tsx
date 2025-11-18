import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Building2, RefreshCw, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface AgencyJoinRequestProps {
  onBack: () => void;
  onComplete: () => void;
}

export function AgencyJoinRequest({ onBack, onComplete }: AgencyJoinRequestProps) {
  const [agencyName, setAgencyName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [requestSubmitted, setRequestSubmitted] = useState(false);

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!agencyName.trim()) {
      alert('중개사무소 이름을 입력해주세요');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('로그인이 필요합니다');
        return;
      }

      // 이미 요청이 있는지 확인
      const { data: existingRequest } = await supabase
        .from('agency_join_requests')
        .select('id, status')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .single();

      if (existingRequest) {
        alert('이미 대기 중인 가입 요청이 있습니다');
        return;
      }

      // 가입 요청 생성
      const { error } = await supabase
        .from('agency_join_requests')
        .insert({
          user_id: user.id,
          agency_name: agencyName.trim(),
          status: 'pending',
        });

      if (error) {
        console.error('Join request error:', error);
        alert(`요청 전송 실패: ${error.message}`);
        return;
      }

      alert('가입 요청이 전송되었습니다!\n관리자가 승인할 때까지 기다려주세요.');
      setRequestSubmitted(true);
    } catch (error: any) {
      console.error('Failed to submit join request:', error);
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="space-y-4">
          <div className="mx-auto bg-green-100 rounded-full p-4 w-16 h-16 flex items-center justify-center">
            <Building2 className="w-8 h-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl text-center">중개사무소 가입 요청</CardTitle>
          <CardDescription className="text-center text-base">
            기존 중개사무소에 가입을 요청합니다
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {!requestSubmitted ? (
            <>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <p className="font-semibold mb-1">안내 사항</p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>중개사무소 이름을 정확히 입력해주세요</li>
                    <li>요청 후 관리자가 수동으로 승인합니다</li>
                    <li>승인까지 시간이 소요될 수 있습니다</li>
                  </ul>
                </div>
              </div>

              <form onSubmit={handleSubmitRequest} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    중개사무소 이름
                  </label>
                  <Input
                    type="text"
                    placeholder="예: 강남부동산"
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                    className="h-12"
                    disabled={isSubmitting}
                    required
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onBack}
                    className="flex-1 h-12"
                    disabled={isSubmitting}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    뒤로
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting || !agencyName.trim()}
                    className="flex-1 h-12"
                  >
                    {isSubmitting ? '요청 중...' : '가입 요청'}
                  </Button>
                </div>
              </form>
            </>
          ) : (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800 text-center">
                  <strong>{agencyName}</strong>에 가입 요청이 전송되었습니다.<br />
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

                <Button
                  variant="outline"
                  onClick={onBack}
                  className="w-full"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  다시 선택하기
                </Button>
              </div>

              <p className="text-xs text-center text-gray-500">
                승인이 완료되지 않았다면 관리자에게 문의하세요
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}