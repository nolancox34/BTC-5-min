
import { GlobalState, BotDecision, Market } from '../types';

export class ProfitMaxEngine {
  private static CES_MIN_THRESHOLD = 6.8; // Adjusted down for higher frequency execution
  private static ARB_TRIGGER = 1.01; // Adjusted trigger to account for simulated inefficiency
  private static MIN_ELAPSED_FOR_DIRECTIONAL = 90; // Catch trends earlier

  static calculate(state: GlobalState): BotDecision[] {
    const { markets, btc, wallet, historical_summary } = state;
    
    // Adaptive threshold based on recent performance
    const dynamicThreshold = historical_summary.recent_resolved_wr < 70 
      ? this.CES_MIN_THRESHOLD + 0.3 
      : this.CES_MIN_THRESHOLD;

    return markets.map((m) => {
      // 1. ArbScore (0-10)
      const arbSum = m.yes_ask + m.no_ask;
      // Occasionally sum will be < 1.01 in updated simulator
      const arbScore = Math.max(0, (this.ARB_TRIGGER - arbSum) * 120);

      // 2. CEXLagScore (0-10)
      const binanceDelta = btc.binance_price - m.start_price;
      const bybitDelta = btc.bybit_price - m.start_price;
      
      const consensus = (binanceDelta > 0 && bybitDelta > 0) || (binanceDelta < 0 && bybitDelta < 0);
      const leadExchangePrice = Math.abs(binanceDelta) > Math.abs(bybitDelta) ? btc.binance_price : btc.bybit_price;
      const lagMagnitude = Math.abs(leadExchangePrice - btc.price);
      
      // Increased multiplier for lag magnitude
      let cexLagScore = Math.min(10, (lagMagnitude * 5) + (consensus ? 2 : 0));
      
      if (!consensus) cexLagScore *= 0.4;

      // 3. LateBias (0-10)
      const isLate = m.time_elapsed_seconds >= this.MIN_ELAPSED_FOR_DIRECTIONAL;
      const lateBias = isLate ? 9.5 : 3.0;

      // 4. Momentum & Edge
      const momentumScore = (btc.change_5m_pct * 4000) + (btc.momentum_score * 3.0) + (btc.vol_1m_pct * 2500) + (m.orderbook_imbalance * 0.15);
      
      const timeFactor = m.time_elapsed_seconds / 300;
      const estYesProb = 0.5 + (momentumScore - 5) * 0.12 + (timeFactor * 0.15);
      const yesEdge = estYesProb - m.yes_ask;
      const noEdge = (1 - estYesProb) - m.no_ask;
      const rawEdge = Math.max(yesEdge, noEdge);
      const edgeScore = Math.min(10, rawEdge * 18); // More sensitive edge scoring

      // 5. Composite Edge Score (CES)
      // Recalibrated weights to prioritize Lag and Edge
      let ces = (arbScore * 0.35) + (edgeScore * 0.30) + (lateBias * 0.15) + (cexLagScore * 0.20);

      // Flash-Snipe Bonus: If lag is extreme, override everything
      if (cexLagScore > 8.0 && isLate) ces = Math.max(ces, 9.2);

      // 6. Execution Logic
      let action: BotDecision['action'] = 'HOLD';
      let side: BotDecision['side'] = 'YES';
      let amount = 0;
      let reason = "SIGNAL_BELOW_THRESHOLD";

      if (arbScore >= 5.0) {
        action = 'BUY_BOTH';
        side = 'BOTH';
        amount = Math.min(wallet.balance_usdc * 0.02, m.liquidity_usd * 0.3);
        reason = `ARB_CAPTURE: Efficiency mismatch @ ${arbSum.toFixed(3)}`;
      } 
      else if (ces >= dynamicThreshold && isLate) {
        action = yesEdge > noEdge ? 'BUY_YES' : 'BUY_NO';
        side = yesEdge > noEdge ? 'YES' : 'NO';
        
        const sizePct = Math.min(0.04, (ces - 6) * 0.015);
        amount = Math.max(12, wallet.balance_usdc * sizePct);
        
        reason = `SNIPE_EDGE: CES ${ces.toFixed(1)} Lag/Trend confirmed.`;
      }

      return {
        market_id: m.id,
        slug: m.slug,
        action,
        side,
        amount_usdc: amount,
        confidence: Math.round(Math.min(100, ces * 10)),
        est_profit_pct: rawEdge * 100,
        ces,
        learned_from_history: reason,
        timestamp: new Date().toISOString()
      };
    });
  }
}
