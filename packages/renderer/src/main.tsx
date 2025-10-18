import { StrictMode, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRouter,
  useRouterState,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import CrawlerTest from './routes/crawler-test.tsx'
import HomePage from './routes/index.tsx'
import OffersPage from './routes/offers.tsx'
import BatchesPage from './routes/batches.tsx'
import SettingsPage from './routes/settings.tsx'

import { AppSidebar } from './components/AppSidebar'
import { SidebarProvider, SidebarTrigger } from './components/ui/sidebar'
import { useAuthStore } from './stores/authStore'
import { AuthPage } from './components/Auth/AuthPage'

import * as TanStackQueryProvider from './integrations/tanstack-query/root-provider.tsx'

import './styles.css'
import reportWebVitals from './reportWebVitals.ts'

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
  const { user, loading, initialized, initialize } = useAuthStore()

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

  // 로그인한 경우 기존 UI 표시
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
  SettingsPage(rootRoute),
  CrawlerTest(rootRoute),
])

const TanStackQueryProviderContext = TanStackQueryProvider.getContext()
const router = createRouter({
  routeTree,
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
