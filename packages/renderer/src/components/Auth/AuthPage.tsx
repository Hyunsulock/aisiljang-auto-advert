import { useState } from 'react'
import { LoginForm } from './LoginForm'
import { SignUpForm } from './SignUpForm'
import { Button } from '../ui/button'

export function AuthPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            AI실장 자동 광고
          </h1>
          <p className="text-gray-600">
            {mode === 'login' ? '로그인하여 시작하세요' : '새 계정을 만드세요'}
          </p>
        </div>

        <div className="flex gap-2 mb-6">
          <Button
            variant={mode === 'login' ? 'default' : 'outline'}
            className="flex-1"
            onClick={() => setMode('login')}
          >
            로그인
          </Button>
          <Button
            variant={mode === 'signup' ? 'default' : 'outline'}
            className="flex-1"
            onClick={() => setMode('signup')}
          >
            회원가입
          </Button>
        </div>

        {mode === 'login' ? <LoginForm /> : <SignUpForm />}
      </div>
    </div>
  )
}
