
import { GoogleGenAI } from "@google/genai";
import { GlobalState } from "../types";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const getExpertInsight = async (state: GlobalState, retries = 2, delay = 3000): Promise<string> => {
  const apiKey = process.env.API_KEY;
  
  if (!apiKey || apiKey === "undefined") {
    console.warn("Gemini API Key missing or undefined. Operating in basic mode.");
    return state.btc.momentum_score > 7 ? "MOMENTUM PEAK: Scaling entry vectors." : "NEUTRAL SCAN: Holding baseline parameters.";
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const context = `BTC: ${state.btc.price.toFixed(0)}, Mom: ${state.btc.momentum_score.toFixed(1)}, Vol: ${state.btc.vol.toFixed(4)}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Context: ${context}. Tactical command for 5-min sniper bot? 1 short sentence.`,
      config: {
        systemInstruction: "You are the PROFITMAX PM5 OVERSEER. Use elite sniper persona. 1 sentence maximum.",
        temperature: 0.6,
        thinkingConfig: { thinkingBudget: 1000 }
      }
    });
    
    return response.text?.trim() || "OVERSIGHT STABLE: Parameters nominal.";

  } catch (err: any) {
    console.error("Gemini Insight Error:", err);
    
    if (err?.message?.includes("404") || err?.message?.includes("entity was not found")) {
        if (typeof window !== 'undefined' && (window as any).aistudio?.openSelectKey) {
            (window as any).aistudio.openSelectKey();
        }
        return "CONFIG ERROR: Re-linking project required.";
    }

    if (retries > 0) {
      await sleep(delay);
      return getExpertInsight(state, retries - 1, delay * 1.5);
    }

    return "SCANNING: Awaiting tactical clear.";
  }
};
