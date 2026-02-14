
import React, { useEffect, useState } from 'react';
import { BTCState, Wallet } from '../types';

interface HeaderProps {
  btc: BTCState;
  wallet: Wallet;
  isLive: boolean;
  onToggleLive: () => void;
  aiStatus: 'connected' | 'cooldown' | 'error';
  isPaid: boolean;
}

const Header: React.FC<HeaderProps> = ({ btc, wallet, isLive, onToggleLive, aiStatus, isPaid }) => {
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
    <header className="flex flex-col md:flex-row items-center justify-between gap-4 py-4 px-6 glass rounded-2xl border-b border-amber-500/30 shadow-2xl">
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 flex items-center justify-center rounded-xl shadow-lg transition-all ${isPaid ? 'bg-amber-500 shadow-amber-500/30' : 'bg-teal-500 shadow-teal-500/30'}`}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-900" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.454A1 1 0 005.5 6a1 1 0 00-.5.134 6.015 6.015 0 00-2.714 3.347c-.446 1.373-.51 2.846-.202 4.18.058.253.117.495.176.739a5 5 0 009.482-1.48 1 1 0 00-2 0 3 3 0 11-5.697-.625c-.034-.176-.07-.35-.1-.523-.229-1-.174-2.083.151-3.081.041-.127.087-.251.136-.375.451.991 1.188 1.833 2.147 2.507a1 1 0 001.523-1.056 38.5 38.5 0 01.512-3.671c.205-.846.425-1.664.692-2.386.25-.679.485-1.139.689-1.454a1 1 0 00.11-.471z" clipRule="evenodd" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-black tracking-tighter text-white uppercase">ProfitMax <span className={isPaid ? "text-amber-500" : "text-teal-400"}>PM5</span></h1>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-bold uppercase mono">{isPaid ? 'v1.2 PRO_ACCOUNT' : 'v1.2 BASIC'}</span>
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-bold border transition-colors ${
                aiStatus === 'connected' ? 'border-amber-500/30 text-amber-400 bg-amber-500/5' : 'border-rose-500/30 text-rose-400 bg-rose-500/5'
            }`}>
                <div className={`w-1 h-1 rounded-full ${aiStatus === 'connected' ? 'bg-amber-400' : 'bg-rose-400 animate-pulse'}`}></div>
                LINK: {isPaid ? 'PAID_ACTIVE' : 'ENVIRONMENT_DEFAULT'}
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-8 items-center bg-slate-900/40 p-3 px-6 rounded-xl border border-slate-800">
        <div className="flex flex-col min-w-[120px]">
          <div className="flex items-center gap-1">
             <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">BTC INDEX</span>
             <span className="text-[8px] bg-emerald-500/10 text-emerald-500 px-1 rounded">LIVE</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-xl font-bold mono transition-colors duration-300 ${priceColor}`}>
              ${btc.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
        
        <div className="w-px h-8 bg-slate-800"></div>

        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">PRO_OVERSIGHT</span>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex gap-1">
               <div className={`w-2 h-2 rounded-full ${aiStatus === 'connected' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-slate-700'}`}></div>
               <div className="text-[10px] font-bold text-amber-500/80">GEMINI_3_PRO</div>
            </div>
          </div>
        </div>

        <div className="w-px h-8 bg-slate-800 hidden md:block"></div>

        <div className="hidden md:flex flex-col">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">ENGINE</span>
          <button 
              onClick={onToggleLive}
              className={`mt-1 text-[10px] px-3 py-1 rounded font-bold uppercase transition-all ${isLive ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30' : 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'}`}
            >
              {isLive ? 'RUNNING' : 'PAUSED'}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
