
import React, { useEffect, useState } from 'react';
import { BTCState } from '../types';

interface HeaderProps {
  btc: BTCState;
  isLive: boolean;
  onToggleLive: () => void;
  aiStatus: 'connected' | 'cooldown' | 'error' | 'thinking';
  isPaid: boolean;
  networkStatus: 'stable' | 'degraded' | 'offline';
  wallet: any;
}

const Header: React.FC<HeaderProps> = ({ btc, isLive, onToggleLive, aiStatus, isPaid, networkStatus }) => {
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

  return (
    <header className="flex flex-col md:flex-row items-center justify-between gap-4 py-4 px-6 glass rounded-2xl border border-amber-500/20 shadow-2xl relative overflow-hidden bg-slate-900/60">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 flex items-center justify-center rounded-2xl shadow-lg transition-all ${isPaid ? 'bg-amber-500 shadow-amber-500/30' : 'bg-slate-700 shadow-slate-900'}`}>
          <svg xmlns="http://www.w3.org/2000/svg" className={`h-7 w-7 ${isPaid ? 'text-slate-900' : 'text-amber-500'}`} viewBox="0 0 20 20" fill="currentColor">
            <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1a1 1 0 112 0v1a1 1 0 11-2 0zM13.536 14.95a1 1 0 011.414 1.414l-.707.707a1 1 0 01-1.414-1.414l.707-.707zM6.464 14.95l.707.707a1 1 0 11-1.414 1.414l-.707-.707a1 1 0 011.414-1.414z" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tighter text-white uppercase leading-none">ProfitMax <span className="text-amber-500">PM5</span></h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-slate-500 font-bold uppercase mono tracking-widest">{isPaid ? 'PRO_ULTRA_ACCESS' : 'COMMUNITY_ACCESS'}</span>
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[8px] font-black border transition-all ${
                networkStatus === 'stable' ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5' : 'border-amber-500/30 text-amber-400 bg-amber-500/5'
            }`}>
                <div className={`w-1 h-1 rounded-full ${networkStatus === 'stable' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></div>
                FEED: {networkStatus.toUpperCase()}
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-8 items-center bg-slate-950/60 p-3 px-6 rounded-2xl border border-white/5 shadow-inner">
        <div className="flex flex-col min-w-[140px]">
          <div className="flex items-center gap-1">
             <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">BTC Index</span>
             <span className={`text-[8px] px-1 rounded font-black ${networkStatus === 'stable' ? 'bg-emerald-500 text-black' : 'bg-amber-500/20 text-amber-500'}`}>
                {networkStatus === 'stable' ? 'LIVE' : 'VIRTUAL'}
             </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-black mono transition-colors duration-300 ${priceColor}`}>
              ${btc.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
        
        <div className="w-px h-10 bg-slate-800"></div>

        <div className="hidden lg:flex flex-col">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Bot Pressure</span>
          <div className="flex items-center gap-1 mt-1">
            {Array.from({ length: 10 }).map((_, i) => (
              <div 
                key={i} 
                className={`w-1 h-4 rounded-full transition-all duration-300 ${i < btc.momentum_score ? (i > 7 ? 'bg-rose-500' : 'bg-amber-500') : 'bg-slate-800'}`}
              ></div>
            ))}
          </div>
        </div>

        <div className="w-px h-10 bg-slate-800 hidden md:block"></div>

        <div className="flex flex-col items-end">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Sniper Status</span>
          <button 
              onClick={onToggleLive}
              className={`text-[10px] px-4 py-1.5 rounded-lg font-black uppercase transition-all shadow-lg active:scale-95 ${isLive ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30'}`}
            >
              {isLive ? 'ENGAGED' : 'STANDBY'}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
