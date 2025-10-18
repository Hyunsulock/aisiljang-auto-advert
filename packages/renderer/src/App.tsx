import { useEffect } from 'react'
import { useAuthStore } from './stores/authStore'
import { AuthPage } from './components/Auth/AuthPage'
import { Button } from './components/ui/button'

function App() {
  const { user, loading, initialized, initialize, signOut } = useAuthStore()

  useEffect(() => {
    if (!initialized) {
      initialize()
    }
  }, [initialized, initialize])

  if (loading || !initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">로딩 중...</div>
      </div>
    )
  }

  if (!user) {
    return <AuthPage />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">AI실장 자동 광고</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user.email}</span>
            <Button variant="outline" onClick={signOut}>
              로그아웃
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">환영합니다!</h2>
          <p className="text-gray-600">
            로그인에 성공했습니다. 이제 AI실장 자동 광고 서비스를 이용할 수 있습니다.
          </p>
        </div>
      </main>
    </div>
  )
}

export default App
