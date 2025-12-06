import { StrictMode, useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRouter,
  useRouterState,
  createHashHistory,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import CrawlerTest from './routes/crawler-test.tsx'
import HomePage from './routes/index.tsx'
import OffersPage from './routes/offers.tsx'
import BatchesPage from './routes/batches.tsx'
import BatchDetailPage from './routes/batch-detail.tsx'
import SettingsPage from './routes/settings.tsx'

import { AppSidebar } from './components/AppSidebar'
import { SidebarProvider, SidebarTrigger } from './components/ui/sidebar'
import { useAuthStore } from './stores/authStore'
import { useUserProfile, useMachineIdCheck } from './hooks/useAgency'
import { AuthPage } from './components/Auth/AuthPage'
import { AgencySetup } from './components/agency/AgencySetup'
import { AgencySelection } from './components/agency/AgencySelection'
import { AgencyJoinRequest } from './components/agency/AgencyJoinRequest'
import { MachineIdMismatch } from './components/agency/MachineIdMismatch'
import { MachineIdRegistration } from './components/agency/MachineIdRegistration'
//import { SubscriptionExpired } from './components/agency/SubscriptionExpired'

import * as TanStackQueryProvider from './integrations/tanstack-query/root-provider.tsx'

import './styles.css'
import reportWebVitals from './reportWebVitals.ts'

const hashHistory = createHashHistory()

const routeTitles: Record<string, string> = {
  '/': 'Home',
  '/offers': '매물 관리',
  '/batches': '배치 관리',
  '/settings': '설정',
  '/crawler-test': '크롤러 테스트',
}

function RootComponent() {
  const router = useRouterState()
  const currentPath = router.location.pathname
  const title = routeTitles[currentPath] || '이실장 광고 자동화'
  const { user, loading, initialized, initialize, signOut } = useAuthStore()

  // User Profile 조회
  const {
    data: profile,
    isLoading: profileLoading,
    refetch: refetchProfile,
  } = useUserProfile(initialized && !!user)

  // Machine ID 체크
  const { machineIdMismatch, currentMachineId, registeredMachineId } = useMachineIdCheck(profile)

  // 디버깅용 로그
  console.log('[RootComponent] Machine ID Check:', {
    machineIdMismatch,
    currentMachineId,
    registeredMachineId,
    hasProfile: !!profile,
  })

  // Agency 설정 플로우 상태 관리
  const [agencySetupFlow, setAgencySetupFlow] = useState<'selection' | 'create' | 'join'>('selection')

  useEffect(() => {
    if (!initialized) {
      initialize()
    }
  }, [initialized, initialize])

  // 로딩 중
  if (loading || !initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">로딩 중...</div>
      </div>
    )
  }

  // 로그인하지 않은 경우
  if (!user) {
    return <AuthPage />
  }

  // Profile 로딩 중 (초기 로딩만 로딩 화면 표시)
  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">사용자 정보 확인 중...</div>
      </div>
    )
  }

  // Profile 없음 - Agency 설정 필요
  if (!profile) {
    if (agencySetupFlow === 'selection') {
      return (
        <AgencySelection
          onCreateNew={() => setAgencySetupFlow('create')}
          onJoinExisting={() => setAgencySetupFlow('join')}
          onLogout={signOut}
        />
      )
    } else if (agencySetupFlow === 'create') {
      return <AgencySetup onComplete={() => refetchProfile()} />
    } else if (agencySetupFlow === 'join') {
      return (
        <AgencyJoinRequest
          onBack={() => setAgencySetupFlow('selection')}
          onComplete={() => refetchProfile()}
        />
      )
    }
  }

  // Machine ID 등록 필요
  if (profile && !profile.machine_id) {
    return <MachineIdRegistration onComplete={() => refetchProfile()} onLogout={signOut} />
  }

  // Machine ID 불일치 (다른 기기에서 등록됨)
  if (machineIdMismatch) {
    return (
      <MachineIdMismatch
        onRequestChange={async () => {
          const result = await (window as any).agency.submitMachineIdRequest()
          if (result.success) {
            alert('기기 변경 요청이 제출되었습니다.\n관리자의 승인을 기다려주세요.')
          } else {
            alert(`요청 제출 실패: ${result.error}`)
          }
        }}
        onLogout={signOut}
      />
    )
  }

  // // 구독 만료 확인
  // if (profile && profile.agency) {
  //   const now = new Date()
  //   const endDate = new Date(profile.agency.subscription_end_date)
  //   const isExpired = endDate < now || !profile.agency.is_active

  //   if (isExpired) {
  //     return (
  //       <SubscriptionExpired
  //         agencyName={profile.agency.name}
  //         subscriptionEndDate={profile.agency.subscription_end_date}
  //         onLogout={signOut}
  //       />
  //     )
  //   }
  // }

  // 로그인 완료 - 메인 UI 표시
  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex-1 w-full">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4">
          <SidebarTrigger />
          <h1 className="text-xl font-semibold">{title}</h1>
        </header>
        <div className="flex-1">
          <Outlet />
        </div>
      </main>
      <TanStackRouterDevtools />
    </SidebarProvider>
  )
}


const rootRoute = createRootRoute({
  component: RootComponent,
})

const routeTree = rootRoute.addChildren([
  HomePage(rootRoute),
  OffersPage(rootRoute),
  BatchesPage(rootRoute),
  BatchDetailPage(rootRoute),
  SettingsPage(rootRoute),
  CrawlerTest(rootRoute),
])

const TanStackQueryProviderContext = TanStackQueryProvider.getContext()
const router = createRouter({
  routeTree,
  history: hashHistory,
  context: {
    ...TanStackQueryProviderContext,
  },
  defaultPreload: 'intent',
  scrollRestoration: true,
  defaultStructuralSharing: true,
  defaultPreloadStaleTime: 0,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('app')
if (rootElement && !rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <TanStackQueryProvider.Provider {...TanStackQueryProviderContext}>
        <RouterProvider router={router} />
      </TanStackQueryProvider.Provider>
    </StrictMode>,
  )
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals()
