
import { GoogleGenAI } from "@google/genai";
import { GlobalState } from "../types";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const getExpertInsight = async (state: GlobalState, retries = 2, delay = 3000): Promise<string> => {
  const apiKey = process.env.API_KEY;
  
  if (!apiKey || apiKey === "undefined") {
    return state.btc.momentum_score > 7 ? "MOMENTUM_PEAK: Execute aggressive entry." : "NEUTRAL_REGIME: Maintain baseline capture.";
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const context = `
      BTC_PRICE: $${state.btc.price.toFixed(2)}
      MOMENTUM_VECTOR: ${state.btc.momentum_score.toFixed(2)}
      VOLATILITY_INDEX: ${state.btc.vol.toFixed(4)}
      PNL_SESSION: $${state.wallet.pnl_today.toFixed(2)}
      ACTIVE_SNIPES: ${state.wallet.active_positions}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `CONTEXT: ${context}. ANALYZE MARKET REGIME AND PROVIDE 1 ALPHA-HEAVY TACTICAL DIRECTIVE (MAX 12 WORDS).`,
      config: {
        systemInstruction: "You are the PROFITMAX QUANT DIRECTOR. Analyze BTC/Polymarket micro-caps. Be aggressive, technical, and precise. Use sniper/quant terminology.",
        temperature: 0.8,
        thinkingConfig: { thinkingBudget: 4000 }
      }
    });
    
    return response.text?.trim() || "ENGINE_STABLE: Monitoring volatility spikes.";

  } catch (err: any) {
    if (retries > 0) {
      await sleep(delay);
      return getExpertInsight(state, retries - 1, delay * 1.5);
    }
    return "OVERSIGHT_BYPASS: Autonomic execution engaged.";
  }
};
