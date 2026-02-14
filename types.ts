
export interface Market {
  id: string;
  strike_price: number;
  yes_ask: number;
  no_ask: number;
  liquidity_usd: number;
  time_elapsed_seconds: number;
  resolution_time: number; // timestamp
}

export interface HistoricalSummary {
  recent_resolved_wr: number;
  arb_frequency_last_hour: number;
  avg_momentum_wr_bin: {
    low: number;
    mid: number;
    high: number;
  };
}

export interface BTCState {
  price: number;
  momentum_score: number;
  vol: number;
  change_24h: number;
  change_1m: number;
}

export interface Wallet {
  balance_usdc: number;
  active_positions: number;
  pnl_today: number;
}

export interface BotDecision {
  market_id: string;
  action: 'BUY_BOTH' | 'BUY_YES' | 'BUY_NO' | 'HOLD' | 'AUTO_HEDGE' | 'SELL';
  amount_usdc: number;
  arb_score: number;
  edge_score: number;
  ces: number;
  historical_bias: number;
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
