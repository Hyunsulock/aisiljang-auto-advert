import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, UserPlus, LogOut } from 'lucide-react';

interface AgencySelectionProps {
  onCreateNew: () => void;
  onJoinExisting: () => void;
  onLogout: () => void;
}

export function AgencySelection({ onCreateNew, onJoinExisting, onLogout }: AgencySelectionProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 p-4 relative">
      {/* 로그아웃 버튼 */}
      <div className="absolute bottom-8 left-8">
        <Button variant="outline" onClick={onLogout} className="gap-2">
          <LogOut className="w-4 h-4" />
          로그아웃
        </Button>
      </div>

      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">중개사무소 설정</h1>
          <p className="text-gray-600">새로운 중개사무소를 생성하거나 기존 중개사무소에 가입하세요</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* 새 중개사무소 생성 */}
          <Card className="shadow-xl hover:shadow-2xl transition-shadow cursor-pointer" onClick={onCreateNew}>
            <CardHeader className="space-y-4">
              <div className="mx-auto bg-blue-100 rounded-full p-4 w-16 h-16 flex items-center justify-center">
                <Building2 className="w-8 h-8 text-blue-600" />
              </div>
              <CardTitle className="text-2xl text-center">새 중개사무소 생성</CardTitle>
              <CardDescription className="text-center text-base">
                새로운 중개사무소를 생성하고 관리자가 됩니다
              </CardDescription>
            </CardHeader>

            <CardContent>
              <ul className="space-y-2 mb-6 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">✓</span>
                  <span>즉시 사용 가능</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">✓</span>
                  <span>관리자 권한 자동 부여</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">✓</span>
                  <span>1개월 무료 체험</span>
                </li>
              </ul>

              <Button className="w-full h-12 text-base" size="lg" onClick={onCreateNew}>
                새 중개사무소 생성하기
              </Button>
            </CardContent>
          </Card>

          {/* 기존 중개사무소 가입 */}
          <Card className="shadow-xl hover:shadow-2xl transition-shadow cursor-pointer" onClick={onJoinExisting}>
            <CardHeader className="space-y-4">
              <div className="mx-auto bg-green-100 rounded-full p-4 w-16 h-16 flex items-center justify-center">
                <UserPlus className="w-8 h-8 text-green-600" />
              </div>
              <CardTitle className="text-2xl text-center">기존 중개사무소 가입</CardTitle>
              <CardDescription className="text-center text-base">
                이미 등록된 중개사무소에 멤버로 가입합니다
              </CardDescription>
            </CardHeader>

            <CardContent>
              <ul className="space-y-2 mb-6 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">✓</span>
                  <span>관리자 승인 필요</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">✓</span>
                  <span>중개사무소 데이터 공유</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">✓</span>
                  <span>멤버 권한으로 시작</span>
                </li>
              </ul>

              <Button className="w-full h-12 text-base" variant="outline" size="lg" onClick={onJoinExisting}>
                기존 중개사무소 가입하기
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}