
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
  const [insight, setInsight] = useState<string>("Initializing Oversight Protocol...");
  const [isLive, setIsLive] = useState(true);
  const [aiStatus, setAiStatus] = useState<'connected' | 'cooldown' | 'error' | 'thinking'>('connected');
  const [hasPaidKey, setHasPaidKey] = useState(false);
  const [bootProgress, setBootProgress] = useState(0);
  
  const isFetchingInsight = useRef(false);
  const lastBtcPrice = useRef(state.btc.price);

  useEffect(() => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 25;
      if (progress >= 100) {
        clearInterval(interval);
        setBootProgress(100);
        setTimeout(() => setIsInitializing(false), 400);
      } else {
        setBootProgress(progress);
      }
    }, 100);

    const checkKey = async () => {
      try {
        if ((window as any).aistudio?.hasSelectedApiKey) {
          const hasKey = await (window as any).aistudio.hasSelectedApiKey();
          setHasPaidKey(hasKey);
        }
      } catch (e) {
        console.warn("Key check error:", e);
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
      try {
        const nextState = await MarketSimulator.tick(state);
        const newDecisions = ProfitMaxEngine.calculate(nextState);
        
        // ONLY LOG EXECUTED TRADES (Exclude HOLD)
        const executedTrades = newDecisions.filter(d => d.action !== 'HOLD');
        if (executedTrades.length > 0) {
          setDecisions(prev => [...prev, ...executedTrades].slice(-100));
        }

        setState({ ...nextState, decisions: newDecisions });
      } catch (err) {
        console.error("Tick failed:", err);
      }
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
        console.warn("Gemini fetch failed:", err);
        setAiStatus('error');
      } finally {
        isFetchingInsight.current = false;
      }
    };
    
    fetchInsight();
    const heartbeat = setInterval(fetchInsight, 30000);
    return () => clearInterval(heartbeat);
  }, [isInitializing, state.btc.price]);

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-12 overflow-hidden">
        <div className="max-w-md w-full space-y-8 relative">
          <div className="absolute -inset-4 bg-amber-500/10 blur-3xl rounded-full animate-pulse"></div>
          
          <div className="w-24 h-24 bg-gradient-to-br from-amber-400 to-amber-600 rounded-3xl mx-auto flex items-center justify-center shadow-[0_0_50px_rgba(245,158,11,0.3)] animate-bounce relative z-10">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-slate-900" viewBox="0 0 20 20" fill="currentColor">
              <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1a1 1 0 112 0v1a1 1 0 11-2 0zM13.536 14.95a1 1 0 011.414 1.414l-.707.707a1 1 0 01-1.414-1.414l.707-.707zM6.464 14.95l.707.707a1 1 0 11-1.414 1.414l-.707-.707a1 1 0 011.414-1.414z" />
            </svg>
          </div>

          <div className="text-center relative z-10">
            <h1 className="text-3xl font-black text-white tracking-tighter uppercase mb-2">
              ProfitMax <span className="text-amber-500">PM5</span>
            </h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em] mb-8">Adaptive HFT Sniper Terminal</p>
            
            <div className="w-full bg-slate-900/50 h-1.5 rounded-full overflow-hidden border border-white/5 mb-4">
              <div className="h-full bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)] transition-all duration-200" style={{ width: `${bootProgress}%` }}></div>
            </div>
            
            <div className="flex justify-between items-center mono text-[9px] text-slate-400 font-bold">
              <span className="animate-pulse">BOOT_SEQUENCE_LOADED</span>
              <span>STABILITY: 100%</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col p-4 md:p-6 lg:p-8">
      <div className="fixed inset-0 pointer-events-none opacity-20">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(245,158,11,0.05),rgba(0,0,0,0))]"></div>
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

        <div className="glass p-5 rounded-2xl border-l-4 border-l-amber-500 bg-amber-950/20 transition-all shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-1 opacity-20 group-hover:opacity-100 transition-opacity">
            <div className="text-[8px] mono text-amber-500 font-bold">OVERSIGHT_V1</div>
          </div>
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className={`flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-xl transition-all ${aiStatus === 'thinking' ? 'bg-amber-500/40 text-amber-300 animate-pulse' : 'bg-amber-500/20 text-amber-500 shadow-inner'}`}>
                {aiStatus === 'thinking' ? (
                  <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div className="overflow-hidden">
                <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest block mb-1">
                  Tactical Strategic Overlay {aiStatus === 'thinking' && '(CALCULATING...)'}
                </span>
                <p className="text-base text-white font-bold tracking-tight italic">"{insight}"</p>
              </div>
            </div>
            
            {!hasPaidKey && (
              <button 
                onClick={handleLinkKey}
                className="flex-shrink-0 text-[11px] font-black bg-amber-500 text-slate-950 px-6 py-2 rounded-xl hover:bg-amber-400 transition-all shadow-xl shadow-amber-500/20 active:scale-95 uppercase tracking-wider"
              >
                PRO FEED
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 space-y-6">
            <div className="flex justify-between items-end px-2">
              <h2 className="text-xl font-black tracking-tighter text-white flex items-center gap-3 uppercase">
                Active Snipes <span className={`h-2 w-2 rounded-full ${MarketSimulator.networkStatus === 'stable' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]'} animate-pulse`}></span>
              </h2>
              <div className="flex gap-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                <span>FEED: <span className={MarketSimulator.networkStatus === 'stable' ? 'text-emerald-400' : 'text-amber-400'}>{MarketSimulator.networkStatus.toUpperCase()}</span></span>
                <span>MODE: <span className="text-amber-400">{hasPaidKey ? 'PRO' : 'COMMUNITY'}</span></span>
              </div>
            </div>
            
            <MarketGrid markets={state.markets} decisions={state.decisions} />
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
              {[
                { label: 'Avg Accuracy', value: `${state.historical_summary.recent_resolved_wr}%`, color: 'text-emerald-400' },
                { label: 'Momentum Vector', value: state.btc.momentum_score.toFixed(2), color: 'text-amber-400' },
                { label: 'Engine Load', value: 'NOMINAL', color: 'text-sky-400' },
                { label: 'BTC 1m Delta', value: (state.btc.change_1m * 100).toFixed(4) + '%', color: state.btc.change_1m >= 0 ? 'text-emerald-400' : 'text-rose-400' }
              ].map((stat, i) => (
                <div key={i} className="glass p-4 rounded-2xl border border-slate-800/50 hover:bg-white/5 transition-all group shadow-lg">
                  <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-2 group-hover:text-slate-400">{stat.label}</div>
                  <div className={`text-xl font-black mono ${stat.color}`}>{stat.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-col gap-6">
             {/* TERMINAL SIZED DOWN */}
             <div className="h-[280px]">
                <Terminal decisions={decisions} />
             </div>
             
             <div className="glass p-6 rounded-2xl border border-amber-500/20 shadow-2xl bg-slate-900/40 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-[50px] -mr-16 -mt-16 rounded-full"></div>
               <div className="flex justify-between items-center mb-6">
                 <h3 className="text-xs font-black text-amber-500 uppercase tracking-widest">Liquidity Balance</h3>
                 <div className="text-[9px] font-bold text-amber-500/40 px-2 py-0.5 rounded border border-amber-500/20">V1.2_SECURE</div>
               </div>
               <div className="space-y-6">
                  <div className="flex justify-between items-end">
                    <span className="text-slate-400 text-sm font-medium">Available USDC</span>
                    <span className="text-3xl font-black mono text-white tracking-tighter">${state.wallet.balance_usdc.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-end border-t border-slate-800 pt-6">
                    <span className="text-slate-400 text-sm font-medium">Active Sniper Bots</span>
                    <span className="text-xl font-black mono text-amber-400">{state.wallet.active_positions} / 12</span>
                  </div>
                  <div className="bg-gradient-to-br from-amber-500/10 to-transparent p-5 rounded-2xl border border-amber-500/20 shadow-inner">
                    <div className="text-[10px] text-amber-500 uppercase mb-2 font-black tracking-widest">Realized PnL (Session)</div>
                    <div className={`text-3xl font-black ${state.wallet.pnl_today >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
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
