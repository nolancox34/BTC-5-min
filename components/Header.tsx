
import React, { useEffect, useState } from 'react';
import { BTCState, Wallet } from '../types';

interface HeaderProps {
  btc: BTCState;
  isLive: boolean;
  onToggleLive: () => void;
  aiStatus: 'connected' | 'cooldown' | 'error' | 'thinking';
  isPaid: boolean;
  networkStatus: 'stable' | 'degraded' | 'offline';
  wallet: Wallet;
}

const Header: React.FC<HeaderProps> = ({ btc, isLive, onToggleLive, aiStatus, isPaid, networkStatus, wallet }) => {
  const [priceColor, setPriceColor] = useState('text-emerald-400');
  const lastPrice = React.useRef(btc.price);

  useEffect(() => {
    if (btc.price > lastPrice.current) {
      setPriceColor('text-emerald-400');
    } else if (btc.price < lastPrice.current) {
      setPriceColor('text-rose-400');
    }
    lastPrice.current = btc.price;
  }, [btc.price]);

  const riskLevel = btc.vol > 0.15 ? 'CRITICAL' : btc.vol > 0.08 ? 'ELEVATED' : 'NOMINAL';

  return (
    <header className="flex flex-col md:flex-row items-center justify-between gap-4 py-3 px-6 glass rounded-2xl border border-white/5 bg-slate-900/40">
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 flex items-center justify-center rounded-xl shadow-lg transition-all bg-amber-500`}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-950" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-black tracking-tighter text-white uppercase leading-none">ProfitMax <span className="text-amber-500">PM5</span></h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[8px] text-slate-500 font-black uppercase mono tracking-widest">LIVE_EDGE_v1.3</span>
            <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black border ${
                riskLevel === 'CRITICAL' ? 'border-rose-500/50 text-rose-400 bg-rose-500/5' : 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5'
            }`}>
                RISK: {riskLevel}
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-4 items-center bg-slate-950/60 p-2 px-6 rounded-2xl border border-white/5 shadow-inner">
        <div className="flex gap-4">
          <div className="flex flex-col border-r border-slate-800 pr-4">
            <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">BINANCE</span>
            <span className="text-xs font-black mono text-slate-300">
              ${btc.binance_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex flex-col border-r border-slate-800 pr-4">
            <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">BYBIT</span>
            <span className="text-xs font-black mono text-slate-300">
              ${btc.bybit_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
        
        <div className="flex flex-col min-w-[140px]">
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">POLYMARKET</span>
          <span className={`text-2xl font-black mono transition-all duration-300 ${priceColor}`}>
            ${btc.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        <div className="w-px h-8 bg-slate-800 ml-2 mr-2"></div>

        <div className="flex flex-col items-end">
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">AUTO-SNIPER</span>
          <button 
              onClick={onToggleLive}
              className={`text-[9px] px-3 py-1 rounded-md font-black uppercase transition-all ${isLive ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.1)]' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}
            >
              {isLive ? 'ENGAGED' : 'STANDBY'}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
