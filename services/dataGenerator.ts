
import { GlobalState, Market, BTCState } from '../types';

export class MarketSimulator {
  private static lastPrice = parseFloat(localStorage.getItem('pm5_last_price') || '96420.50');
  private static binancePrice = parseFloat(localStorage.getItem('pm5_last_price') || '96425.10');
  private static bybitPrice = parseFloat(localStorage.getItem('pm5_last_price') || '96418.30');
  private static priceHistory: number[] = [];
  public static networkStatus: 'stable' | 'degraded' | 'offline' = 'stable';

  /**
   * Fetches real BTC price from a CORS-friendly public API.
   * If the fetch fails due to CORS or network issues, it falls back to a 
   * high-fidelity random walk starting from the last known price.
   */
  static async fetchLivePrice(): Promise<{poly: number, binance: number, bybit: number}> {
    try {
      const response = await fetch('https://api.blockchain.info/ticker?cors=true', {
        method: 'GET'
      });
      
      if (!response.ok) throw new Error("API_RESPONSE_NOT_OK");
      
      const data = await response.json();
      const realBasePrice = data.USD.last;

      localStorage.setItem('pm5_last_price', realBasePrice.toString());

      // ENHANCED: Sharper leads for bot to catch
      const binanceJitter = (Math.random() - 0.48) * 8.0; // Slightly more bias to lead
      const bybitJitter = (Math.random() - 0.52) * 9.0;

      this.binancePrice = realBasePrice + binanceJitter;
      this.bybitPrice = realBasePrice + bybitJitter;
      
      const targetPoly = (this.binancePrice + this.bybitPrice) / 2;
      // Laggier poly to increase edge visibility
      this.lastPrice += (targetPoly - this.lastPrice) * 0.65;

      this.networkStatus = 'stable';
      return { 
        poly: this.lastPrice, 
        binance: this.binancePrice, 
        bybit: this.bybitPrice 
      };
    } catch (e) {
      this.networkStatus = 'degraded';
      
      const volatility = this.lastPrice * 0.00025; // Higher vol for sim
      const move = (Math.random() - 0.5) * volatility;
      
      this.binancePrice += move * 1.25;
      this.bybitPrice += move * 0.85;
      this.lastPrice += (this.binancePrice - this.lastPrice) * 0.35;
      
      return { poly: this.lastPrice, binance: this.binancePrice, bybit: this.bybitPrice };
    }
  }

  static generateInitialState(): GlobalState {
    const startPrice = this.lastPrice;
    return {
      markets: this.generateMarkets(startPrice),
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
        price: startPrice,
        binance_price: startPrice + 2.5,
        bybit_price: startPrice - 1.8,
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
    if (this.priceHistory.length > 30) this.priceHistory.shift();
    
    const btc: BTCState = {
      price: prices.poly,
      binance_price: prices.binance,
      bybit_price: prices.bybit,
      momentum_score: 5 + (priceChange1m * 25000),
      vol: 0.09 + Math.random() * 0.06,
      vol_1m_pct: Math.abs(priceChange1m),
      change_24h: state.btc.change_24h,
      change_5m_pct: (prices.poly - state.btc.price) / state.btc.price,
      change_1m: priceChange1m
    };

    const updatedMarkets = state.markets.map(m => {
      const elapsed = m.time_elapsed_seconds + 2;
      
      if (elapsed >= 300) {
        return this.createMarket(prices.poly + (Math.random() - 0.5) * 35, 0);
      }

      const priceDiff = prices.poly - m.strike_price;
      const baseProb = 1 / (1 + Math.exp(-priceDiff / 10));
      
      // ENHANCED: Occasionally simulate a "Negative Spread" Arb opportunity
      const isArbMoment = Math.random() < 0.08;
      const spread = isArbMoment ? -0.015 : (0.004 + (Math.random() * 0.006));
      
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
      this.createMarket(basePrice + offset, Math.floor(Math.random() * 200))
    );
  }

  private static createMarket(strike: number, elapsed: number): Market {
    const idSuffix = Math.random().toString(36).substr(2, 5).toUpperCase();
    return {
      id: `BTC-5M-${idSuffix}`,
      slug: `btc-above-${Math.round(strike)}-5min`,
      strike_price: Math.round(strike),
      start_price: this.lastPrice,
      yes_ask: 0.5,
      no_ask: 0.5,
      volume_usd: 18000 + Math.random() * 55000,
      liquidity_usd: 22000 + Math.random() * 30000,
      time_elapsed_seconds: elapsed,
      resolution_time: Date.now() + (300 - elapsed) * 1000,
      orderbook_imbalance: 0
    };
  }
}
