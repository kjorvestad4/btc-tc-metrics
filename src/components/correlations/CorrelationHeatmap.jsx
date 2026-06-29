import React from "react";
import { Grid3x3 } from "lucide-react";

const ASSETS = ["BTC", "MSTR", "ASST", "MSTY"];

// 1Y Pearson correlation matrix (daily log-returns)
// Direct from back-tested data:
//   BTC↔MSTR=0.84, BTC↔ASST=0.78, BTC↔MSTY=0.72
//   MSTR↔MSTY=sqrt(price_r2=0.58)=0.76
// Derived (BTC-mediated estimate): MSTR↔ASST, ASST↔MSTY
const MATRIX = {
  BTC:  { BTC: 1.00, MSTR: 0.84, ASST: 0.78, MSTY: 0.72 },
  MSTR: { BTC: 0.84, MSTR: 1.00, ASST: 0.66, MSTY: 0.76 },
  ASST: { BTC: 0.78, MSTR: 0.66, ASST: 1.00, MSTY: 0.56 },
  MSTY: { BTC: 0.72, MSTR: 0.76, ASST: 0.56, MSTY: 1.00 },
};

const DERIVED_PAIRS = new Set(["MSTR-ASST", "ASST-MSTY"]);

function colorForCorr(corr) {
  if (corr >= 0.9) return { bg: "rgba(34,197,94,0.30)", text: "text-green-400" };
  if (corr >= 0.7) return { bg: "rgba(34,197,94,0.15)", text: "text-green-400" };
  if (corr >= 0.5) return { bg: "rgba(245,158,11,0.15)", text: "text-amber-400" };
  if (corr >= 0.3) return { bg: "rgba(249,115,22,0.15)", text: "text-orange-400" };
  return { bg: "rgba(239,68,68,0.15)", text: "text-red-400" };
}

export default function CorrelationHeatmap() {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Grid3x3 className="w-4 h-4 text-purple-400" />
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
          Asset Correlation Heatmap (1Y)
        </h3>
      </div>
      <p className="text-[10px] text-muted-foreground mb-3">
        Pearson correlation of daily log-returns. Diagonal = 1.00 (self-correlation).
        Values marked * are BTC-mediated estimates (r<sub>A,B</sub> ≈ r<sub>A,BTC</sub> × r<sub>B,BTC</sub>).
      </p>

      <div className="overflow-x-auto">
        <div className="inline-block">
          {/* Header row */}
          <div className="flex">
            <div className="w-14" />
            {ASSETS.map((a) => (
              <div
                key={a}
                className="w-14 text-center text-[10px] font-mono font-bold text-muted-foreground py-1"
              >
                {a}
              </div>
            ))}
          </div>
          {/* Data rows */}
          {ASSETS.map((rowAsset) => (
            <div key={rowAsset} className="flex">
              <div className="w-14 text-[10px] font-mono font-bold text-muted-foreground flex items-center justify-end pr-2 py-1">
                {rowAsset}
              </div>
              {ASSETS.map((colAsset) => {
                const corr = MATRIX[rowAsset][colAsset];
                const isDiag = rowAsset === colAsset;
                const isDerived =
                  DERIVED_PAIRS.has(`${rowAsset}-${colAsset}`) ||
                  DERIVED_PAIRS.has(`${colAsset}-${rowAsset}`);
                const { bg, text } = colorForCorr(corr);
                return (
                  <div
                    key={colAsset}
                    className="w-14 h-11 flex items-center justify-center rounded m-0.5 border border-border/50"
                    style={{ background: bg }}
                    title={`${rowAsset} ↔ ${colAsset}: r = ${corr.toFixed(2)}${
                      isDerived && !isDiag ? " (BTC-mediated estimate)" : ""
                    }`}
                  >
                    <span
                      className={`text-xs font-mono font-bold ${
                        isDiag ? "text-muted-foreground/60" : text
                      }`}
                    >
                      {corr.toFixed(2)}
                      {isDerived && !isDiag ? "*" : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 mt-3 text-[9px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded" style={{ background: "rgba(34,197,94,0.30)" }} /> ≥ 0.70
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded" style={{ background: "rgba(245,158,11,0.15)" }} /> 0.50–0.69
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded" style={{ background: "rgba(249,115,22,0.15)" }} /> 0.30–0.49
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded" style={{ background: "rgba(239,68,68,0.15)" }} /> &lt; 0.30
        </div>
        <span className="text-muted-foreground/60">* BTC-mediated estimate</span>
      </div>
    </div>
  );
}