
import React, { useEffect, useRef, useMemo } from 'react';
import { BotDecision } from '../types';

interface TerminalProps {
  decisions: BotDecision[];
}

const Terminal: React.FC<TerminalProps> = ({ decisions }) => {
  const terminalRef = useRef<HTMLDivElement>(null);

  const activeTrades = useMemo(() => 
    decisions.filter(d => d.action !== 'HOLD'), 
    [decisions]
  );

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [activeTrades]);

  const getActionColor = (action: string) => {
    switch (action) {
      case 'BUY_YES': return 'text-emerald-400';
      case 'BUY_NO': return 'text-rose-400';
      case 'BUY_BOTH': return 'text-sky-400';
      case 'SELL': return 'text-amber-400';
      case 'HEDGE': return 'text-purple-400';
      default: return 'text-slate-400';
    }
  };

  return (
    <div className="flex flex-col h-full glass rounded-xl border border-amber-500/30 overflow-hidden bg-slate-950/60 shadow-2xl">
      <div className="bg-amber-900/20 px-3 py-1.5 flex items-center justify-between border-b border-amber-500/20 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div>
          <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Execution Engine v1.3</span>
        </div>
        <span className="text-[8px] text-emerald-500 font-bold uppercase tabular-nums">{activeTrades.length} Trades Settled</span>
      </div>
      <div 
        ref={terminalRef}
        className="flex-1 p-2 mono text-[9px] overflow-y-auto space-y-2 font-medium scrollbar-hide select-none"
      >
        {activeTrades.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-600 italic">SCANNING META VECTORS...</div>
        ) : (
          activeTrades.map((d, i) => (
            <div key={`${d.market_id}-${i}`} className="border-l border-amber-500/20 pl-2 py-1 hover:bg-white/5 transition-all">
              <div className="flex justify-between items-center mb-1">
                <span className={`font-black uppercase text-[10px] ${getActionColor(d.action)}`}>
                  {d.action.replace('BUY_', '')} • {d.confidence}% CONF
                </span>
                <span className="text-slate-500 text-[8px]">{d.timestamp.split('T')[1].split('.')[0]}</span>
              </div>
              <div className="text-slate-400 text-[8px] truncate mb-1">{d.slug}</div>
              <div className="flex items-center justify-between">
                <span className="text-white font-bold">${d.amount_usdc.toFixed(2)}</span>
                <span className="text-amber-500/80 font-bold text-[8px] uppercase tracking-tighter">{d.learned_from_history}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Terminal;
