import { createRoute } from '@tanstack/react-router';
import type { AnyRootRoute } from '@tanstack/react-router';
import { Database, Layers } from 'lucide-react';
import { Link } from '@tanstack/react-router';

function HomePage() {
  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-12 text-center">
        <h1 className="text-5xl font-bold mb-4">이실장 광고 자동화</h1>
        <p className="text-xl text-gray-600">네이버 부동산 광고를 자동으로 관리하세요</p>
      </div>

      {/* 메인 작업 버튼 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        <Link to="/offers" className="block">
          <div className="bg-white p-8 rounded-xl shadow-lg border-2 border-transparent hover:border-blue-500 transition-all cursor-pointer group">
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
                <Database className="text-blue-600" size={40} />
              </div>
              <h2 className="text-2xl font-bold mb-2">매물 관리</h2>
              <p className="text-gray-600">
                매물을 크롤링하고<br />
                광고 재등록할 매물을 선택하세요
              </p>
            </div>
          </div>
        </Link>

        <div className="block opacity-50 cursor-not-allowed">
          <div className="bg-white p-8 rounded-xl shadow-lg border-2 border-transparent hover:border-green-500 transition-all cursor-pointer group">
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-green-200 transition-colors">
                <Layers className="text-green-600" size={40} />
              </div>
              <h2 className="text-2xl font-bold mb-2">배치 작업</h2>
              <p className="text-gray-600">
                광고 내리기/올리기 배치 작업을<br />
                생성하고 실행하세요
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 간단한 설명 */}
      <div className="mt-16 max-w-2xl mx-auto bg-gray-50 p-6 rounded-lg">
        <h3 className="font-bold mb-3">사용 방법</h3>
        <ol className="space-y-2 text-sm text-gray-700">
          <li>1. 매물 관리에서 이실장 매물을 크롤링합니다</li>
          <li>2. 재등록할 매물을 선택하고 필요시 가격을 수정합니다</li>
          <li>3. 배치 작업을 생성하여 광고를 자동으로 내리고 다시 올립니다</li>
        </ol>
      </div>
    </div>
  );
}

export default (parentRoute: AnyRootRoute) =>
  createRoute({
    path: '/',
    component: HomePage,
    getParentRoute: () => parentRoute,
  });
