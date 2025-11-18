import { useQuery } from '@tanstack/react-query';
import { agency } from '@app/preload';

export interface UserProfile {
  id: string;
  agency_id: string;
  machine_id: string | null;
  role: string;
  agency: {
    id: string;
    name: string;
    subscription_end_date: string;
    is_active: boolean;
  };
}

// User Profile 조회 (Renderer에서 직접 Supabase 호출)
export function useUserProfile(enabled: boolean = true) {
  return useQuery({
    queryKey: ['userProfile'],
    queryFn: async () => {
      console.log('[useUserProfile] Fetching user profile...', { enabled });

      try {
        const { supabase } = await import('../lib/supabase');

        // 현재 사용자 확인
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          console.log('[useUserProfile] No user logged in');
          return null;
        }

        console.log('[useUserProfile] Fetching profile for user:', user.id);

        // 프로필 조회
        const { data: profile, error } = await supabase
          .from('user_profiles')
          .select(`
            *,
            agency:agencies (
              id,
              name,
              subscription_end_date,
              is_active
            )
          `)
          .eq('id', user.id)
          .single();

        if (error) {
          console.log('[useUserProfile] Profile query error:', error);
          // 프로필이 없는 경우 (첫 로그인)
          if (error.code === 'PGRST116') {
            console.log('[useUserProfile] No profile found (first login)');
            return null;
          }
          throw error;
        }

        console.log('[useUserProfile] Profile found:', profile);
        return profile as UserProfile | null;
      } catch (error) {
        console.error('[useUserProfile] Exception:', error);
        throw error;
      }
    },
    enabled,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    retry: 1,
    retryDelay: 1000,
  });
}

// 현재 Machine ID 조회
export function useMachineId(enabled: boolean = true) {
  return useQuery({
    queryKey: ['machineId'],
    queryFn: async () => {
      console.log('[useMachineId] Fetching current machine ID...');
      const result = await agency.getCurrentMachineId();
      console.log('[useMachineId] Result:', result);

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch machine ID');
      }

      return result.machineId as string;
    },
    enabled,
    staleTime: Infinity, // Machine ID는 변하지 않음
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

// Machine ID 불일치 체크
export function useMachineIdCheck(profile: UserProfile | null | undefined) {
  const { data: currentMachineId, isLoading: machineIdLoading } = useMachineId(
    !!profile && !!profile.machine_id
  );

  const machineIdMismatch =
    profile &&
    profile.machine_id &&
    currentMachineId &&
    currentMachineId !== profile.machine_id;

  console.log('[useMachineIdCheck]', {
    hasProfile: !!profile,
    registeredMachineId: profile?.machine_id,
    currentMachineId,
    machineIdMismatch,
    machineIdLoading,
  });

  return {
    machineIdMismatch,
    machineIdLoading,
    currentMachineId,
    registeredMachineId: profile?.machine_id,
  };
}
