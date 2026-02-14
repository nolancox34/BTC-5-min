
import React, { useState, useEffect, useRef } from 'react';
import { GlobalState, BotDecision } from './types';
import { MarketSimulator } from './services/dataGenerator';
import { ProfitMaxEngine } from './services/botService';
import { getExpertInsight } from './services/geminiService';
import Header from './components/Header';
import MarketGrid from './components/MarketGrid';
import Terminal from './components/Terminal';

const App: React.FC = () => {
  const [state, setState] = useState<GlobalState>(MarketSimulator.generateInitialState());
  const [decisions, setDecisions] = useState<BotDecision[]>([]);
  const [insight, setInsight] = useState<string>("Synchronizing with Gemini Pro Oversight...");
  const [isLive, setIsLive] = useState(true);
  const [aiStatus, setAiStatus] = useState<'connected' | 'cooldown' | 'error'>('connected');
  const [hasPaidKey, setHasPaidKey] = useState(false);
  
  const isFetchingInsight = useRef(false);
  const lastBtcPrice = useRef(state.btc.price);

  // Check for paid key on mount
  useEffect(() => {
    const checkKey = async () => {
      if ((window as any).aistudio?.hasSelectedApiKey) {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        setHasPaidKey(hasKey);
      }
    };
    checkKey();
  }, []);

  const handleLinkKey = async () => {
    if ((window as any).aistudio?.openSelectKey) {
      await (window as any).aistudio.openSelectKey();
      setHasPaidKey(true); // Assume success per race condition guidelines
    }
  };

  // Main simulation loop
  useEffect(() => {
    if (!isLive) return;

    const runTick = async () => {
      const nextState = await MarketSimulator.tick(state);
      const newDecisions = ProfitMaxEngine.calculate(nextState);
      
      setDecisions(prev => [...prev, ...newDecisions].slice(-50));
      setState({ ...nextState, decisions: newDecisions });
    };

    const interval = setInterval(runTick, 5000);
    return () => clearInterval(interval);
  }, [isLive, state]);

  // High-Frequency Oversight Loop (30s for Paid Tier)
  useEffect(() => {
    const fetchInsight = async () => {
      if (isFetchingInsight.current) return;
      
      isFetchingInsight.current = true;
      try {
        const text = await getExpertInsight(state);
        setInsight(text);
        setAiStatus('connected');
      } catch (err) {
        setAiStatus('cooldown');
      } finally {
        isFetchingInsight.current = false;
      }
    };
    
    fetchInsight();
    // 30 second interval for paid tier performance
    const heartbeat = setInterval(fetchInsight, 30000);

    const volCheck = setInterval(() => {
        const move = Math.abs(state.btc.price - lastBtcPrice.current) / lastBtcPrice.current;
        if (move > 0.002) { // More sensitive volatility re-eval
            fetchInsight();
        }
        lastBtcPrice.current = state.btc.price;
    }, 10000);

    return () => {
        clearInterval(heartbeat);
        clearInterval(volCheck);
    };
  }, []); 

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col p-4 md:p-6 lg:p-8">
      <div className="fixed inset-0 pointer-events-none opacity-20">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(20,184,166,0.1),rgba(0,0,0,0))]"></div>
        <div className="scanline"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto w-full flex flex-col gap-6 h-full">
        <Header 
          btc={state.btc} 
          wallet={state.wallet} 
          isLive={isLive} 
          onToggleLive={() => setIsLive(!isLive)} 
          aiStatus={aiStatus}
          isPaid={hasPaidKey}
        />

        <div className="glass p-4 rounded-xl border-l-4 border-l-amber-500 bg-amber-950/10 transition-all relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex-shrink-0 p-2 rounded-lg ${aiStatus === 'connected' ? 'bg-amber-500/20 text-amber-400' : 'bg-rose-500/20 text-rose-400 animate-pulse'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </div>
              <div>
                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest block mb-0.5">
                  Gemini Pro Oversight {aiStatus === 'cooldown' && '(LINK DEGRADED)'}
                </span>
                <p className="text-sm text-slate-100 font-bold tracking-tight">"{insight}"</p>
              </div>
            </div>
            
            {!hasPaidKey && (
              <button 
                onClick={handleLinkKey}
                className="text-[10px] font-bold bg-amber-500 text-black px-3 py-1 rounded hover:bg-amber-400 transition-colors"
              >
                LINK PAID ACCOUNT
              </button>
            )}
          </div>
          {!hasPaidKey && (
            <div className="mt-2 text-[9px] text-slate-500">
              Note: To use paid tier features, you must select a key from a <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="underline hover:text-amber-500">paid GCP project</a>.
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full min-h-[600px]">
          <div className="lg:col-span-8 space-y-6">
            <div className="flex justify-between items-end">
              <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                ACTIVE MARKETS <span className="bg-teal-500 h-1.5 w-1.5 rounded-full animate-ping"></span>
              </h2>
              <div className="flex gap-4 text-[10px] font-bold text-slate-500 uppercase">
                <span>Model: <span className="text-amber-400">GEMINI-3-PRO</span></span>
                <span>Interval: <span className="text-teal-400">30S</span></span>
              </div>
            </div>
            
            <MarketGrid markets={state.markets} decisions={state.decisions} />
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              {[
                { label: 'Recent Win Rate', value: `${state.historical_summary.recent_resolved_wr}%`, color: 'text-emerald-400' },
                { label: 'Pro Priority', value: 'ACTIVE', color: 'text-amber-400' },
                { label: 'Market Depth', value: 'High', color: 'text-sky-400' },
                { label: 'BTC 1m Delta', value: (state.btc.change_1m * 100).toFixed(4) + '%', color: state.btc.change_1m >= 0 ? 'text-emerald-400' : 'text-rose-400' }
              ].map((stat, i) => (
                <div key={i} className="glass p-3 rounded-lg border border-slate-800 text-center hover:bg-white/5 transition-colors">
                  <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">{stat.label}</div>
                  <div className={`text-xl font-bold mono ${stat.color}`}>{stat.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-col gap-6">
             <Terminal decisions={decisions} />
             
             <div className="glass p-6 rounded-xl border border-indigo-500/30">
               <div className="flex justify-between items-center mb-4">
                 <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Simulation Wallet</h3>
                 <div className="text-[10px] text-indigo-300/50">TIER: PRO_ACCOUNT</div>
               </div>
               <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <span className="text-slate-400 text-sm">Equity (USDC)</span>
                    <span className="text-2xl font-bold mono text-white">${state.wallet.balance_usdc.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-end border-t border-indigo-500/20 pt-4">
                    <span className="text-slate-400 text-sm">Active Orders</span>
                    <span className="text-lg font-bold mono text-indigo-400">{state.wallet.active_positions} Positions</span>
                  </div>
                  <div className="bg-indigo-500/10 p-3 rounded border border-indigo-500/20">
                    <div className="text-[10px] text-indigo-400 uppercase mb-1">Session PnL</div>
                    <div className={`text-lg font-bold ${state.wallet.pnl_today >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
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
