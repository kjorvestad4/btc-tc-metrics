import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Bitcoin, Zap, GitBranch } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { SCENARIOS, DEFAULT_PARAMS, runSimulation, recalibrateDrift } from "@/lib/btcEngine";
import InteractiveOracle from "../btc-engine/InteractiveOracle";
import BTCEngineChart from "../btc-engine/BTCEngineChart";
import BTCEngineControls from "../btc-engine/BTCEngineControls";
import OnChainPanel from "../btc-engine/OnChainPanel";
import ModelVaultPanel from "../btc-engine/ModelVaultPanel";

export default function BTCEngineTab({ params, liveData }) {
  const btcPrice = liveData?.btc_price ?? params.btc_price ?? 85000;

  const [engineParams, setEngineParams] = useState(DEFAULT_PARAMS);
  const [scenario, setScenario] = useState("high_treasury_nash");
  const [onChainData, setOnChainData] = useState(null);
  const [polling, setPolling] = useState(false);
  const [autoRecalibrated, setAutoRecalibrated] = useState(false);
  const [liveMode, setLiveMode] = useState(true);
  const [countdown, setCountdown] = useState(60);

  const scenarioConfig = SCENARIOS[scenario];

  const handleReset = () => setEngineParams(DEFAULT_PARAMS);

  // Run on-chain poll
  const handlePoll = useCallback(async () => {
    setPolling(true);
    setAutoRecalibrated(false);
    try {
      const res = await base44.functions.invoke("btcOnChain", {});
      const data = res.data ?? res;
      if (data && !data.error) {
        setOnChainData(data);

        // Auto-recalibrate drift if positive signals
        if (data.hash_health > 0.85 || data.treasury_flow > 500) {
          setEngineParams(prev => recalibrateDrift(prev, data));
          setAutoRecalibrated(true);
        }
      }
    } catch (e) {
      console.error("On-chain poll failed", e);
    } finally {
      setPolling(false);
    }
  }, []);

  // Auto-poll on mount
  useEffect(() => {
    handlePoll();
  }, [handlePoll]);

  // ── 60-second live polling loop ──
  // Polls on-chain data → recalibrates drift → chart auto-regenerates via memoized simResult
  useEffect(() => {
    if (!liveMode) return;
    setCountdown(60);
    const tick = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          handlePoll();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [liveMode, handlePoll]);

  // Run simulation (memoized)
  const simResult = useMemo(() => {
    return runSimulation(btcPrice, engineParams, scenario, onChainData);
  }, [btcPrice, engineParams, scenario, onChainData]);

  return (
    <div className="space-y-4">
      {/* Banner */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
            <Bitcoin className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Universal BTC Price Engine</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Monte Carlo simulation with regime shifts, herding dynamics, treasury Nash equilibrium,
              and real-time on-chain recalibration. {engineParams.simulations} paths × {engineParams.horizon_years}y horizon — starting {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.
            </p>
          </div>
        </div>
      </div>

      {/* On-chain panel */}
      <OnChainPanel
        onChainData={onChainData}
        polling={polling}
        onPoll={handlePoll}
        autoRecalibrated={autoRecalibrated}
        liveMode={liveMode}
        setLiveMode={setLiveMode}
        countdown={countdown}
      />

      {/* Interactive Oracle (Plotly-style dual panel) */}
      <InteractiveOracle
        simResult={simResult}
        startPrice={btcPrice}
        scenario={scenarioConfig}
        onChainData={onChainData}
      />

      {/* Scenario selector */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <GitBranch className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Scenario Selection</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(SCENARIOS).map(([key, sc]) => (
            <button
              key={key}
              onClick={() => setScenario(key)}
              className={`text-xs px-3 py-2 rounded-lg border transition-all text-left max-w-[220px] ${
                scenario === key ? "scale-[1.02]" : "opacity-60 hover:opacity-90"
              }`}
              style={{
                borderColor: scenario === key ? sc.color : "hsl(217 33% 17%)",
                background: scenario === key ? `${sc.color}15` : "transparent",
              }}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="w-2 h-2 rounded-full" style={{ background: sc.color }} />
                <span className="font-semibold" style={{ color: scenario === key ? sc.color : "hsl(210 40% 96%)" }}>
                  {sc.label}
                </span>
              </div>
              <p className="text-[9px] text-muted-foreground leading-tight">{sc.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <BTCEngineChart simResult={simResult} startPrice={btcPrice} scenario={scenarioConfig} />

      {/* Parameter controls (always visible, active for custom scenario) */}
      <BTCEngineControls
        params={engineParams}
        onChange={setEngineParams}
        onReset={handleReset}
      />

      {/* Model Vault — serialize + save */}
      <ModelVaultPanel
        engineParams={engineParams}
        scenario={scenario}
        onChainData={onChainData}
        btcPrice={btcPrice}
      />

      {/* Stats summary */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Simulation Summary</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Starting Price", value: `$${btcPrice.toLocaleString()}`, color: "text-foreground" },
            { label: "Bear Case (p5)", value: `$${Math.round(simResult.percentiles.p5).toLocaleString()}`, color: "text-red-400" },
            { label: "Median Outcome (p50)", value: `$${Math.round(simResult.percentiles.p50).toLocaleString()}`, color: "text-amber-400" },
            { label: "Bull Case (p95)", value: `$${Math.round(simResult.percentiles.p95).toLocaleString()}`, color: "text-green-400" },
            {
              label: "Median Upside",
              value: `${simResult.percentiles.p50 > btcPrice ? "+" : ""}${((simResult.percentiles.p50 / btcPrice - 1) * 100).toFixed(0)}%`,
              color: simResult.percentiles.p50 > btcPrice ? "text-green-400" : "text-red-400",
            },
          ].map(s => (
            <div key={s.label} className="p-2.5 bg-secondary/50 rounded-lg border border-border text-center">
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
              <p className={`text-sm font-bold font-mono ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Percentile notation explainer */}
      <div className="bg-secondary/30 border border-border rounded-xl p-3">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <h4 className="text-[11px] font-semibold text-foreground uppercase tracking-wider">Understanding Percentile Outcomes</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-[10px]">
          <div className="flex items-start gap-2">
            <span className="text-red-400 font-bold font-mono shrink-0">p5</span>
            <span className="text-muted-foreground"><strong className="text-red-400">Bear Case:</strong> 95% of simulations ended above this price. Only the worst 5% of outcomes were lower. Think of it as a "things go badly" scenario.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-amber-400 font-bold font-mono shrink-0">p50</span>
            <span className="text-muted-foreground"><strong className="text-amber-400">Median:</strong> Half the simulations ended above this price, half below. The "most likely" middle outcome — not a prediction, just the center of the range.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green-400 font-bold font-mono shrink-0">p95</span>
            <span className="text-muted-foreground"><strong className="text-green-400">Bull Case:</strong> Only 5% of simulations ended above this price. The optimistic ceiling — possible but unlikely. Think "things go very well."</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-muted-foreground font-bold font-mono shrink-0">Range</span>
            <span className="text-muted-foreground">The spread between p5 and p95 shows uncertainty. A narrow band means the model is more confident; a wide band means high volatility and less certainty about the future.</span>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground/40 text-center">
        Educational Monte Carlo simulation. Not financial advice.
        On-chain data via blockchain.info + CoinGecko + Yahoo Finance. Past performance does not guarantee future results.
      </p>
    </div>
  );
}