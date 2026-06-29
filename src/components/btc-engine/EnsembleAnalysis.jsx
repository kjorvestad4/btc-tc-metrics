import React from "react";
import { Activity, Target } from "lucide-react";

const SUB_MODEL_INFO = {
  powerlaw_nash: { label: "Power Law + Nash", desc: "Base GBM with treasury pressure + herding dynamics" },
  garch_vol: { label: "GARCH(1,1)", desc: "Recursive conditional volatility estimation (σ²_t = ω + α·r² + β·σ²)" },
  onchain_ml: { label: "On-Chain ML", desc: "MVRV, Puell Multiple, NVT, Reserve Risk features" },
  metcalfe: { label: "Metcalfe", desc: "Network value = k × active_addresses²" },
  lppl: { label: "LPPL", desc: "Log-periodic power law bubble detection" },
  bayesian: { label: "Bayesian", desc: "Conjugate Gaussian drift recalibration" },
};

export default function EnsembleAnalysis({ ensemble, toggles, onToggle }) {
  const handleToggle = (key) => {
    onToggle(prev => ({ ...prev, [key]: !(prev[key] !== false) }));
  };

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Sub-Model Toggles</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {Object.entries(SUB_MODEL_INFO).map(([key, info]) => {
            const isActive = toggles[key] !== false;
            return (
              <button
                key={key}
                onClick={() => handleToggle(key)}
                className={`text-left p-2.5 rounded-lg border transition-all ${
                  isActive ? "bg-primary/10 border-primary/30" : "bg-secondary/30 border-border opacity-60"
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-semibold text-foreground">{info.label}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${isActive ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {isActive ? "ON" : "OFF"}
                  </span>
                </div>
                <p className="text-[9px] text-muted-foreground leading-tight">{info.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {ensemble && ensemble.subModels && ensemble.subModels.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">CFA Fusion Weights &amp; Contributions</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-1.5 pr-2 font-medium">Sub-Model</th>
                  <th className="text-right py-1.5 pr-2 font-medium">Drift</th>
                  <th className="text-right py-1.5 pr-2 font-medium">Volatility</th>
                  <th className="text-right py-1.5 pr-2 font-medium">Raw Weight</th>
                  <th className="text-right py-1.5 font-medium">Normalized</th>
                </tr>
              </thead>
              <tbody>
                {ensemble.subModels.map((m) => (
                  <tr key={m.name} className="border-b border-border/30 hover:bg-secondary/30">
                    <td className="py-1.5 pr-2 font-semibold text-foreground">{m.name}</td>
                    <td className="py-1.5 pr-2 text-right font-mono text-primary">{(m.drift * 100).toFixed(1)}%</td>
                    <td className="py-1.5 pr-2 text-right font-mono text-blue-400">{(m.vol * 100).toFixed(1)}%</td>
                    <td className="py-1.5 pr-2 text-right font-mono text-muted-foreground">{m.weight.toFixed(2)}</td>
                    <td className="py-1.5 text-right font-mono text-amber-400">{(m.normalizedWeight * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border">
                  <td className="py-1.5 pr-2 font-bold text-foreground">CFA Fused</td>
                  <td className="py-1.5 pr-2 text-right font-mono font-bold text-primary">{(ensemble.fusion.drift * 100).toFixed(1)}%</td>
                  <td className="py-1.5 pr-2 text-right font-mono font-bold text-blue-400">{(ensemble.fusion.vol * 100).toFixed(1)}%</td>
                  <td className="py-1.5 pr-2 text-right font-mono text-muted-foreground">{ensemble.fusion.totalWeight.toFixed(2)}</td>
                  <td className="py-1.5 text-right font-mono font-bold text-amber-400">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {ensemble?.diagnostics && (
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-green-400" />
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Active Algorithm Diagnostics</h3>
          </div>
          <div className="space-y-2 text-[11px]">
            {ensemble.diagnostics.garchVol != null && (
              <div className="flex justify-between p-2 bg-secondary/30 rounded">
                <span className="text-muted-foreground">GARCH(1,1) Forecast Volatility</span>
                <span className="font-mono text-blue-400">{(ensemble.diagnostics.garchVol * 100).toFixed(1)}%</span>
              </div>
            )}
            {ensemble.diagnostics.onChainFeatures && (
              <>
                <div className="flex justify-between p-2 bg-secondary/30 rounded">
                  <span className="text-muted-foreground">MVRV Ratio</span>
                  <span className="font-mono text-amber-400">{ensemble.diagnostics.onChainFeatures.mvrv?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between p-2 bg-secondary/30 rounded">
                  <span className="text-muted-foreground">MVRV Z-Score</span>
                  <span className="font-mono text-amber-400">{ensemble.diagnostics.onChainFeatures.mvrvZ?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between p-2 bg-secondary/30 rounded">
                  <span className="text-muted-foreground">NVT Ratio</span>
                  <span className="font-mono text-cyan-400">{ensemble.diagnostics.onChainFeatures.nvt?.toFixed(0)}</span>
                </div>
                <div className="flex justify-between p-2 bg-secondary/30 rounded">
                  <span className="text-muted-foreground">Puell Multiple</span>
                  <span className="font-mono text-red-400">{ensemble.diagnostics.onChainFeatures.puell?.toFixed(2)}</span>
                </div>
              </>
            )}
            {ensemble.diagnostics.lpplResult && (
              <div className="flex justify-between p-2 bg-secondary/30 rounded">
                <span className="text-muted-foreground">LPPL Bubble Confidence</span>
                <span className={`font-mono ${ensemble.diagnostics.lpplResult.bubble ? "text-red-400" : "text-green-400"}`}>
                  {(ensemble.diagnostics.lpplResult.confidence * 100).toFixed(0)}%{ensemble.diagnostics.lpplResult.bubble ? " ⚠ BUBBLE" : ""}
                </span>
              </div>
            )}
            {ensemble.diagnostics.bayesianResult?.updated && (
              <div className="flex justify-between p-2 bg-secondary/30 rounded">
                <span className="text-muted-foreground">Bayesian Drift Shift</span>
                <span className={`font-mono ${ensemble.diagnostics.bayesianResult.shift > 0 ? "text-green-400" : "text-red-400"}`}>
                  {ensemble.diagnostics.bayesianResult.shift > 0 ? "+" : ""}{ensemble.diagnostics.bayesianResult.shift}
                </span>
              </div>
            )}
            {ensemble.diagnostics.metcalfeResult && (
              <div className="flex justify-between p-2 bg-secondary/30 rounded">
                <span className="text-muted-foreground">Metcalfe Active Addresses</span>
                <span className="font-mono text-purple-400">{(ensemble.diagnostics.metcalfeResult.activeAddresses / 1e6).toFixed(2)}M</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}