import opentype from 'opentype.js';
import * as path from 'path';
import { app } from 'electron';
import { fileURLToPath } from 'url';

// 폰트 캐시
let font: opentype.Font | null = null;

/**
 * 나눔손글씨 폰트 로드
 */
export async function loadFont(): Promise<opentype.Font> {
  if (font) return font;

  // ESM 환경에서 __dirname 대체
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // 폰트 파일 경로 (개발/프로덕션 환경 모두 지원)
  let fontPath: string;

  if (app.isPackaged) {
    // 프로덕션: resources 폴더
    fontPath = path.join(process.resourcesPath, 'assets/fonts/DXSglinegoTh-KSCpc-EUC-H.ttf');
  } else {
    // 개발: 번들된 JS 파일 기준 (packages/main/dist/index.js)
    // __dirname = packages/main/dist/ (번들 후)
    // 실제 폰트 위치 = packages/main/assets/fonts
    fontPath = path.join(__dirname, '../assets/fonts/DXSglinegoTh-KSCpc-EUC-H.ttf');
  }

  console.log(`📂 폰트 로드 중: ${fontPath}`);

  font = await opentype.load(fontPath);
  console.log(`✅ 폰트 로드 완료: ${font.names.fullName?.en || 'Unknown'}`);

  return font;
}

/**
 * 베지어 곡선을 점들로 분해
 */
function bezierToPoints(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  segments: number = 4
): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];

  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const t2 = t * t;
    const t3 = t2 * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;

    const x = mt3 * x0 + 3 * mt2 * t * x1 + 3 * mt * t2 * x2 + t3 * x3;
    const y = mt3 * y0 + 3 * mt2 * t * y1 + 3 * mt * t2 * y2 + t3 * y3;

    points.push({ x, y });
  }

  return points;
}

/**
 * 2차 베지어 곡선을 점들로 분해
 */
function quadraticToPoints(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  segments: number = 3
): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];

  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const mt = 1 - t;

    const x = mt * mt * x0 + 2 * mt * t * x1 + t * t * x2;
    const y = mt * mt * y0 + 2 * mt * t * y1 + t * t * y2;

    points.push({ x, y });
  }

  return points;
}

/**
 * 손글씨 느낌을 위한 랜덤 떨림 추가
 * @param amount 떨림 범위 (픽셀)
 */
function jitter(amount: number = 1.5): number {
  return (Math.random() - 0.5) * amount * 2;
}

/**
 * 두 경로가 유사한지 확인 (같은 원의 외곽/내곽 판별용)
 */
function isSimilarPath(
  path1: Array<{ x: number; y: number }>,
  path2: Array<{ x: number; y: number }>,
  threshold: number = 10
): boolean {
  if (path1.length < 2 || path2.length < 2) return false;

  // 각 경로의 중심점 계산
  const center1 = {
    x: path1.reduce((sum, p) => sum + p.x, 0) / path1.length,
    y: path1.reduce((sum, p) => sum + p.y, 0) / path1.length,
  };
  const center2 = {
    x: path2.reduce((sum, p) => sum + p.x, 0) / path2.length,
    y: path2.reduce((sum, p) => sum + p.y, 0) / path2.length,
  };

  // 중심점이 가까우면 유사한 경로로 판단
  const dist = Math.sqrt((center1.x - center2.x) ** 2 + (center1.y - center2.y) ** 2);
  return dist < threshold;
}

/**
 * 이름 전체의 경로를 마우스 좌표 배열로 변환
 * 단순하게: 폰트 경로를 그대로 따라 그림
 * @returns 각 획별 좌표 배열 (Canvas 내부 상대 좌표)
 */
export function getNamePaths(
  name: string,
  canvasWidth: number,
  canvasHeight: number
): Array<Array<{ x: number; y: number }>> {
  if (!font) throw new Error('Font not loaded. Call loadFont() first.');

  // 폰트 크기 계산 (Canvas 높이의 40% 또는 최대 60px)
  const fontSize = Math.min(60, canvasHeight * 0.4);

  // 전체 텍스트 너비 계산
  const totalWidth = font.getAdvanceWidth(name, fontSize);

  // 중앙 정렬을 위한 시작 위치
  const startX = (canvasWidth - totalWidth) / 2;
  const startY = canvasHeight / 2 + fontSize / 3; // 베이스라인 조정

  const allStrokes: Array<Array<{ x: number; y: number }>> = [];
  let currentX = startX;

  // 각 글자에 대해 경로 추출
  for (const char of name) {
    const glyphPath = font.getPath(char, currentX, startY, fontSize);
    const charStrokes: Array<Array<{ x: number; y: number }>> = [];

    let currentStroke: Array<{ x: number; y: number }> = [];
    let strokeStartX = 0;
    let strokeStartY = 0;
    let lastX = 0;
    let lastY = 0;

    for (const cmd of glyphPath.commands) {
      switch (cmd.type) {
        case 'M': // MoveTo - 새 획 시작
          // 이전 획이 있으면 저장
          if (currentStroke.length > 1) {
            charStrokes.push([...currentStroke]);
          }
          currentStroke = [{ x: cmd.x, y: cmd.y }];
          strokeStartX = cmd.x;
          strokeStartY = cmd.y;
          lastX = cmd.x;
          lastY = cmd.y;
          break;

        case 'L': // LineTo - 직선
          currentStroke.push({ x: cmd.x, y: cmd.y });
          lastX = cmd.x;
          lastY = cmd.y;
          break;

        case 'C': // CurveTo - 3차 베지어 곡선
          const cubicPoints = bezierToPoints(lastX, lastY, cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y, 3);
          currentStroke.push(...cubicPoints);
          lastX = cmd.x;
          lastY = cmd.y;
          break;

        case 'Q': // QuadraticCurveTo - 2차 베지어 곡선
          const quadPoints = quadraticToPoints(lastX, lastY, cmd.x1, cmd.y1, cmd.x, cmd.y, 2);
          currentStroke.push(...quadPoints);
          lastX = cmd.x;
          lastY = cmd.y;
          break;

        case 'Z': // ClosePath - 닫힌 경로
          if (currentStroke.length > 1) {
            // 마지막 점이 시작점과 멀면 닫아줌 (원형 등)
            const lastPt = currentStroke[currentStroke.length - 1];
            const distToStart = Math.sqrt((lastPt.x - strokeStartX) ** 2 + (lastPt.y - strokeStartY) ** 2);
            if (distToStart > 2) {
              // 시작점으로 돌아가지 않고, 그냥 저장 (이미 시작점 근처까지 왔으면 닫지 않음)
            }
            charStrokes.push([...currentStroke]);
          }
          currentStroke = [];
          break;
      }
    }

    // 열린 경로가 남아있으면 저장
    if (currentStroke.length > 1) {
      charStrokes.push([...currentStroke]);
    }

    // 중복 경로 제거 (외곽선/내곽선 중 하나만 사용)
    const filteredStrokes: Array<Array<{ x: number; y: number }>> = [];
    for (const stroke of charStrokes) {
      // 이미 추가된 경로 중 유사한 것이 있는지 확인
      const hasSimilar = filteredStrokes.some(existing => isSimilarPath(existing, stroke));
      if (!hasSimilar) {
        // 손글씨 느낌을 위해 각 점에 약간의 떨림 추가
        const jitteredStroke = stroke.map(pt => ({
          x: pt.x + jitter(1.2),
          y: pt.y + jitter(1.2),
        }));
        filteredStrokes.push(jitteredStroke);
      }
    }

    allStrokes.push(...filteredStrokes);

    // 다음 글자 위치
    currentX += font.getAdvanceWidth(char, fontSize);
  }

  return allStrokes;
}
