
import { GlobalState, Market, BTCState } from '../types';

export class MarketSimulator {
  private static lastPrice = 68000;
  private static momentum = 5;
  private static priceHistory: number[] = [];
  public static networkStatus: 'stable' | 'degraded' | 'offline' = 'stable';

  /**
   * Robust Price Aggregator
   * Tries multiple browser-friendly public APIs to bypass CORS and rate limits.
   */
  static async fetchLivePrice(): Promise<number> {
    const endpoints = [
      {
        url: 'https://api.coincap.io/v2/assets/bitcoin',
        parse: (d: any) => parseFloat(d.data.priceUsd)
      },
      {
        url: 'https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT',
        parse: (d: any) => parseFloat(d.price)
      },
      {
        url: 'https://api.kraken.com/0/public/Ticker?pair=XBTUSD',
        parse: (d: any) => parseFloat(d.result.XXBTZUSD.c[0])
      }
    ];

    for (const api of endpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout

        const response = await fetch(api.url, { 
          signal: controller.signal,
          headers: { 'Accept': 'application/json' }
        });
        
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          const price = api.parse(data);
          
          if (!isNaN(price) && price > 0) {
            this.lastPrice = price;
            this.networkStatus = 'stable';
            return price;
          }
        }
      } catch (e) {
        console.warn(`Price feed failed for ${api.url}, trying next...`);
      }
    }

    // Fallback logic
    this.networkStatus = 'degraded';
    const jitter = (Math.random() - 0.5) * 5;
    this.lastPrice += jitter;
    return this.lastPrice;
  }

  static generateInitialState(): GlobalState {
    return {
      markets: this.generateMarkets(this.lastPrice),
      historical_summary: {
        recent_resolved_wr: 82,
        arb_frequency_last_hour: 4,
        avg_momentum_wr_bin: { low: 52, mid: 68, high: 91 }
      },
      wallet: {
        balance_usdc: 1000,
        active_positions: 0,
        pnl_today: 0
      },
      btc: {
        price: this.lastPrice,
        momentum_score: 5.0,
        vol: 0.12,
        change_24h: 0.015,
        change_1m: 0.0001
      },
      decisions: []
    };
  }

  static async tick(state: GlobalState): Promise<GlobalState> {
    const newPrice = await this.fetchLivePrice();
    const priceChange1m = (newPrice - this.lastPrice) / (this.lastPrice || 1);
    
    this.priceHistory.push(newPrice);
    if (this.priceHistory.length > 12) this.priceHistory.shift();
    
    const firstPrice = this.priceHistory[0];
    const momentumRaw = firstPrice ? ((newPrice - firstPrice) / firstPrice) * 1000 : 0; 
    this.momentum = Math.max(0, Math.min(10, 5 + momentumRaw));

    const btc: BTCState = {
      price: newPrice,
      momentum_score: this.momentum,
      vol: Math.abs(momentumRaw) * 0.1,
      change_24h: state.btc.change_24h,
      change_1m: priceChange1m
    };

    const updatedMarkets = state.markets.map(m => {
      const elapsed = m.time_elapsed_seconds + 5;
      
      if (elapsed >= 300) {
        return this.createMarket(newPrice + (Math.random() - 0.5) * 60);
      }

      const priceDiff = newPrice - m.strike_price;
      const baseProb = 1 / (1 + Math.exp(-priceDiff / 15));
      const spread = 0.01 + Math.random() * 0.01; // Tighter spreads for PRO tier simulation
      
      return { 
        ...m, 
        time_elapsed_seconds: elapsed,
        yes_ask: Math.max(0.01, Math.min(0.99, baseProb + spread/2 + (Math.random() - 0.5) * 0.005)),
        no_ask: Math.max(0.01, Math.min(0.99, (1 - baseProb) + spread/2 + (Math.random() - 0.5) * 0.005))
      };
    });

    return { ...state, btc, markets: updatedMarkets };
  }

  private static generateMarkets(basePrice: number): Market[] {
    return [-80, -40, -20, 0, 20, 40, 80].map((offset) => 
      this.createMarket(basePrice + offset, Math.floor(Math.random() * 200))
    );
  }

  private static createMarket(strike: number, elapsed: number = 0): Market {
    const idSuffix = Math.random().toString(36).substr(2, 5).toUpperCase();
    return {
      id: `BTC-5M-${idSuffix}`,
      strike_price: Math.round(strike / 5) * 5,
      yes_ask: 0.5,
      no_ask: 0.5,
      liquidity_usd: 12000 + Math.random() * 25000,
      time_elapsed_seconds: elapsed,
      resolution_time: Date.now() + (300 - elapsed) * 1000
    };
  }
}
