import { createRoute } from '@tanstack/react-router';
import type { AnyRootRoute } from '@tanstack/react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useState, useEffect } from 'react';
import { Save, Trash2, Key, CheckCircle } from 'lucide-react';

function SettingsPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasCredentials, setHasCredentials] = useState(false);
  const [savedUsername, setSavedUsername] = useState('');

  useEffect(() => {
    loadCredentials();
  }, []);

  const loadCredentials = async () => {
    try {
      const response = await (window as any).auth.getCredentials();
      if (response.success && response.data) {
        setHasCredentials(true);
        setSavedUsername(response.data.username);
      } else {
        setHasCredentials(false);
        setSavedUsername('');
      }
    } catch (error) {
      console.error('계정 정보 로드 실패:', error);
    }
  };

  const handleSave = async () => {
    if (!username.trim() || !password.trim()) {
      alert('아이디와 비밀번호를 모두 입력해주세요');
      return;
    }

    try {
      setLoading(true);
      const response = await (window as any).auth.saveCredentials({
        username,
        password,
      });

      if (response.success) {
        alert('계정 정보가 안전하게 저장되었습니다');
        setUsername('');
        setPassword('');
        await loadCredentials();
      } else {
        alert('저장 실패: ' + response.error);
      }
    } catch (error) {
      console.error('계정 정보 저장 오류:', error);
      alert('저장 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('저장된 계정 정보를 삭제하시겠습니까?')) {
      return;
    }

    try {
      setLoading(true);
      const response = await (window as any).auth.deleteCredentials();

      if (response.success) {
        alert('계정 정보가 삭제되었습니다');
        await loadCredentials();
      } else {
        alert('삭제 실패: ' + response.error);
      }
    } catch (error) {
      console.error('계정 정보 삭제 오류:', error);
      alert('삭제 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="space-y-6">
        {/* 헤더 */}
        <div>
          <h2 className="text-2xl font-bold">설정</h2>
          <p className="text-sm text-gray-500 mt-1">
            이실장 계정 정보를 안전하게 저장하여 자동 로그인을 활성화합니다
          </p>
        </div>

        {/* 저장된 계정 정보 */}
        {hasCredentials && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle size={20} />
              <div className="flex-1">
                <div className="font-medium">계정 정보가 저장되어 있습니다</div>
                <div className="text-sm text-green-600 mt-1">
                  아이디: {savedUsername}
                </div>
                <div className="text-xs text-green-600 mt-1">
                  배치 실행 시 자동으로 로그인됩니다
                </div>
              </div>
              <Button
                onClick={handleDelete}
                disabled={loading}
                variant="destructive"
                size="sm"
                className="flex items-center gap-1"
              >
                <Trash2 size={14} />
                삭제
              </Button>
            </div>
          </div>
        )}

        {/* 계정 정보 입력 */}
        <div className="bg-white border rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <Key className="text-gray-600" size={20} />
            <h3 className="text-lg font-semibold">
              {hasCredentials ? '계정 정보 변경' : '계정 정보 등록'}
            </h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                이실장 아이디
              </label>
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="이실장 로그인 아이디"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                이실장 비밀번호
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="이실장 로그인 비밀번호"
                disabled={loading}
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded p-3">
              <p className="text-xs text-blue-700">
                <strong>🔒 보안 안내:</strong> 계정 정보는 시스템 키체인을 사용하여 암호화되어 저장됩니다.
                이 정보는 배치 작업 실행 시 자동 로그인에만 사용됩니다.
              </p>
            </div>

            <Button
              onClick={handleSave}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2"
            >
              <Save size={16} />
              {loading ? '저장 중...' : hasCredentials ? '계정 정보 변경' : '계정 정보 저장'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default (parentRoute: AnyRootRoute) =>
  createRoute({
    path: '/settings',
    component: SettingsPage,
    getParentRoute: () => parentRoute,
  });
