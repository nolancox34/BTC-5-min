
import { GlobalState, Market, BTCState, Wallet } from '../types';

export class MarketSimulator {
  private static lastPrice = 68000;
  private static momentum = 5;
  private static priceHistory: number[] = [];

  /**
   * Fetches real-time BTC price using CoinCap API (CORS-friendly for browsers)
   */
  static async fetchLivePrice(): Promise<number> {
    try {
      // CoinCap is generally more permissive with browser-side requests than Binance
      const response = await fetch('https://api.coincap.io/v2/assets/bitcoin', {
        mode: 'cors',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const json = await response.json();
      const price = parseFloat(json.data.priceUsd);
      
      if (isNaN(price)) throw new Error("Invalid price format");
      
      this.lastPrice = price;
      return price;
    } catch (err) {
      console.warn("Primary live feed (CoinCap) failed. Attempting secondary fallback...", err);
      
      try {
        // Fallback to CoinGecko
        const fallback = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
        const fData = await fallback.json();
        const fPrice = parseFloat(fData.bitcoin.usd);
        if (!isNaN(fPrice)) {
          this.lastPrice = fPrice;
          return fPrice;
        }
      } catch (fErr) {
        console.error("All live price feeds failed. Using simulated jitter.", fErr);
      }
      
      // Ultimate fallback: jittered last known price
      const jitter = (Math.random() - 0.5) * 10;
      this.lastPrice += jitter;
      return this.lastPrice;
    }
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
    const priceChange1m = (newPrice - this.lastPrice) / this.lastPrice;
    
    // Calculate momentum based on recent price action
    this.priceHistory.push(newPrice);
    if (this.priceHistory.length > 12) this.priceHistory.shift(); // 1 minute window (5s * 12)
    
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

    // Update Markets with realistic Pricing
    const updatedMarkets = state.markets.map(m => {
      const elapsed = m.time_elapsed_seconds + 5;
      
      if (elapsed >= 300) {
        return this.createMarket(newPrice + (Math.random() - 0.5) * 100);
      }

      const priceDiff = newPrice - m.strike_price;
      const baseProb = 1 / (1 + Math.exp(-priceDiff / 15));
      
      const spread = 0.02 + Math.random() * 0.01;
      const yes_ask = Math.max(0.01, Math.min(0.99, baseProb + spread/2 + (Math.random() - 0.5) * 0.01));
      const no_ask = Math.max(0.01, Math.min(0.99, (1 - baseProb) + spread/2 + (Math.random() - 0.5) * 0.01));

      return { 
        ...m, 
        time_elapsed_seconds: elapsed,
        yes_ask,
        no_ask
      };
    });

    return {
      ...state,
      btc,
      markets: updatedMarkets
    };
  }

  private static generateMarkets(basePrice: number): Market[] {
    return [-100, -50, -25, 0, 25, 50, 100].map((offset) => 
      this.createMarket(basePrice + offset, Math.floor(Math.random() * 200))
    );
  }

  private static createMarket(strike: number, elapsed: number = 0): Market {
    const idSuffix = Math.random().toString(36).substr(2, 5).toUpperCase();
    return {
      id: `BTC-5M-${idSuffix}`,
      strike_price: Math.round(strike / 10) * 10,
      yes_ask: 0.5,
      no_ask: 0.5,
      liquidity_usd: 8000 + Math.random() * 20000,
      time_elapsed_seconds: elapsed,
      resolution_time: Date.now() + (300 - elapsed) * 1000
    };
  }
}
