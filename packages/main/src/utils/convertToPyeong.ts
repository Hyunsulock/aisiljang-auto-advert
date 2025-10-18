/**
 * 제곱미터를 평형으로 변환
 * 1평 = 3.3058㎡
 *
 * @param sqm 제곱미터 값 (문자열 또는 숫자)
 * @returns 평형 (소수점 첫째 자리까지, 문자열)
 */
export function convertToPyeong(sqm: string | number | null): string | null {
  if (!sqm) return null;

  const sqmNum = typeof sqm === 'string' ? parseFloat(sqm) : sqm;

  if (isNaN(sqmNum) || sqmNum <= 0) return null;

  const pyeong = sqmNum / 3.3058;
  return pyeong.toFixed(1);
}
