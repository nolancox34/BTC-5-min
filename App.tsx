
import React, { useState, useEffect, useRef } from 'react';
import { GlobalState, BotDecision } from './types';
import { MarketSimulator } from './services/dataGenerator';
import { ProfitMaxEngine } from './services/botService';
import { getExpertInsight } from './services/geminiService';
import Header from './components/Header';
import MarketGrid from './components/MarketGrid';
import Terminal from './components/Terminal';

const App: React.FC = () => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [state, setState] = useState<GlobalState>(() => MarketSimulator.generateInitialState());
  const [decisions, setDecisions] = useState<BotDecision[]>([]);
  const [insight, setInsight] = useState<string>("Awaiting oversight link...");
  const [isLive, setIsLive] = useState(true);
  const [aiStatus, setAiStatus] = useState<'connected' | 'cooldown' | 'error' | 'thinking'>('connected');
  const [hasPaidKey, setHasPaidKey] = useState(false);
  const [bootProgress, setBootProgress] = useState(0);
  
  const isFetchingInsight = useRef(false);
  const lastBtcPrice = useRef(state.btc.price);

  // Initializing sequence to prevent blank page on Vercel
  useEffect(() => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 20;
      if (progress >= 100) {
        clearInterval(interval);
        setBootProgress(100);
        setTimeout(() => setIsInitializing(false), 500);
      } else {
        setBootProgress(progress);
      }
    }, 150);

    const checkKey = async () => {
      if ((window as any).aistudio?.hasSelectedApiKey) {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        setHasPaidKey(hasKey);
      }
    };
    checkKey();
    
    return () => clearInterval(interval);
  }, []);

  const handleLinkKey = async () => {
    if ((window as any).aistudio?.openSelectKey) {
      await (window as any).aistudio.openSelectKey();
      setHasPaidKey(true);
    }
  };

  useEffect(() => {
    if (!isLive || isInitializing) return;
    const runTick = async () => {
      const nextState = await MarketSimulator.tick(state);
      const newDecisions = ProfitMaxEngine.calculate(nextState);
      setDecisions(prev => [...prev, ...newDecisions].slice(-50));
      setState({ ...nextState, decisions: newDecisions });
    };
    const interval = setInterval(runTick, 4000);
    return () => clearInterval(interval);
  }, [isLive, state, isInitializing]);

  useEffect(() => {
    if (isInitializing) return;
    const fetchInsight = async () => {
      if (isFetchingInsight.current) return;
      isFetchingInsight.current = true;
      setAiStatus('thinking');
      try {
        const text = await getExpertInsight(state);
        setInsight(text);
        setAiStatus('connected');
      } catch (err) {
        setAiStatus('error');
      } finally {
        isFetchingInsight.current = false;
      }
    };
    
    fetchInsight();
    const heartbeat = setInterval(fetchInsight, 30000);
    return () => clearInterval(heartbeat);
  }, [isInitializing]); 

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-8">
        <div className="max-w-md w-full space-y-6 text-center">
          <div className="w-20 h-20 bg-amber-500 rounded-2xl mx-auto flex items-center justify-center shadow-2xl shadow-amber-500/20 animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-900" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-white tracking-widest uppercase">Booting ProfitMax <span className="text-amber-500">PM5</span></h1>
          <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
            <div className="h-full bg-amber-500 transition-all duration-300" style={{ width: `${bootProgress}%` }}></div>
          </div>
          <div className="flex justify-between text-[10px] mono text-slate-500 font-bold uppercase tracking-widest">
            <span>Kernel: V1.2.PRO</span>
            <span>Progress: {bootProgress.toFixed(0)}%</span>
          </div>
          <div className="text-xs text-amber-500/50 italic animate-pulse">Optimizing BTC execution vectors...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col p-4 md:p-6 lg:p-8">
      <div className="fixed inset-0 pointer-events-none opacity-20">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(245,158,11,0.1),rgba(0,0,0,0))]"></div>
        <div className="scanline"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto w-full flex flex-col gap-6 h-full">
        <Header 
          btc={state.btc} 
          wallet={state.wallet} 
          isLive={isLive} 
          onToggleLive={() => setIsLive(!isLive)} 
          aiStatus={aiStatus === 'thinking' ? 'connected' : aiStatus}
          isPaid={hasPaidKey}
          networkStatus={MarketSimulator.networkStatus}
        />

        <div className="glass p-4 rounded-xl border-l-4 border-l-amber-500 bg-amber-950/20 transition-all shadow-xl shadow-amber-950/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex-shrink-0 p-2 rounded-lg transition-colors ${aiStatus === 'thinking' ? 'bg-amber-500/40 text-amber-300 animate-pulse' : 'bg-amber-500/20 text-amber-400'}`}>
                {aiStatus === 'thinking' ? (
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                )}
              </div>
              <div className="overflow-hidden">
                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest block mb-0.5">
                  Strategic Oversight {aiStatus === 'thinking' && '(THINKING)'}
                </span>
                <p className="text-sm text-slate-100 font-bold tracking-tight truncate">"{insight}"</p>
              </div>
            </div>
            
            {!hasPaidKey && (
              <button 
                onClick={handleLinkKey}
                className="flex-shrink-0 ml-4 text-[10px] font-bold bg-amber-500 text-black px-4 py-1.5 rounded-lg hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/20 active:scale-95"
              >
                UPGRADE FEED
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          <div className="lg:col-span-8 space-y-6">
            <div className="flex justify-between items-end">
              <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2 uppercase">
                Snipe Targets <span className={`h-1.5 w-1.5 rounded-full animate-ping ${MarketSimulator.networkStatus === 'stable' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
              </h2>
              <div className="flex gap-4 text-[10px] font-bold text-slate-500 uppercase">
                <span>Data: <span className={MarketSimulator.networkStatus === 'stable' ? 'text-emerald-400' : 'text-amber-400'}>{MarketSimulator.networkStatus.toUpperCase()}</span></span>
                <span>Tier: <span className="text-amber-400">{hasPaidKey ? 'PRO' : 'FREE'}</span></span>
              </div>
            </div>
            
            <MarketGrid markets={state.markets} decisions={decisions} />
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              {[
                { label: 'Win Rate (Sim)', value: `${state.historical_summary.recent_resolved_wr}%`, color: 'text-emerald-400' },
                { label: 'Mom Vector', value: state.btc.momentum_score.toFixed(1), color: 'text-amber-400' },
                { label: 'HFT Latency', value: '4ms', color: 'text-sky-400' },
                { label: 'BTC 1m Delta', value: (state.btc.change_1m * 100).toFixed(4) + '%', color: state.btc.change_1m >= 0 ? 'text-emerald-400' : 'text-rose-400' }
              ].map((stat, i) => (
                <div key={i} className="glass p-3 rounded-xl border border-slate-800 text-center hover:bg-white/5 transition-colors group">
                  <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">{stat.label}</div>
                  <div className={`text-xl font-bold mono ${stat.color}`}>{stat.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-col gap-6">
             <Terminal decisions={decisions} />
             
             <div className="glass p-6 rounded-xl border border-amber-500/20 shadow-inner bg-slate-900/40">
               <div className="flex justify-between items-center mb-4">
                 <h3 className="text-xs font-bold text-amber-500 uppercase tracking-widest">Bot Portfolio</h3>
                 <div className="text-[10px] text-amber-300/30">V1.2_SECURE</div>
               </div>
               <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <span className="text-slate-400 text-sm">USDC Equity</span>
                    <span className="text-2xl font-bold mono text-white">${state.wallet.balance_usdc.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-end border-t border-slate-800 pt-4">
                    <span className="text-slate-400 text-sm">Active Sniper Bots</span>
                    <span className="text-lg font-bold mono text-amber-400">{state.wallet.active_positions} / 10</span>
                  </div>
                  <div className="bg-amber-500/10 p-4 rounded-xl border border-amber-500/20">
                    <div className="text-[10px] text-amber-500 uppercase mb-1 font-bold">Session PnL</div>
                    <div className={`text-2xl font-black ${state.wallet.pnl_today >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {state.wallet.pnl_today >= 0 ? '+' : ''}${state.wallet.pnl_today.toFixed(2)}
                    </div>
                  </div>
               </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
