import { api } from '../ui';
import type { MarketDetail } from './market-types';
export function getMarketDetail(id: string, mode: 'bid' | 'award' | 'contract', signal?: AbortSignal): Promise<MarketDetail> {
  return api<MarketDetail>(`/market/${encodeURIComponent(id)}?mode=${mode}`, signal);
}
