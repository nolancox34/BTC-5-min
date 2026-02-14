
import { GlobalState, BotDecision, Market } from '../types';

export class ProfitMaxEngine {
  private static CES_MIN_THRESHOLD = 7.5;
  private static ARB_TRIGGER = 0.97; // Post-fee target
  private static MIN_ELAPSED_FOR_DIRECTIONAL = 120;

  static calculate(state: GlobalState): BotDecision[] {
    const { markets, btc, wallet, historical_summary } = state;
    
    // Adaptive threshold based on recent performance
    const dynamicThreshold = historical_summary.recent_resolved_wr < 70 
      ? this.CES_MIN_THRESHOLD + 0.5 
      : this.CES_MIN_THRESHOLD;

    return markets.map((m) => {
      // 1. ArbScore (0-10)
      const arbSum = m.yes_ask + m.no_ask;
      const arbScore = Math.max(0, (this.ARB_TRIGGER - arbSum) * 80);

      // 2. CEXLagScore (0-10) - Enhanced to monitor multiple feeds
      const binanceDelta = btc.binance_price - m.start_price;
      const bybitDelta = btc.bybit_price - m.start_price;
      
      // Check for consensus between exchanges
      const consensus = (binanceDelta > 0 && bybitDelta > 0) || (binanceDelta < 0 && bybitDelta < 0);
      const leadDelta = Math.abs(binanceDelta) > Math.abs(bybitDelta) ? binanceDelta : bybitDelta;
      
      const lagMagnitude = Math.abs(leadDelta) * 4;
      let cexLagScore = Math.min(10, lagMagnitude + (Math.abs(leadDelta - btc.price) > 2 ? 3 : 0));
      
      // Penalize if exchanges disagree (volatile noise)
      if (!consensus) cexLagScore *= 0.5;

      // 3. LateBias (0-10)
      const isLate = m.time_elapsed_seconds >= this.MIN_ELAPSED_FOR_DIRECTIONAL;
      const lateBias = isLate ? 9 : 2;

      // 4. Momentum & Edge
      const momentumScore = (btc.change_5m_pct * 3000) + (btc.momentum_score * 2.5) + (btc.vol_1m_pct * 2000) + (m.orderbook_imbalance * 0.1) + (cexLagScore * 1.5);
      
      const timeFactor = m.time_elapsed_seconds / 300;
      const estYesProb = 0.5 + (momentumScore - 5) * 0.09 + (timeFactor * 0.12);
      const yesEdge = estYesProb - m.yes_ask;
      const noEdge = (1 - estYesProb) - m.no_ask;
      const rawEdge = Math.max(yesEdge, noEdge);
      const edgeScore = Math.min(10, rawEdge * 12);

      // 5. Composite Edge Score (CES)
      let ces = (arbScore * 0.45) + (edgeScore * 0.25) + (lateBias * 0.20) + (m.liquidity_usd > 6000 ? 0.9 : 0.4);

      if (cexLagScore > 7 && isLate) ces += 2.5;

      // 6. Execution Logic
      let action: BotDecision['action'] = 'HOLD';
      let side: BotDecision['side'] = 'YES';
      let amount = 0;
      let reason = "SIGNAL_STRENGTH_LOW";

      // Arb Priority
      if (arbScore >= 6.0) {
        action = 'BUY_BOTH';
        side = 'BOTH';
        amount = Math.min(wallet.balance_usdc * 0.018, m.liquidity_usd * 0.25);
        reason = `ARB ${arbScore.toFixed(1)}: Building pair @ ${arbSum.toFixed(3)}`;
      } 
      // Directional Precision
      else if (ces >= dynamicThreshold && isLate && rawEdge > 0.05) {
        action = yesEdge > noEdge ? 'BUY_YES' : 'BUY_NO';
        side = yesEdge > noEdge ? 'YES' : 'NO';
        
        const sizePct = Math.min(0.03, (ces - 6) * 0.012);
        amount = Math.max(10, wallet.balance_usdc * sizePct);
        amount = Math.max(amount, wallet.balance_usdc * 0.008);
        
        reason = `CEX_LAG_MULTI ${ces.toFixed(1)}: Confirming ${consensus ? 'Consensus' : 'Divergence'}`;
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
