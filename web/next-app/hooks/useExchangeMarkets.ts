import useSWR from 'swr';

interface Market {
  base: string;
  quote: string;
  active: boolean;
  type: string;
  spot: boolean;
}

interface ExchangeMarketsResponse {
  symbols: string[];
  markets: Record<string, Market>;
  logos: Record<string, string>;
  exchange: string;
  quote_currencies: string[];
  total_markets: number;
  active_markets: number;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export interface UseExchangeMarketsReturn {
  markets: ExchangeMarketsResponse | undefined;
  symbols: string[];
  logos: Record<string, string>;
  exchange: string;
  isLoading: boolean;
  error: any;
  mutate: any;
}

/**
 * Hook to fetch available trading pairs from the configured exchange with logos
 */
export function useExchangeMarkets(quoteCurrencies?: string[]): UseExchangeMarketsReturn {
  const quotesParam = quoteCurrencies?.join(',') || 'USDT,USD,BUSD';
  const { data, error, isLoading, mutate } = useSWR<ExchangeMarketsResponse>(
    `/api/market/exchange-markets?quote_currencies=${quotesParam}`,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000, // Cache for 1 minute
    }
  );

  return {
    markets: data,
    symbols: data?.symbols || [],
    logos: data?.logos || {},
    exchange: data?.exchange || 'unknown',
    isLoading,
    error,
    mutate,
  };
}

