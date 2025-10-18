/**
 * 날짜 범위 파싱 결과
 */
export interface ParsedDateRange {
  startDate: string | null; // 시작일 (예: "25.10.15")
  endDate: string | null; // 종료일 (예: "25.11.14")
  original: string; // 원본 문자열
}

/**
 * 날짜 범위 문자열을 파싱하여 시작일과 종료일을 분리
 *
 * 예시:
 * - "25.10.15 ~ 25.11.14" -> { startDate: "25.10.15", endDate: "25.11.14" }
 * - "25.10.16~25.11.15" -> { startDate: "25.10.16", endDate: "25.11.15" }
 * - "" -> { startDate: null, endDate: null }
 */
export function parseDateRange(dateRangeText: string): ParsedDateRange {
  const trimmed = dateRangeText.trim();

  if (!trimmed) {
    return {
      startDate: null,
      endDate: null,
      original: trimmed,
    };
  }

  // "~"로 분리 (공백 여부 무관)
  const parts = trimmed.split('~').map(s => s.trim());

  if (parts.length === 2) {
    return {
      startDate: parts[0],
      endDate: parts[1],
      original: trimmed,
    };
  }

  // 파싱 실패 시 원본 유지
  return {
    startDate: null,
    endDate: null,
    original: trimmed,
  };
}
