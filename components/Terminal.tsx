
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

  return (
    <div className="flex flex-col h-full glass rounded-xl border border-teal-500/30 overflow-hidden">
      <div className="bg-teal-900/40 px-4 py-2 flex items-center justify-between border-b border-teal-500/30">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse"></div>
          <span className="text-xs font-bold text-teal-400 uppercase tracking-widest">Live Execution Log</span>
        </div>
        <span className="text-[10px] text-teal-600 font-bold">V1.2_PROFITMAX</span>
      </div>
      <div 
        ref={terminalRef}
        className="flex-1 p-4 mono text-xs overflow-y-auto space-y-2 font-medium"
      >
        {decisions.length === 0 && (
          <div className="text-slate-500">Initializing core logic... standby for market scanning.</div>
        )}
        {decisions.map((d, i) => (
          <div key={i} className="border-l-2 border-slate-700 pl-2 py-1 hover:bg-white/5 transition-colors">
            <div className="flex justify-between text-slate-400">
              <span>[{d.timestamp.split('T')[1].split('.')[0]}] ID: {d.market_id}</span>
              <span className={`font-bold ${d.action === 'HOLD' ? 'text-slate-500' : 'text-emerald-400'}`}>{d.action}</span>
            </div>
            <div className="text-teal-400/80">
              {d.action !== 'HOLD' && `>>> Order: ${d.amount_usdc.toFixed(2)} USDC | CES: ${d.ces.toFixed(2)}`}
            </div>
            <div className="text-slate-500 italic truncate">{d.learned_from_history}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Terminal;
