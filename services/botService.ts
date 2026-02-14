
import { GlobalState, BotDecision, Market } from '../types';

export class ProfitMaxEngine {
  private static cesThreshold = 7.0;
  private static arbTrigger = 0.97;

  static calculate(state: GlobalState): BotDecision[] {
    // Dynamic Threshold based on historical performance
    if (state.historical_summary.recent_resolved_wr < 70) {
      this.cesThreshold = 7.5;
    } else {
      this.cesThreshold = 7.0;
    }

    // Saturation Penalty: Reduce conviction if we already have many open positions
    const saturationPenalty = Math.max(0, (state.wallet.active_positions - 5) * 0.5);

    const decisions: BotDecision[] = state.markets.map((market) => {
      // 1. ArbScore
      const arbSum = market.yes_ask + market.no_ask;
      const arbScore = Math.max(0, (this.arbTrigger - arbSum) * 80); // Increased sensitivity

      // 2. HistoricalBias
      let historicalBias = market.time_elapsed_seconds > 120 ? 8 : 4;
      if (state.historical_summary.recent_resolved_wr > 80) historicalBias += 2;
      
      // 3. Momentum Influence
      const momentumImpact = (state.btc.momentum_score - 5) * 0.8;
      
      // 4. Edge Calculation
      const estProb = 0.5 + (momentumImpact / 10) + (market.time_elapsed_seconds > 200 ? 0.15 : 0);
      const yesEdge = estProb - market.yes_ask;
      const noEdge = (1 - estProb) - market.no_ask;
      const edgeScore = Math.max(yesEdge, noEdge) * 12;

      // 5. CES Composite
      let ces = (arbScore * 0.45) + 
                (edgeScore * 0.30) + 
                (historicalBias * 0.20) + 
                (market.liquidity_usd > 10000 ? 5 : 2) * 0.05;

      // Late Momentum Sweet Spot Boost
      if (market.time_elapsed_seconds > 180 && state.btc.momentum_score > 7.5) {
        ces += 1.5;
      }

      // Context Volatility Boost
      if (Math.abs(state.btc.change_1m) > 0.005) {
        ces *= 1.3;
      }

      // Apply Saturation Penalty
      ces -= saturationPenalty;

      // Trade Execution Logic
      let action: BotDecision['action'] = 'HOLD';
      let amount = 0;
      let learned = "Learning from resolution lag...";

      if (arbScore >= 6.0) {
        action = 'BUY_BOTH';
        amount = Math.min(state.wallet.balance_usdc * 0.02, market.liquidity_usd * 0.1);
        learned = "Risk-Free Arb: Spread captured post-fees.";
      } else if (ces >= this.cesThreshold && market.time_elapsed_seconds > 90) {
        action = yesEdge > noEdge ? 'BUY_YES' : 'BUY_NO';
        // Progressive sizing: more conviction = larger position
        const sizeMultiplier = Math.min(2.5, (ces - this.cesThreshold) + 1);
        amount = (state.wallet.balance_usdc * 0.01) * sizeMultiplier;
        learned = `High-CES Edge: ${ces.toFixed(1)} detected at T+${market.time_elapsed_seconds}s.`;
      }

      return {
        market_id: market.id,
        action,
        amount_usdc: amount,
        arb_score: arbScore,
        edge_score: edgeScore,
        ces: ces,
        historical_bias: historicalBias,
        learned_from_history: learned,
        timestamp: new Date().toISOString()
      };
    });

    return decisions;
  }
}
