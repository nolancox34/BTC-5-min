
import React from 'react';
import { Market, BotDecision } from '../types';

interface MarketGridProps {
  markets: Market[];
  decisions: BotDecision[];
}

const MarketGrid: React.FC<MarketGridProps> = ({ markets, decisions }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {markets.map((m) => {
        const decision = decisions.find(d => d.market_id === m.id);
        const timeLeft = 300 - m.time_elapsed_seconds;
        const progress = (m.time_elapsed_seconds / 300) * 100;

        return (
          <div key={m.id} className="glass p-4 rounded-xl border border-slate-700 hover:border-teal-500/50 transition-all group">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="text-sm font-bold text-slate-200">BTC Above ${m.strike_price}</h3>
                <p className="text-[10px] text-slate-500 mono">{m.id}</p>
              </div>
              <div className="text-right">
                <span className={`text-xs font-bold px-2 py-1 rounded ${timeLeft < 60 ? 'bg-rose-500/20 text-rose-400' : 'bg-teal-500/20 text-teal-400'}`}>
                  {timeLeft}s LEFT
                </span>
              </div>
            </div>

            <div className="w-full bg-slate-800 h-1.5 rounded-full mb-4 overflow-hidden">
              <div 
                className={`h-full transition-all duration-1000 ${timeLeft < 60 ? 'bg-rose-500' : 'bg-teal-500'}`} 
                style={{ width: `${progress}%` }}
              ></div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-slate-900/50 p-2 rounded border border-slate-800">
                <div className="text-[10px] text-slate-500 uppercase">YES ASK</div>
                <div className="text-lg font-bold text-emerald-400">${m.yes_ask.toFixed(2)}</div>
              </div>
              <div className="bg-slate-900/50 p-2 rounded border border-slate-800">
                <div className="text-[10px] text-slate-500 uppercase">NO ASK</div>
                <div className="text-lg font-bold text-rose-400">${m.no_ask.toFixed(2)}</div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-800">
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 uppercase">Composite Edge</span>
                <span className="text-sm font-bold mono text-teal-400">
                  {decision?.ces.toFixed(2) || '0.00'}
                </span>
              </div>
              <div className="flex flex-col text-right">
                <span className="text-[10px] text-slate-500 uppercase">Arb Score</span>
                <span className="text-sm font-bold mono text-emerald-400">
                  {decision?.arb_score.toFixed(2) || '0.00'}
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
