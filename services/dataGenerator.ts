
import { GlobalState, Market, BTCState } from '../types';

export class MarketSimulator {
  private static lastPrice = 65000;
  private static momentum = 5;
  private static priceHistory: number[] = [];
  public static networkStatus: 'stable' | 'degraded' | 'offline' = 'stable';

  /**
   * Fetches BTC price using highly permissive CORS-friendly endpoints.
   */
  static async fetchLivePrice(): Promise<number> {
    const endpoints = [
      {
        // CoinDesk is very reliable for browser-side requests
        url: 'https://api.coindesk.com/v1/bpi/currentprice.json',
        parse: (d: any) => parseFloat(d.bpi.USD.rate_float)
      },
      {
        // Blockchain.info is a solid secondary fallback
        url: 'https://blockchain.info/ticker?cors=true',
        parse: (d: any) => parseFloat(d.USD.last)
      }
    ];

    for (const api of endpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const response = await fetch(api.url, { 
          signal: controller.signal,
          headers: { 'Accept': 'application/json' }
        });
        
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          const price = api.parse(data);
          
          if (!isNaN(price) && price > 1000) { // Sanity check
            this.lastPrice = price;
            this.networkStatus = 'stable';
            return price;
          }
        }
      } catch (e) {
        console.warn(`Price feed failed for ${api.url}: ${e}`);
      }
    }

    // Ultimate fallback for offline/blocked environments
    this.networkStatus = 'degraded';
    const drift = (Math.random() - 0.48) * 12; // Slight upward bias
    this.lastPrice += drift;
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
    const priceChange1m = (newPrice - (this.lastPrice || 65000)) / (this.lastPrice || 65000);
    
    this.priceHistory.push(newPrice);
    if (this.priceHistory.length > 20) this.priceHistory.shift();
    
    const firstPrice = this.priceHistory[0];
    const momentumRaw = firstPrice ? ((newPrice - firstPrice) / firstPrice) * 1000 : 0; 
    this.momentum = Math.max(0, Math.min(10, 5 + (momentumRaw * 2)));

    const btc: BTCState = {
      price: newPrice,
      momentum_score: this.momentum,
      vol: Math.abs(momentumRaw) * 0.15,
      change_24h: state.btc.change_24h,
      change_1m: priceChange1m
    };

    const updatedMarkets = state.markets.map(m => {
      const elapsed = m.time_elapsed_seconds + 5;
      
      // Rotate finished markets
      if (elapsed >= 300) {
        return this.createMarket(newPrice + (Math.random() - 0.5) * 80);
      }

      const priceDiff = newPrice - m.strike_price;
      const baseProb = 1 / (1 + Math.exp(-priceDiff / 20));
      const spread = 0.015;
      
      return { 
        ...m, 
        time_elapsed_seconds: elapsed,
        yes_ask: Math.max(0.01, Math.min(0.99, baseProb + spread/2)),
        no_ask: Math.max(0.01, Math.min(0.99, (1 - baseProb) + spread/2))
      };
    });

    return { ...state, btc, markets: updatedMarkets };
  }

  private static generateMarkets(basePrice: number): Market[] {
    return [-100, -50, -25, 0, 25, 50, 100].map((offset) => 
      this.createMarket(basePrice + offset, Math.floor(Math.random() * 250))
    );
  }

  private static createMarket(strike: number, elapsed: number = 0): Market {
    const idSuffix = Math.random().toString(36).substr(2, 5).toUpperCase();
    return {
      id: `BTC-5M-${idSuffix}`,
      strike_price: Math.round(strike / 10) * 10,
      yes_ask: 0.5,
      no_ask: 0.5,
      liquidity_usd: 15000 + Math.random() * 30000,
      time_elapsed_seconds: elapsed,
      resolution_time: Date.now() + (300 - elapsed) * 1000
    };
  }
}
