/**
 * Preload API 타입 정의
 */

export interface CrawlerProgress {
  phase: 'auth' | 'fetching' | 'scraping' | 'ranking' | 'completed';
  current: number;
  total: number;
  message: string;
}

export interface CrawlerAPI {
  fetchOffers: (options?: { includeRanking?: boolean }) => Promise<{
    success: boolean;
    data?: any[];
    count?: number;
    error?: string;
  }>;
  cancel: () => Promise<{ success: boolean; error?: string }>;
  onProgress: (callback: (progress: CrawlerProgress) => void) => () => void;
}

export interface OffersAPI {
  getAll: () => Promise<{ success: boolean; data?: any[]; error?: string }>;
  getAdvertising: () => Promise<{ success: boolean; data?: any[]; error?: string }>;
  count: () => Promise<{ success: boolean; data?: number; error?: string }>;
}

export interface Credentials {
  username: string;
  password: string;
}

export interface AuthAPI {
  saveCredentials: (credentials: Credentials) => Promise<{ success: boolean; message?: string; error?: string }>;
  getCredentials: () => Promise<{ success: boolean; data?: { username: string; hasPassword: boolean } | null; error?: string }>;
  deleteCredentials: () => Promise<{ success: boolean; message?: string; error?: string }>;
  hasCredentials: () => Promise<{ success: boolean; data?: boolean; error?: string }>;
}

declare global {
  interface Window {
    Y3Jhd2xlcg: CrawlerAPI; // btoa('crawler')
    b2ZmZXJz: OffersAPI; // btoa('offers')
    auth: AuthAPI;
  }
}
