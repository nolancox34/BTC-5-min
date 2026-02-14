
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
  const [insight, setInsight] = useState<string>("RECOVERY_PROTOCOL: Learning from failures...");
  const [isLive, setIsLive] = useState(true);
  const [aiStatus, setAiStatus] = useState<'connected' | 'cooldown' | 'error' | 'thinking'>('connected');
  const [hasPaidKey, setHasPaidKey] = useState(false);
  const [bootProgress, setBootProgress] = useState(0);
  
  const isFetchingInsight = useRef(false);
  const consecutiveLosses = useRef(0);

  useEffect(() => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 30;
      if (progress >= 100) {
        clearInterval(interval);
        setBootProgress(100);
        setTimeout(() => setIsInitializing(false), 300);
      } else {
        setBootProgress(progress);
      }
    }, 80);

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

  const handleManualTrade = (marketId: string, side: 'YES' | 'NO') => {
    const market = state.markets.find(m => m.id === marketId);
    if (!market || state.wallet.balance_usdc < 10) return;

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
      learned_from_history: "MANUAL_OVERRIDE: User-initiated execution.",
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

    setDecisions(prev => [...prev, manualTrade].slice(-150));
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

        // 1. Bot Entry Logic (Only if balance permits and not in cooldown)
        const executedBotTrades = newDecisions.filter(d => d.action !== 'HOLD');
        const newPositions: PendingPosition[] = [];

        executedBotTrades.forEach(trade => {
          const existing = pendingPositions.find(p => p.market_id === trade.market_id);
          if (!existing && newBalance >= trade.amount_usdc && consecutiveLosses.current < 4) {
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

        // 2. Settlement Logic
        const currentBtcPrice = nextState.btc.price;
        const remainingPositions: PendingPosition[] = [];
        const activeMarketIds = new Set(nextState.markets.map(m => m.id));
        
        pendingPositions.forEach(pos => {
          if (!activeMarketIds.has(pos.market_id)) {
            let won = false;
            if (pos.side === 'YES') won = currentBtcPrice > pos.strike;
            else if (pos.side === 'NO') won = currentBtcPrice <= pos.strike;
            else if (pos.side === 'BOTH') won = true;

            if (won) consecutiveLosses.current = 0;
            else consecutiveLosses.current += 1;

            const payoutMultiplier = pos.side === 'BOTH' ? 1.05 : 1.88;
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
              learned_from_history: won ? `WIN: +$${tradePnL.toFixed(2)}` : `LOSS: -$${pos.amount.toFixed(2)}`,
              timestamp: new Date().toISOString()
            } as BotDecision);
          } else {
            remainingPositions.push(pos);
          }
        });

        const finalPending = [...remainingPositions, ...newPositions];
        setPendingPositions(finalPending);

        if (terminalUpdates.length > 0) {
          setDecisions(prev => [...prev, ...terminalUpdates].slice(-150));
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
        console.error("CRITICAL_TICK_ERROR:", err);
      }
    };

    const interval = setInterval(runTick, 2000); // Faster tick for live feel
    return () => clearInterval(interval);
  }, [isLive, state, isInitializing, pendingPositions]);

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
  }, [isInitializing, state.btc.price]);

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-12">
        <div className="max-w-md w-full space-y-6 text-center">
          <div className="w-16 h-16 bg-amber-500 rounded-2xl mx-auto flex items-center justify-center animate-pulse">
             <svg className="h-8 w-8 text-slate-950" viewBox="0 0 20 20" fill="currentColor">
               <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
             </svg>
          </div>
          <h1 className="text-white font-black uppercase text-xl mt-4 tracking-tighter">Repairing <span className="text-amber-500">PM5</span> Logic...</h1>
          <div className="w-full bg-slate-900 h-1 mt-4 rounded-full overflow-hidden">
             <div className="bg-amber-500 h-full transition-all duration-300" style={{ width: `${bootProgress}%` }}></div>
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

        <div className="glass px-5 py-3 rounded-xl border-l-4 border-l-sky-500 bg-sky-950/10 flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className={`w-8 h-8 flex items-center justify-center rounded-lg bg-sky-500/20 text-sky-400`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <span className="text-[8px] font-black text-sky-400 uppercase tracking-widest block">Strategic Oversight</span>
              <p className="text-xs text-white font-bold italic">"{insight}"</p>
            </div>
          </div>
          <div className="flex gap-4">
             <div className="text-right">
                <span className="text-[8px] text-slate-500 font-black uppercase block">Risk Mode</span>
                <span className={`text-[10px] font-black uppercase ${state.historical_summary.recent_resolved_wr < 65 ? 'text-rose-500' : 'text-emerald-500'}`}>
                  {state.historical_summary.recent_resolved_wr < 65 ? 'Defensive' : 'Aggressive'}
                </span>
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
                { label: 'Win Rate', value: `${state.historical_summary.recent_resolved_wr}%`, color: state.historical_summary.recent_resolved_wr < 65 ? 'text-rose-400' : 'text-emerald-400' },
                { label: 'Momentum', value: state.btc.momentum_score.toFixed(1), color: 'text-amber-400' },
                { label: 'Volatility', value: state.btc.vol.toFixed(3), color: 'text-sky-400' },
                { label: '1m Delta', value: (state.btc.change_1m * 100).toFixed(3) + '%', color: state.btc.change_1m >= 0 ? 'text-emerald-400' : 'text-rose-400' }
              ].map((stat, i) => (
                <div key={i} className="glass p-3 rounded-xl border border-white/5">
                  <div className="text-[8px] text-slate-500 font-black uppercase mb-1">{stat.label}</div>
                  <div className={`text-lg font-black mono ${stat.color}`}>{stat.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-col gap-4">
             <div className="h-[260px]">
                <Terminal decisions={decisions} />
             </div>
             <div className="glass p-5 rounded-xl border border-white/5 bg-slate-900/30">
               <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Liquidity Control</h3>
               <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <span className="text-slate-400 text-xs font-bold uppercase tracking-tighter">Balance</span>
                    <span className="text-2xl font-black mono text-white tracking-tighter">${state.wallet.balance_usdc.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-end border-t border-white/5 pt-4">
                    <span className="text-slate-400 text-xs font-bold uppercase tracking-tighter">Current PnL</span>
                    <span className={`text-xl font-black mono ${state.wallet.pnl_today >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {state.wallet.pnl_today >= 0 ? '+' : ''}${state.wallet.pnl_today.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center bg-slate-950/40 p-2 rounded-lg border border-white/5">
                    <span className="text-[8px] text-slate-500 font-black uppercase">Recent Sequence</span>
                    <div className="flex gap-1">
                       {Array.from({length: 5}).map((_, i) => (
                         <div key={i} className={`w-2 h-2 rounded-sm ${i < consecutiveLosses.current ? 'bg-rose-500' : 'bg-slate-700'}`}></div>
                       ))}
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
