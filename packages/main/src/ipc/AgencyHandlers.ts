import { ipcMain } from 'electron';
import { supabase, getCurrentUserAgencyId } from '../lib/supabase.js';
import machineId from 'node-machine-id';

const { machineIdSync } = machineId;

export function setupAgencyHandlers() {
  /**
   * Renderer에서 세션을 Main 프로세스로 동기화
   */
  ipcMain.handle('agency:setSession', async (_, accessToken: string, refreshToken: string) => {
    try {
      console.log('[AgencyHandlers] Setting session in Main process');

      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        console.error('[AgencyHandlers] Failed to set session:', error);
        return { success: false, error: error.message };
      }

      console.log('[AgencyHandlers] Session set successfully');
      return { success: true };
    } catch (error: any) {
      console.error('[AgencyHandlers] Exception setting session:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * 현재 사용자의 프로필 정보 가져오기 (agency_id, machine_id, role 등)
   */
  ipcMain.handle('agency:getUserProfile', async () => {
    try {
      console.log('[AgencyHandlers] getUserProfile called');

      const { data: { session } } = await supabase.auth.getSession();
      const { data: { user } } = await supabase.auth.getUser();

      console.log('[AgencyHandlers] Auth state:', {
        hasSession: !!session,
        hasUser: !!user,
        userId: user?.id,
      });

      if (!user) {
        console.error('[AgencyHandlers] No user found');
        return {
          success: false,
          error: '로그인이 필요합니다',
        };
      }

      console.log('[AgencyHandlers] Fetching profile for user:', user.id);

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
        console.log('[AgencyHandlers] Profile query error:', error);
        // 프로필이 없는 경우 (첫 로그인)
        if (error.code === 'PGRST116') {
          console.log('[AgencyHandlers] No profile found (first login)');
          return {
            success: true,
            data: null,
          };
        }
        throw error;
      }

      console.log('[AgencyHandlers] Profile found:', profile);

      return {
        success: true,
        data: profile,
      };
    } catch (error: any) {
      console.error('[AgencyHandlers] Failed to get user profile:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  /**
   * Agency 생성 및 사용자 프로필 생성
   */
  ipcMain.handle('agency:create', async (_, agencyName: string, subscriptionMonths: number = 1) => {
    try {
      // 세션 상태 확인
      const { data: { session } } = await supabase.auth.getSession();
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      console.log('[AgencyHandlers] agency:create - Auth check:', {
        hasSession: !!session,
        hasUser: !!user,
        userId: user?.id,
        authError
      });

      if (!user) {
        return {
          success: false,
          error: '로그인이 필요합니다',
        };
      }

      // 이미 프로필이 있는지 확인
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      if (existingProfile) {
        return {
          success: false,
          error: '이미 중개사무소에 등록되어 있습니다',
        };
      }

      // Agency 생성
      const subscriptionEndDate = new Date();
      subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + subscriptionMonths);

      const { data: agency, error: agencyError } = await supabase
        .from('agencies')
        .insert({
          name: agencyName,
          subscription_end_date: subscriptionEndDate.toISOString(),
          is_active: true,
        })
        .select()
        .single();

      if (agencyError) {
        throw agencyError;
      }

      // 현재 기기의 Machine ID 가져오기
      const currentMachineId = machineIdSync();

      // User Profile 생성 (agency 관리자로)
      const { data: profile, error: profileError } = await supabase
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
        // Profile 생성 실패 시 Agency도 삭제
        await supabase.from('agencies').delete().eq('id', agency.id);
        throw profileError;
      }

      return {
        success: true,
        data: {
          agency,
          profile,
        },
      };
    } catch (error: any) {
      console.error('Failed to create agency:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  /**
   * Machine ID 등록/업데이트
   */
  ipcMain.handle('agency:registerMachineId', async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return {
          success: false,
          error: '로그인이 필요합니다',
        };
      }

      const currentMachineId = machineIdSync();

      // 현재 사용자의 프로필 가져오기
      const { data: profile, error: fetchError } = await supabase
        .from('user_profiles')
        .select('machine_id, agency_id')
        .eq('id', user.id)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      // Machine ID가 이미 등록되어 있는 경우
      if (profile.machine_id) {
        if (profile.machine_id === currentMachineId) {
          return {
            success: true,
            message: '이미 등록된 기기입니다',
          };
        } else {
          return {
            success: false,
            error: '다른 기기에서 이미 등록되었습니다. 관리자에게 문의하세요.',
          };
        }
      }

      // 같은 agency 내에서 이미 이 machine_id가 사용 중인지 확인
      const { data: existingMachine } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('agency_id', profile.agency_id)
        .eq('machine_id', currentMachineId)
        .single();

      if (existingMachine) {
        return {
          success: false,
          error: '이 기기는 이미 다른 사용자가 사용 중입니다',
        };
      }

      // Machine ID 등록
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ machine_id: currentMachineId })
        .eq('id', user.id);

      if (updateError) {
        throw updateError;
      }

      return {
        success: true,
        message: '기기 등록이 완료되었습니다',
      };
    } catch (error: any) {
      console.error('Failed to register machine ID:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  /**
   * 현재 Machine ID 가져오기
   */
  ipcMain.handle('agency:getCurrentMachineId', async () => {
    try {
      const currentMachineId = machineIdSync();
      return {
        success: true,
        machineId: currentMachineId,
      };
    } catch (error: any) {
      console.error('Failed to get machine ID:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  /**
   * Agency 가입 요청 제출
   */
  ipcMain.handle('agency:submitJoinRequest', async (_, agencyName: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return {
          success: false,
          error: '로그인이 필요합니다',
        };
      }

      // 이미 요청이 있는지 확인
      const { data: existingRequest } = await supabase
        .from('agency_join_requests')
        .select('id, status')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .single();

      if (existingRequest) {
        return {
          success: false,
          error: '이미 대기 중인 가입 요청이 있습니다',
        };
      }

      // 가입 요청 생성
      const { data, error } = await supabase
        .from('agency_join_requests')
        .insert({
          user_id: user.id,
          agency_name: agencyName,
          status: 'pending',
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return {
        success: true,
        data,
      };
    } catch (error: any) {
      console.error('Failed to submit join request:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  /**
   * Machine ID 등록 요청 제출
   */
  ipcMain.handle('agency:submitMachineIdRequest', async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return {
          success: false,
          error: '로그인이 필요합니다',
        };
      }

      const currentMachineId = machineIdSync();

      // 이미 요청이 있는지 확인
      const { data: existingRequest } = await supabase
        .from('machine_id_requests')
        .select('id, status')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .single();

      if (existingRequest) {
        return {
          success: false,
          error: '이미 대기 중인 기기 등록 요청이 있습니다',
        };
      }

      // Machine ID 등록 요청 생성
      const { data, error } = await supabase
        .from('machine_id_requests')
        .insert({
          user_id: user.id,
          machine_id: currentMachineId,
          status: 'pending',
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return {
        success: true,
        data,
      };
    } catch (error: any) {
      console.error('Failed to submit machine ID request:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  /**
   * 구독 상태 확인
   */
  ipcMain.handle('agency:checkSubscriptionStatus', async () => {
    try {
      const agencyId = await getCurrentUserAgencyId();

      if (!agencyId) {
        return {
          success: false,
          error: 'Agency 정보를 찾을 수 없습니다',
        };
      }

      const { data: agency, error } = await supabase
        .from('agencies')
        .select('subscription_end_date, is_active, name')
        .eq('id', agencyId)
        .single();

      if (error) {
        throw error;
      }

      const now = new Date();
      const endDate = new Date(agency.subscription_end_date);
      const isExpired = endDate < now;
      const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      return {
        success: true,
        data: {
          agencyName: agency.name,
          subscriptionEndDate: agency.subscription_end_date,
          isActive: agency.is_active,
          isExpired,
          daysRemaining,
        },
      };
    } catch (error: any) {
      console.error('Failed to check subscription status:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });
}