
export interface Market {
  id: string;
  slug: string;
  strike_price: number;
  start_price: number;
  yes_ask: number;
  no_ask: number;
  volume_usd: number;
  liquidity_usd: number;
  time_elapsed_seconds: number;
  resolution_time: number;
  orderbook_imbalance: number; // -10 to 10
}

export interface HistoricalSummary {
  recent_resolved_wr: number;
  arb_hits_last_hour: number;
  avg_late_entry_wr: number;
  cex_lag_success_rate: number;
  avg_momentum_wr_bin: {
    low: number;
    mid: number;
    high: number;
  };
}

export interface BTCState {
  price: number;
  binance_price: number;
  bybit_price: number;
  momentum_score: number;
  vol: number;
  vol_1m_pct: number;
  change_24h: number;
  change_5m_pct: number;
  change_1m: number;
}

export interface Wallet {
  balance_usdc: number;
  active_positions: number;
  pnl_today: number;
  open_positions: any[];
}

export interface BotDecision {
  market_id: string;
  slug: string;
  action: 'BUY_BOTH' | 'BUY_YES' | 'BUY_NO' | 'HOLD' | 'AUTO_HEDGE' | 'SELL';
  side: 'YES' | 'NO' | 'BOTH';
  amount_usdc: number;
  confidence: number;
  est_profit_pct: number;
  ces: number;
  learned_from_history: string;
  timestamp: string;
}

export interface GlobalState {
  markets: Market[];
  historical_summary: HistoricalSummary;
  wallet: Wallet;
  btc: BTCState;
  decisions: BotDecision[];
}
