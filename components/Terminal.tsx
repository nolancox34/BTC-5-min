
import React, { useEffect, useRef } from 'react';
import { BotDecision } from '../types';

interface TerminalProps {
  decisions: BotDecision[];
}

const Terminal: React.FC<TerminalProps> = ({ decisions }) => {
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [decisions]);

  const getActionColor = (action: string) => {
    switch (action) {
      case 'BUY_YES': return 'text-emerald-400';
      case 'BUY_NO': return 'text-rose-400';
      case 'BUY_BOTH': return 'text-sky-400';
      default: return 'text-slate-400';
    }
  };

  return (
    <div className="flex flex-col h-full glass rounded-xl border border-amber-500/30 overflow-hidden bg-slate-950/40">
      <div className="bg-amber-900/20 px-3 py-1.5 flex items-center justify-between border-b border-amber-500/20">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></div>
          <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Trade Execution Log</span>
        </div>
        <span className="text-[8px] text-amber-500/40 font-bold uppercase">Sniper_Mode_On</span>
      </div>
      <div 
        ref={terminalRef}
        className="flex-1 p-3 mono text-[10px] overflow-y-auto space-y-1.5 font-medium scrollbar-thin scrollbar-thumb-amber-500/20"
      >
        {decisions.length === 0 ? (
          <div className="text-slate-600 italic">Scanning vectors for high-conviction entry...</div>
        ) : (
          decisions.map((d, i) => (
            <div key={i} className="border-l-2 border-amber-500/20 pl-2 py-0.5 hover:bg-white/5 transition-colors leading-tight">
              <div className="flex justify-between items-center mb-0.5">
                <span className="text-slate-500 text-[9px] font-bold">[{d.timestamp.split('T')[1].split('.')[0]}] <span className="text-slate-400">{d.market_id}</span></span>
                <span className={`font-black tracking-tight ${getActionColor(d.action)}`}>
                  {d.action.replace('BUY_', '')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-300 font-bold">{d.amount_usdc.toFixed(1)} USDC</span>
                <span className="text-amber-500/40 font-bold">|</span>
                <span className="text-slate-500 font-bold uppercase tracking-tighter">CES {d.ces.toFixed(2)}</span>
              </div>
              <div className="text-[9px] text-slate-500 italic mt-0.5 truncate max-w-full">
                {d.learned_from_history}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Terminal;
