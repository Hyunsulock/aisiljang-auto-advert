import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { AlertCircle, Building2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
//import { agency } from '@app/preload';

interface AgencySetupProps {
  onComplete: () => void;
}

export function AgencySetup({ onComplete }: AgencySetupProps) {
  const [agencyName, setAgencyName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!agencyName.trim()) {
      setError('중개사무소 이름을 입력해주세요');
      return;
    }

    try {
      setIsCreating(true);
      setError(null);

      // 현재 로그인한 사용자 확인
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('로그인이 필요합니다');
        return;
      }

      // 이미 프로필이 있는지 확인
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle(); // single 대신 maybeSingle 사용

      if (existingProfile) {
        setError('이미 중개사무소에 등록되어 있습니다');
        return;
      }

      // Agency 생성
      const subscriptionEndDate = new Date();
      subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + 1); // 1개월 체험

      const { data: agency, error: agencyError } = await supabase
        .from('agencies')
        .insert({
          name: agencyName.trim(),
          subscription_end_date: subscriptionEndDate.toISOString(),
          is_active: true,
        })
        .select()
        .single();

      if (agencyError) {
        console.error('Agency creation error:', agencyError);
        setError('중개사무소 생성에 실패했습니다: ' + agencyError.message);
        return;
      }

      // 현재 기기의 Machine ID 가져오기
      const machineIdResult = await agency.getCurrentMachineId();
      const currentMachineId = machineIdResult.machineId;

      // User Profile 생성 (agency 관리자로)
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          id: user.id,
          agency_id: agency.id,
          machine_id: currentMachineId,
          role: 'admin',
        })
        .select()
        .single();

      if (profileError) {
        console.error('Profile creation error:', profileError);
        // Profile 생성 실패 시 Agency도 삭제
        await supabase.from('agencies').delete().eq('id', agency.id);
        setError('프로필 생성에 실패했습니다: ' + profileError.message);
        return;
      }

      alert(`${agencyName} 중개사무소가 생성되었습니다!\n1개월 체험 기간이 시작되었습니다.`);
      onComplete();
    } catch (error: any) {
      console.error('Failed to create agency:', error);
      setError('중개사무소 생성 중 오류가 발생했습니다');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full mb-4">
            <Building2 size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">중개사무소 등록</h1>
          <p className="text-sm text-gray-600">
            이실장 자동화 시스템을 사용하기 위해<br />
            중개사무소를 등록해주세요
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              중개사무소 이름 *
            </label>
            <Input
              type="text"
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
              placeholder="예: 강남부동산"
              className="w-full"
              disabled={isCreating}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-900 mb-2">📋 안내사항</h4>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• 중개사무소를 생성하면 자동으로 관리자 권한이 부여됩니다</li>
              <li>• 1개월 무료 체험 기간이 제공됩니다</li>
              <li>• 현재 사용 중인 기기가 자동으로 등록됩니다</li>
              <li>• 한 사용자는 하나의 중개사무소에만 속할 수 있습니다</li>
            </ul>
          </div>

          <Button
            type="submit"
            disabled={isCreating || !agencyName.trim()}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
          >
            {isCreating ? '생성 중...' : '중개사무소 생성'}
          </Button>
        </form>
      </div>
    </div>
  );
}