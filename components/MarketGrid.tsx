
import React from 'react';
import { Market, BotDecision } from '../types';

interface MarketGridProps {
  markets: Market[];
  decisions: BotDecision[];
  btc: any;
  onManualTrade?: (marketId: string, side: 'YES' | 'NO') => void;
}

const MarketGrid: React.FC<MarketGridProps> = ({ markets, decisions, btc, onManualTrade }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {markets.map((m) => {
        const decision = decisions.find(d => d.market_id === m.id);
        const timeLeft = Math.max(0, 300 - m.time_elapsed_seconds);
        const progress = (m.time_elapsed_seconds / 300) * 100;
        
        const cexDelta = btc.binance_price - m.start_price;
        const polyDelta = btc.price - m.start_price;
        const lagGap = btc.binance_price - btc.price;

        const isExecuting = decision && decision.action !== 'HOLD';

        return (
          <div 
            key={m.id} 
            className={`glass p-4 rounded-xl border transition-all duration-300 group relative overflow-hidden ${
              isExecuting ? 'border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.15)] bg-amber-500/5' : 'border-slate-800'
            }`}
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="text-xs font-black text-slate-100 uppercase tracking-tight">BTC @ ${m.strike_price}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${cexDelta >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                    CEX {cexDelta >= 0 ? '+' : ''}{cexDelta.toFixed(1)}
                  </span>
                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400`}>
                    LAG: {lagGap.toFixed(1)}
                  </span>
                </div>
              </div>
              <span className={`text-[9px] font-black px-2 py-0.5 rounded mono ${timeLeft < 60 ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-800 text-slate-400'}`}>
                {timeLeft}s
              </span>
            </div>

            <div className="w-full bg-slate-800/50 h-1 rounded-full mb-4 overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${timeLeft < 180 ? 'bg-amber-500' : 'bg-slate-700'}`} 
                style={{ width: `${progress}%` }}
              ></div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <button 
                onClick={() => onManualTrade?.(m.id, 'YES')}
                className="bg-emerald-500/10 hover:bg-emerald-500/20 p-2 rounded-lg border border-emerald-500/20 transition-all text-left group"
              >
                <div className="text-[7px] text-emerald-500/70 font-black uppercase tracking-widest mb-1">BUY YES</div>
                <div className="text-sm font-black text-emerald-400 mono">${m.yes_ask.toFixed(3)}</div>
              </button>
              <button 
                onClick={() => onManualTrade?.(m.id, 'NO')}
                className="bg-rose-500/10 hover:bg-rose-500/20 p-2 rounded-lg border border-rose-500/20 transition-all text-left group"
              >
                <div className="text-[7px] text-rose-500/70 font-black uppercase tracking-widest mb-1">BUY NO</div>
                <div className="text-sm font-black text-rose-400 mono">${m.no_ask.toFixed(3)}</div>
              </button>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-800/50">
              <div className="flex flex-col">
                <span className="text-[7px] text-slate-500 font-black uppercase tracking-widest">Arb Index</span>
                <span className={`text-xs font-black mono ${m.yes_ask + m.no_ask < 0.97 ? 'text-sky-400' : 'text-slate-500'}`}>
                  {(m.yes_ask + m.no_ask).toFixed(3)}
                </span>
              </div>
              <div className="flex flex-col text-right">
                <span className="text-[7px] text-slate-500 font-black uppercase tracking-widest">BOT CONF</span>
                <span className={`text-xs font-black mono ${decision?.ces && decision.ces > 7.5 ? 'text-amber-400' : 'text-slate-600'}`}>
                  {decision?.confidence || 0}%
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MarketGrid;
