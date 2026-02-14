
import { GoogleGenAI } from "@google/genai";
import { GlobalState } from "../types";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const getExpertInsight = async (state: GlobalState, retries = 2, delay = 3000): Promise<string> => {
  // Always create a new instance right before calling to catch updated API keys from window.aistudio
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const context = `Price: ${state.btc.price.toFixed(0)}, Mom: ${state.btc.momentum_score.toFixed(1)}, WR: ${state.historical_summary.recent_resolved_wr}%, Vol: ${state.btc.vol.toFixed(4)}`;

  try {
    const response = await ai.models.generateContent({
      // Upgrading to Pro for paid tier users
      model: 'gemini-3-pro-preview',
      contents: `Current Market Context: ${context}. As a senior sniper bot, provide a 1-sentence tactical command.`,
      config: {
        systemInstruction: "You are the PROFITMAX PM5 OVERSEER (PRO TIER). You provide elite, high-conviction HFT tactical directives. Use advanced reasoning to decide between aggressive momentum scalp or market-neutral arbitrage.",
        temperature: 0.7,
        thinkingConfig: { thinkingBudget: 2000 } // Enable thinking for better pro-tier results
      }
    });
    
    const text = response.text;
    if (!text) throw new Error("Empty Response");
    return text.trim();

  } catch (err: any) {
    const errorMsg = err?.message || "";
    
    // Handle specific key selection requirement or "entity not found" for paid tiers
    if (errorMsg.includes("Requested entity was not found") || errorMsg.includes("404")) {
        console.error("API Key Mismatch. Re-triggering key selection logic.");
        if (typeof window !== 'undefined' && (window as any).aistudio) {
            (window as any).aistudio.openSelectKey();
        }
        return "API CONFIG ERROR: Re-linking paid project credentials...";
    }

    const isRateLimit = errorMsg.includes("429") || err?.status === 429 || errorMsg.includes("RESOURCE_EXHAUSTED");
    
    if (isRateLimit && retries > 0) {
      await sleep(delay);
      return getExpertInsight(state, retries - 1, delay * 2);
    }

    // Heuristic fallbacks remain for safety
    if (state.btc.momentum_score > 8.0) return "PRO ADVICE: Momentum spike detected. Execute high-conviction directional entries.";
    return "STABLE SCAN: Market conditions nominal. Maintaining CES 7.0 parameters.";
  }
};
