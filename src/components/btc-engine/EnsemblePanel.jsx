import React from "react";
import { Layers, Download, Zap } from "lucide-react";

const SUB_MODEL_COLORS = {
  "Power Law + Nash": "#22C55E",
  "GARCH(1,1)": "#60A5FA",
  "On-Chain ML": "#F59E0B",
  "Metcalfe": "#A855F7",
  "LPPL": "#EF4444",
  "Bayesian": "#06B6D4",
};

export default function EnsemblePanel({ ensemble, onExport }) {
  if (!ensemble || !ensemble.fusion) {
    return (
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Layers className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Ensemble Panel</h3>
        </div>
        <p className="text-xs text-muted-foreground">No ensemble data available. Enable sub-models in the Analysis tab.</p>
      </div>
    );
  }

  const { subModels, fusion, diagnostics } = ensemble;
  const { interpretation } = diagnostics;
  const signal = fusion.drift > 0 ? "Bullish" : fusion.drift < 0 ? "Bearish" : "Neutral";
  const signalColor = fusion.drift > 0 ? "text-green-400" : fusion.drift < 0 ? "text-red-400" : "text-muted-foreground";

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">CFA Meta-Fusion Result</h3>
          </div>
          <button
            onClick={onExport}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border bg-secondary hover:bg-secondary/80 text-foreground transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export JSON
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="p-2.5 bg-secondary/50 rounded-lg border border-border text-center">
            <p className="text-[10px] text-muted-foreground">Fused Drift</p>
            <p className="text-base font-bold font-mono text-primary">{(fusion.drift * 100).toFixed(1)}%</p>
          </div>
          <div className="p-2.5 bg-secondary/50 rounded-lg border border-border text-center">
            <p className="text-[10px] text-muted-foreground">Fused Volatility</p>
            <p className="text-base font-bold font-mono text-blue-400">{(fusion.vol * 100).toFixed(1)}%</p>
          </div>
          <div className="p-2.5 bg-secondary/50 rounded-lg border border-border text-center">
            <p className="text-[10px] text-muted-foreground">Active Sub-Models</p>
            <p className="text-base font-bold font-mono text-amber-400">{diagnostics.modelCount}</p>
          </div>
          <div className="p-2.5 bg-secondary/50 rounded-lg border border-border text-center">
            <p className="text-[10px] text-muted-foreground">Signal</p>
            <p className={`text-base font-bold ${signalColor}`}>{signal}</p>
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Sub-Model Signals</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {subModels.map((m) => {
            const color = SUB_MODEL_COLORS[m.name] || "#888";
            return (
              <div key={m.name} className="p-3 bg-secondary/50 rounded-lg border border-border">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                    <span className="text-xs font-semibold text-foreground">{m.name}</span>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground">w={m.normalizedWeight.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-muted-foreground">Drift: <span className="font-mono" style={{ color }}>{(m.drift * 100).toFixed(1)}%</span></span>
                  <span className="text-muted-foreground">Vol: <span className="font-mono text-blue-400">{(m.vol * 100).toFixed(1)}%</span></span>
                </div>
                <p className="text-[9px] text-muted-foreground leading-tight">{m.signal}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">AI Interpretation</h3>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{interpretation}</p>
      </div>
    </div>
  );
}