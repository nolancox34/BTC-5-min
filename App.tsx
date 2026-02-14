
import React, { useState, useEffect, useRef } from 'react';
import { GlobalState, BotDecision, Market } from './types';
import { MarketSimulator } from './services/dataGenerator';
import { ProfitMaxEngine } from './services/botService';
import { getExpertInsight } from './services/geminiService';
import Header from './components/Header';
import MarketGrid from './components/MarketGrid';
import Terminal from './components/Terminal';

interface PendingPosition {
  market_id: string;
  slug: string;
  amount: number;
  side: 'YES' | 'NO' | 'BOTH';
  strike: number;
  expiry: number;
}

const App: React.FC = () => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [state, setState] = useState<GlobalState>(() => MarketSimulator.generateInitialState());
  const [decisions, setDecisions] = useState<BotDecision[]>([]);
  const [pendingPositions, setPendingPositions] = useState<PendingPosition[]>([]);
  const [insight, setInsight] = useState<string>("RECOVERY_PROTOCOL: Calibrating live feeds...");
  const [isLive, setIsLive] = useState(true);
  const [aiStatus, setAiStatus] = useState<'connected' | 'cooldown' | 'error' | 'thinking'>('connected');
  const [hasPaidKey, setHasPaidKey] = useState(false);
  const [bootProgress, setBootProgress] = useState(0);
  
  const isFetchingInsight = useRef(false);
  const consecutiveLosses = useRef(0);

  // System Boot Animation
  useEffect(() => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 25;
      if (progress >= 100) {
        clearInterval(interval);
        setBootProgress(100);
        setTimeout(() => setIsInitializing(false), 500);
      } else {
        setBootProgress(progress);
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const handleManualTrade = (marketId: string, side: 'YES' | 'NO') => {
    const market = state.markets.find(m => m.id === marketId);
    if (!market || state.wallet.balance_usdc < 5) return;

    const amount = Math.max(10, state.wallet.balance_usdc * 0.01);
    
    const manualTrade: BotDecision = {
      market_id: market.id,
      slug: market.slug,
      action: side === 'YES' ? 'BUY_YES' : 'BUY_NO',
      side: side,
      amount_usdc: amount,
      confidence: 100,
      est_profit_pct: 0,
      ces: 10,
      learned_from_history: "MANUAL_STRIKE: User identified lag edge.",
      timestamp: new Date().toISOString()
    };

    setPendingPositions(prev => [...prev, {
      market_id: market.id,
      slug: market.slug,
      amount: amount,
      side: side,
      strike: market.strike_price,
      expiry: Date.now() + (300 * 1000)
    }]);

    setState(prev => ({
      ...prev,
      wallet: {
        ...prev.wallet,
        balance_usdc: prev.wallet.balance_usdc - amount
      }
    }));

    setDecisions(prev => [...prev, manualTrade].slice(-100));
  };

  useEffect(() => {
    if (!isLive || isInitializing) return;
    
    const runTick = async () => {
      try {
        const nextState = await MarketSimulator.tick(state);
        const newDecisions = ProfitMaxEngine.calculate(nextState);
        
        let newBalance = state.wallet.balance_usdc;
        let newPnL = state.wallet.pnl_today;
        const terminalUpdates: BotDecision[] = [];

        // 1. Bot Auto-Execution
        const executedBotTrades = newDecisions.filter(d => d.action !== 'HOLD');
        const newPositions: PendingPosition[] = [];

        executedBotTrades.forEach(trade => {
          const existing = pendingPositions.find(p => p.market_id === trade.market_id);
          // ADJUSTMENT: Lowered threshold from 8.5 to 7.0 for active sniping
          if (!existing && newBalance >= trade.amount_usdc && trade.ces >= 7.0) {
            newBalance -= trade.amount_usdc;
            newPositions.push({
              market_id: trade.market_id,
              slug: trade.slug,
              amount: trade.amount_usdc,
              side: trade.side as any,
              strike: nextState.markets.find(m => m.id === trade.market_id)?.strike_price || 0,
              expiry: Date.now() + (300 * 1000)
            });
            terminalUpdates.push(trade);
          }
        });

        // 2. Settlement Simulation
        const currentBtcPrice = nextState.btc.price;
        const remainingPositions: PendingPosition[] = [];
        const activeMarketIds = new Set(nextState.markets.map(m => m.id));
        
        pendingPositions.forEach(pos => {
          if (!activeMarketIds.has(pos.market_id)) {
            let won = false;
            if (pos.side === 'YES') won = currentBtcPrice > pos.strike;
            else if (pos.side === 'NO') won = currentBtcPrice <= pos.strike;
            else if (pos.side === 'BOTH') won = true;

            const payoutMultiplier = pos.side === 'BOTH' ? 1.05 : 1.95; // Improved payout for simulation
            const resultAmount = won ? pos.amount * payoutMultiplier : 0;
            const tradePnL = resultAmount - pos.amount;

            newBalance += resultAmount;
            newPnL += tradePnL;

            terminalUpdates.push({
              market_id: pos.market_id,
              slug: pos.slug,
              action: won ? 'SELL' : 'HOLD',
              side: pos.side,
              amount_usdc: resultAmount,
              confidence: won ? 100 : 0,
              est_profit_pct: 0,
              ces: won ? 10 : 0,
              learned_from_history: won ? `RESOLVED_WIN: +$${tradePnL.toFixed(2)}` : `RESOLVED_LOSS: -$${pos.amount.toFixed(2)}`,
              timestamp: new Date().toISOString()
            } as BotDecision);
          } else {
            remainingPositions.push(pos);
          }
        });

        const finalPending = [...remainingPositions, ...newPositions];
        setPendingPositions(finalPending);

        if (terminalUpdates.length > 0) {
          setDecisions(prev => [...prev, ...terminalUpdates].slice(-100));
        }

        setState({ 
          ...nextState, 
          decisions: newDecisions,
          wallet: {
            ...state.wallet,
            balance_usdc: newBalance,
            pnl_today: newPnL,
            active_positions: finalPending.length
          }
        });
      } catch (err) {
        console.error("TICK_ERROR:", err);
      }
    };

    const interval = setInterval(runTick, 2000); 
    return () => clearInterval(interval);
  }, [isLive, state, isInitializing, pendingPositions]);

  // Periodic AI Insights
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
    const heartbeat = setInterval(fetchInsight, 20000);
    return () => clearInterval(heartbeat);
  }, [isInitializing, state.btc.price]);

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-12">
        <div className="max-w-md w-full space-y-6 text-center">
          <div className="w-16 h-16 bg-amber-500 rounded-2xl mx-auto flex items-center justify-center shadow-[0_0_30px_rgba(245,158,11,0.3)] animate-pulse">
             <svg className="h-8 w-8 text-slate-950" viewBox="0 0 20 20" fill="currentColor">
               <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
             </svg>
          </div>
          <h1 className="text-white font-black uppercase text-2xl mt-4 tracking-tighter">PROFITMAX <span className="text-amber-500">PM5 v1.3</span></h1>
          <p className="text-slate-500 font-bold text-[10px] uppercase tracking-widest">Establishing secure CEX bridge...</p>
          <div className="w-full bg-slate-900 h-1.5 mt-4 rounded-full overflow-hidden border border-white/5">
             <div className="bg-amber-500 h-full transition-all duration-300 shadow-[0_0_10px_#f59e0b]" style={{ width: `${bootProgress}%` }}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col p-4 md:p-6 bg-[#020617]">
      <div className="fixed inset-0 pointer-events-none opacity-20"><div className="scanline"></div></div>

      <div className="relative z-10 max-w-7xl mx-auto w-full flex flex-col gap-4 h-full">
        <Header 
          btc={state.btc} 
          wallet={state.wallet} 
          isLive={isLive} 
          onToggleLive={() => setIsLive(!isLive)} 
          aiStatus={aiStatus === 'thinking' ? 'connected' : aiStatus}
          isPaid={hasPaidKey}
          networkStatus={MarketSimulator.networkStatus}
        />

        <div className="glass px-5 py-3 rounded-xl border-l-4 border-l-sky-500 bg-sky-950/10 flex items-center justify-between gap-6 shadow-xl">
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 flex items-center justify-center rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <span className="text-[8px] font-black text-sky-400 uppercase tracking-widest block opacity-70">Quant Analysis Protocol</span>
              <p className="text-sm text-white font-bold italic tracking-tight">"{insight}"</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          <div className="lg:col-span-8 space-y-4">
            <MarketGrid 
              markets={state.markets} 
              decisions={state.decisions} 
              btc={state.btc} 
              onManualTrade={handleManualTrade}
            />
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Session Success', value: `${state.historical_summary.recent_resolved_wr}%`, color: 'text-emerald-400' },
                { label: 'Global Momentum', value: state.btc.momentum_score.toFixed(1), color: 'text-amber-400' },
                { label: 'Relative Vol', value: state.btc.vol.toFixed(3), color: 'text-sky-400' },
                { label: 'Poly Drift', value: (state.btc.change_1m * 100).toFixed(4) + '%', color: state.btc.change_1m >= 0 ? 'text-emerald-400' : 'text-rose-400' }
              ].map((stat, i) => (
                <div key={i} className="glass p-4 rounded-xl border border-white/5 shadow-lg group hover:border-white/10 transition-colors">
                  <div className="text-[8px] text-slate-500 font-black uppercase mb-1 tracking-widest">{stat.label}</div>
                  <div className={`text-xl font-black mono ${stat.color}`}>{stat.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-col gap-4">
             <div className="h-[300px]">
                <Terminal decisions={decisions} />
             </div>
             
             <div className="glass p-6 rounded-xl border border-white/5 bg-slate-900/40 shadow-2xl">
               <div className="flex items-center gap-2 mb-6">
                 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></div>
                 <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Capital Distribution</h3>
               </div>
               <div className="space-y-6">
                  <div className="flex justify-between items-end">
                    <span className="text-slate-500 text-xs font-bold uppercase tracking-tighter">Liquid USDC</span>
                    <span className="text-3xl font-black mono text-white tracking-tighter">${state.wallet.balance_usdc.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-end border-t border-white/5 pt-4">
                    <span className="text-slate-500 text-xs font-bold uppercase tracking-tighter">Net Realized</span>
                    <span className={`text-2xl font-black mono ${state.wallet.pnl_today >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {state.wallet.pnl_today >= 0 ? '+' : ''}${state.wallet.pnl_today.toFixed(2)}
                    </span>
                  </div>
                  <div className="bg-slate-950/60 p-3 rounded-lg border border-white/5 mt-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[8px] text-slate-500 font-black uppercase">Active Snipes</span>
                      <span className="text-xs font-black text-amber-500">{state.wallet.active_positions}</span>
                    </div>
                    <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                       <div className="bg-amber-500 h-full" style={{ width: `${(state.wallet.active_positions / 20) * 100}%` }}></div>
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
