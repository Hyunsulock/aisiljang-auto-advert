/**
 * 주소 파싱 결과
 */
export interface ParsedAddress {
  name: string; // 매물 이름 (예: "고덕그라시움")
  dong: string | null; // 동 (예: "101")
  ho: string | null; // 호수 (예: "701")
  fullAddress: string; // 원본 전체 주소
}

/**
 * 주소 문자열을 파싱하여 매물 이름, 동, 호수를 분리
 *
 * 예시:
 * - "고덕그라시움 101동 701호" -> { name: "고덕그라시움", dong: "101", ho: "701" }
 * - "래미안아파트 305동 1502호" -> { name: "래미안아파트", dong: "305", ho: "1502" }
 * - "힐스테이트 A동 302호" -> { name: "힐스테이트", dong: "A", ho: "302" }
 * - "오피스텔 단일동" -> { name: "오피스텔", dong: null, ho: null }
 */
export function parseAddress(address: string): ParsedAddress {
  const trimmed = address.trim();

  // 동과 호수를 추출하는 정규식
  // 패턴: [숫자 또는 영문]동 [숫자]호
  const dongHoPattern = /(.+?)\s+([A-Z0-9가-힣]+)동\s+(\d+)호/;
  const match = trimmed.match(dongHoPattern);

  if (match) {
    return {
      name: match[1].trim(),
      dong: match[2],
      ho: match[3],
      fullAddress: trimmed,
    };
  }

  // 동만 있는 경우 (호수 없음)
  const dongOnlyPattern = /(.+?)\s+([A-Z0-9가-힣]+)동/;
  const dongMatch = trimmed.match(dongOnlyPattern);

  if (dongMatch) {
    return {
      name: dongMatch[1].trim(),
      dong: dongMatch[2],
      ho: null,
      fullAddress: trimmed,
    };
  }

  // 호수만 있는 경우 (동 없음)
  const hoOnlyPattern = /(.+?)\s+(\d+)호/;
  const hoMatch = trimmed.match(hoOnlyPattern);

  if (hoMatch) {
    return {
      name: hoMatch[1].trim(),
      dong: null,
      ho: hoMatch[2],
      fullAddress: trimmed,
    };
  }

  // 파싱 불가능한 경우 - 전체를 이름으로 처리
  return {
    name: trimmed,
    dong: null,
    ho: null,
    fullAddress: trimmed,
  };
}
