/**
 * 가격 파싱 유틸리티
 *
 * 예시:
 * - "175,000" -> { price: "175000", rent: null }
 * - "1,000 / 65" -> { price: "1000", rent: "65" }
 */
export interface ParsedPrice {
  price: string;
  rent: string | null;
}

export function parsePrice(priceText: string): ParsedPrice {
  const trimmed = priceText.trim();

  // 월세 형식 (보증금 / 월세)
  if (trimmed.includes('/')) {
    const [depositPart, rentPart] = trimmed.split('/').map(s => s.trim());
    return {
      price: depositPart.replace(/,/g, ''),
      rent: rentPart.replace(/,/g, ''),
    };
  }

  // 매매 또는 전세 (단일 가격)
  return {
    price: trimmed.replace(/,/g, ''),
    rent: null,
  };
}
