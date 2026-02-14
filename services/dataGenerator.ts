
import { GlobalState, Market, BTCState } from '../types';

export class MarketSimulator {
  private static lastPrice = 65000;
  private static momentum = 5;
  private static priceHistory: number[] = [];
  public static networkStatus: 'stable' | 'degraded' | 'offline' = 'stable';

  /**
   * Fetches BTC price using Coinbase - the most reliable CORS-friendly browser API.
   */
  static async fetchLivePrice(): Promise<number> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      // Coinbase has excellent CORS support for frontend apps
      const response = await fetch('https://api.coinbase.com/v2/prices/spot?currency=USD', { 
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      
      clearTimeout(timeoutId);

      if (response.ok) {
        const json = await response.json();
        const price = parseFloat(json.data.amount);
        
        if (!isNaN(price) && price > 1000) {
          this.lastPrice = price;
          this.networkStatus = 'stable';
          return price;
        }
      }
      throw new Error("API Response invalid");
    } catch (e) {
      console.warn("Coinbase feed blocked or timed out. Falling back to Blockchain.info...");
      
      try {
        const altResponse = await fetch('https://blockchain.info/ticker?cors=true');
        const altJson = await altResponse.json();
        const altPrice = parseFloat(altJson.USD.last);
        if (!isNaN(altPrice)) {
          this.lastPrice = altPrice;
          this.networkStatus = 'stable';
          return altPrice;
        }
      } catch (altE) {
        console.error("All live feeds blocked by browser/network. Entering VIRTUAL mode.");
      }
    }

    // Entering Virtual Jitter mode to keep the dashboard functional
    this.networkStatus = 'degraded';
    const volatility = this.lastPrice * 0.0001; 
    const drift = (Math.random() - 0.49) * volatility; 
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
    if (this.priceHistory.length > 30) this.priceHistory.shift();
    
    const firstPrice = this.priceHistory[0];
    const momentumRaw = firstPrice ? ((newPrice - firstPrice) / firstPrice) * 1000 : 0; 
    this.momentum = Math.max(0, Math.min(10, 5 + (momentumRaw * 3)));

    const btc: BTCState = {
      price: newPrice,
      momentum_score: this.momentum,
      vol: Math.abs(momentumRaw) * 0.2,
      change_24h: state.btc.change_24h,
      change_1m: priceChange1m
    };

    const updatedMarkets = state.markets.map(m => {
      const elapsed = m.time_elapsed_seconds + 4; // Faster simulation steps
      
      if (elapsed >= 300) {
        return this.createMarket(newPrice + (Math.random() - 0.5) * 50);
      }

      const priceDiff = newPrice - m.strike_price;
      const baseProb = 1 / (1 + Math.exp(-priceDiff / 15));
      const spread = 0.01; 
      
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
    return [-60, -30, -15, 0, 15, 30, 60].map((offset) => 
      this.createMarket(basePrice + offset, Math.floor(Math.random() * 250))
    );
  }

  private static createMarket(strike: number, elapsed: number = 0): Market {
    const idSuffix = Math.random().toString(36).substr(2, 5).toUpperCase();
    return {
      id: `BTC-5M-${idSuffix}`,
      strike_price: Math.round(strike / 5) * 5,
      yes_ask: 0.5,
      no_ask: 0.5,
      liquidity_usd: 20000 + Math.random() * 40000,
      time_elapsed_seconds: elapsed,
      resolution_time: Date.now() + (300 - elapsed) * 1000
    };
  }
}
