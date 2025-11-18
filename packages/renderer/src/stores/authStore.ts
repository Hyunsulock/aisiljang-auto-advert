import { create } from 'zustand'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  initialized: boolean
  setUser: (user: User | null) => void
  setSession: (session: Session | null) => void
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null }>
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  initialize: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  loading: true,
  initialized: false,

  setUser: (user) => set({ user }),

  setSession: (session) => set({ session, user: session?.user ?? null }),

  initialize: async () => {
    try {
      // 현재 세션 확인
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      // 세션 에러가 있으면 (만료된 토큰 등) 로그아웃 처리
      if (sessionError) {
        console.error('[authStore] Session error:', sessionError)
        await supabase.auth.signOut()
        set({ session: null, user: null, loading: false, initialized: true })
        return
      }

      set({ session, user: session?.user ?? null, loading: false, initialized: true })

      // 세션이 있으면 Main 프로세스에 동기화
      if (session) {
        console.log('[authStore] Syncing existing session to Main process')
        const { agency } = await import('@app/preload')
        await agency.setSession(session.access_token, session.refresh_token)
      }

      // 인증 상태 변경 리스너 설정 (토큰 refresh 포함)
      supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('[authStore] Auth state changed:', event)

        // TOKEN_REFRESHED 이벤트에서도 세션 동기화
        if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
          if (session) {
            console.log('[authStore] Syncing session to Main process')
            const { agency } = await import('@app/preload')
            await agency.setSession(session.access_token, session.refresh_token)
          }
        }

        // SIGNED_OUT 이벤트 처리
        if (event === 'SIGNED_OUT') {
          console.log('[authStore] User signed out')
        }

        set({ session, user: session?.user ?? null, loading: false })
      })
    } catch (error) {
      console.error('Auth initialization error:', error)
      set({ loading: false, initialized: true })
    }
  },

  signUp: async (email: string, password: string, name: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          },
        },
      })

      if (error) throw error

      set({ user: data.user, session: data.session })
      return { error: null }
    } catch (error) {
      console.error('Sign up error:', error)
      return { error: error as Error }
    }
  },

  signIn: async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      set({ user: data.user, session: data.session })
      return { error: null }
    } catch (error) {
      console.error('Sign in error:', error)
      return { error: error as Error }
    }
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut()
      set({ user: null, session: null })
    } catch (error) {
      console.error('Sign out error:', error)
    }
  },
}))
