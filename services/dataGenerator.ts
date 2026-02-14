
import { GlobalState, Market, BTCState } from '../types';

export class MarketSimulator {
  private static lastPrice = 65000;
  private static binancePrice = 65000;
  private static bybitPrice = 65000;
  private static priceHistory: number[] = [];
  public static networkStatus: 'stable' | 'degraded' | 'offline' = 'stable';

  static async fetchLivePrice(): Promise<{poly: number, binance: number, bybit: number}> {
    try {
      // Simulate CEX Lag: Lead exchange moves first
      const volatility = this.lastPrice * 0.00025;
      const globalMove = (Math.random() - 0.49) * volatility;
      
      // Exchanges react with slight variation
      this.binancePrice += globalMove + (Math.random() - 0.5) * (volatility * 0.1);
      this.bybitPrice += globalMove + (Math.random() - 0.5) * (volatility * 0.15);
      
      // Poly price follows the leading CEX with noise and slight dampening
      const leadPrice = Math.abs(this.binancePrice - this.lastPrice) > Math.abs(this.bybitPrice - this.lastPrice) 
        ? this.binancePrice 
        : this.bybitPrice;

      this.lastPrice += (leadPrice - this.lastPrice) * 0.85 + (Math.random() - 0.5) * (volatility * 0.2);
      
      this.networkStatus = 'stable';
      return { 
        poly: this.lastPrice, 
        binance: this.binancePrice, 
        bybit: this.bybitPrice 
      };
    } catch (e) {
      this.networkStatus = 'degraded';
      return { poly: this.lastPrice, binance: this.binancePrice, bybit: this.bybitPrice };
    }
  }

  static generateInitialState(): GlobalState {
    const prices = { poly: 65000, binance: 65000, bybit: 65000 };
    return {
      markets: this.generateMarkets(prices.poly),
      historical_summary: {
        recent_resolved_wr: 85,
        arb_hits_last_hour: 4,
        avg_late_entry_wr: 78,
        cex_lag_success_rate: 92,
        avg_momentum_wr_bin: { low: 55, mid: 72, high: 93 }
      },
      wallet: {
        balance_usdc: 1000,
        active_positions: 0,
        pnl_today: 0,
        open_positions: []
      },
      btc: {
        price: prices.poly,
        binance_price: prices.binance,
        bybit_price: prices.bybit,
        momentum_score: 5.0,
        vol: 0.12,
        vol_1m_pct: 0.002,
        change_24h: 0.015,
        change_5m_pct: 0.0005,
        change_1m: 0.0001
      },
      decisions: []
    };
  }

  static async tick(state: GlobalState): Promise<GlobalState> {
    const prices = await this.fetchLivePrice();
    const priceChange1m = (prices.poly - (this.priceHistory[0] || prices.poly)) / (this.priceHistory[0] || prices.poly);
    
    this.priceHistory.push(prices.poly);
    if (this.priceHistory.length > 12) this.priceHistory.shift();
    
    const btc: BTCState = {
      price: prices.poly,
      binance_price: prices.binance,
      bybit_price: prices.bybit,
      momentum_score: 5 + (priceChange1m * 10000),
      vol: 0.1 + Math.random() * 0.1,
      vol_1m_pct: Math.abs(priceChange1m),
      change_24h: state.btc.change_24h,
      change_5m_pct: (prices.poly - state.btc.price) / state.btc.price,
      change_1m: priceChange1m
    };

    const updatedMarkets = state.markets.map(m => {
      const elapsed = m.time_elapsed_seconds + 5;
      
      if (elapsed >= 300) {
        return this.createMarket(prices.poly + (Math.random() - 0.5) * 60);
      }

      const priceDiff = prices.poly - m.strike_price;
      const baseProb = 1 / (1 + Math.exp(-priceDiff / 10));
      const spread = 0.01 + (Math.random() * 0.005);
      
      return { 
        ...m, 
        time_elapsed_seconds: elapsed,
        yes_ask: Math.max(0.01, Math.min(0.99, baseProb + spread/2)),
        no_ask: Math.max(0.01, Math.min(0.99, (1 - baseProb) + spread/2)),
        orderbook_imbalance: (Math.random() - 0.5) * 20
      };
    });

    return { ...state, btc, markets: updatedMarkets };
  }

  private static generateMarkets(basePrice: number): Market[] {
    return [-30, -15, 0, 15, 30].map((offset) => 
      this.createMarket(basePrice + offset, Math.floor(Math.random() * 250))
    );
  }

  private static createMarket(strike: number, elapsed: number = 0): Market {
    const idSuffix = Math.random().toString(36).substr(2, 5).toUpperCase();
    return {
      id: `BTC-5M-${idSuffix}`,
      slug: `btc-above-${Math.round(strike)}-5min`,
      strike_price: Math.round(strike),
      start_price: this.lastPrice,
      yes_ask: 0.5,
      no_ask: 0.5,
      volume_usd: 5000 + Math.random() * 20000,
      liquidity_usd: 8000 + Math.random() * 15000,
      time_elapsed_seconds: elapsed,
      resolution_time: Date.now() + (300 - elapsed) * 1000,
      orderbook_imbalance: 0
    };
  }
}
