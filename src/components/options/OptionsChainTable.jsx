import React, { useState, useMemo } from "react";
import { formatCurrency } from "@/lib/calculations";

const TICK_STYLE = "text-[10px] font-mono";

function badge(text, colorClass) {
  return (
    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${colorClass}`}>
      {text}
    </span>
  );
}

export default function OptionsChainTable({ calls, puts, underlyingPrice, onSelectContract, selectedContract }) {
  const [view, setView] = useState("both"); // "calls" | "puts" | "both"
  const [strikeFilter, setStrikeFilter] = useState("all"); // "itm" | "otm" | "all"
  const [sortBy, setSortBy] = useState("strike");

  const enriched = (contracts, type) =>
    contracts.map(c => {
      const strike = c.strike_price;
      const itm = type === "call" ? underlyingPrice > strike : underlyingPrice < strike;
      const intrinsic = type === "call"
        ? Math.max(0, underlyingPrice - strike)
        : Math.max(0, strike - underlyingPrice);
      const moneyness = ((underlyingPrice - strike) / underlyingPrice * 100).toFixed(1);
      return { ...c, itm, intrinsic, moneyness };
    });

  const enrichedCalls = useMemo(() => enriched(calls ?? [], "call"), [calls, underlyingPrice]);
  const enrichedPuts = useMemo(() => enriched(puts ?? [], "put"), [puts, underlyingPrice]);

  const filterContracts = (arr) => {
    if (strikeFilter === "itm") return arr.filter(c => c.itm);
    if (strikeFilter === "otm") return arr.filter(c => !c.itm);
    return arr;
  };

  const isSelected = (c) => selectedContract?.ticker === c.ticker;

  const ContractRow = ({ c, type }) => {
    const priceColor = type === "call" ? "text-green-400" : "text-red-400";
    const itmColor = c.itm ? "text-primary" : "text-muted-foreground";
    const selected = isSelected(c);
    return (
      <tr
        className={`border-b border-border/30 cursor-pointer transition-colors ${
          selected ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-secondary/40"
        } ${c.itm ? "bg-secondary/20" : ""}`}
        onClick={() => onSelectContract?.(c)}
      >
        <td className={`py-1 px-2 font-mono font-bold text-[10px] ${itmColor}`}>
          ${c.strike_price.toFixed(0)}
          {c.itm && <span className="ml-1 text-[8px] text-primary">ITM</span>}
        </td>
        <td className={`py-1 px-2 text-right ${TICK_STYLE} ${priceColor}`}>${c.bid?.toFixed(2) ?? "—"}</td>
        <td className={`py-1 px-2 text-right ${TICK_STYLE} ${priceColor}`}>${c.ask?.toFixed(2) ?? "—"}</td>
        <td className={`py-1 px-2 text-right ${TICK_STYLE} text-foreground`}>${c.mid?.toFixed(2) ?? "—"}</td>
        <td className={`py-1 px-2 text-right ${TICK_STYLE} text-muted-foreground`}>
          {c.volume?.toLocaleString() ?? "—"}
        </td>
        <td className={`py-1 px-2 text-right ${TICK_STYLE} text-muted-foreground`}>
          {c.open_interest?.toLocaleString() ?? "—"}
        </td>
        <td className={`py-1 px-2 text-right ${TICK_STYLE} text-amber-400`}>
          {c.iv != null ? `${c.iv}%` : "—"}
        </td>
        <td className={`py-1 px-2 text-right ${TICK_STYLE} text-cyan-400`}>
          {c.delta != null ? c.delta.toFixed(3) : "—"}
        </td>
        <td className={`py-1 px-2 text-right ${TICK_STYLE} text-purple-400`}>
          {c.theta != null ? c.theta.toFixed(4) : "—"}
        </td>
        <td className={`py-1 px-2 text-right ${TICK_STYLE} text-green-400`}>
          ${c.intrinsic?.toFixed(2)}
        </td>
      </tr>
    );
  };

  const colHeaders = (
    <tr className="border-b border-border text-muted-foreground text-[9px]">
      <th className="text-left py-1.5 px-2 font-medium">Strike</th>
      <th className="text-right py-1.5 px-2 font-medium">Bid</th>
      <th className="text-right py-1.5 px-2 font-medium">Ask</th>
      <th className="text-right py-1.5 px-2 font-medium">Mid</th>
      <th className="text-right py-1.5 px-2 font-medium">Volume</th>
      <th className="text-right py-1.5 px-2 font-medium">OI</th>
      <th className="text-right py-1.5 px-2 font-medium">IV</th>
      <th className="text-right py-1.5 px-2 font-medium">Delta</th>
      <th className="text-right py-1.5 px-2 font-medium">Theta</th>
      <th className="text-right py-1.5 px-2 font-medium">Intrinsic</th>
    </tr>
  );

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1">
          {["both", "calls", "puts"].map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`text-[10px] px-2.5 py-1 rounded-lg border font-semibold transition-colors capitalize ${
                view === v
                  ? v === "calls" ? "bg-green-500/20 border-green-500 text-green-400"
                    : v === "puts" ? "bg-red-500/20 border-red-500 text-red-400"
                    : "bg-primary/20 border-primary text-primary"
                  : "border-border text-muted-foreground hover:bg-secondary"
              }`}>{v}
            </button>
          ))}
        </div>
        <div className="flex gap-1 ml-2">
          {["all", "itm", "otm"].map(v => (
            <button key={v} onClick={() => setStrikeFilter(v)}
              className={`text-[10px] px-2.5 py-1 rounded-lg border font-semibold transition-colors uppercase ${
                strikeFilter === v ? "bg-secondary border-primary text-primary" : "border-border text-muted-foreground hover:bg-secondary"
              }`}>{v}
            </button>
          ))}
        </div>
        <span className="text-[10px] text-muted-foreground ml-auto flex items-center gap-2">
          <span className="text-amber-400/70">Δ/Θ require Polygon options access</span>
          <span>· Click any contract to load into simulator →</span>
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Calls */}
        {(view === "both" || view === "calls") && (
          <div>
            <p className="text-[10px] font-semibold text-green-400 uppercase tracking-wider mb-1.5">
              Calls ({filterContracts(enrichedCalls).length})
            </p>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-xs">
                <thead>{colHeaders}</thead>
                <tbody>
                  {filterContracts(enrichedCalls).map(c => (
                    <ContractRow key={c.ticker} c={c} type="call" />
                  ))}
                  {filterContracts(enrichedCalls).length === 0 && (
                    <tr><td colSpan={10} className="py-4 text-center text-muted-foreground text-[10px]">No data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Puts */}
        {(view === "both" || view === "puts") && (
          <div>
            <p className="text-[10px] font-semibold text-red-400 uppercase tracking-wider mb-1.5">
              Puts ({filterContracts(enrichedPuts).length})
            </p>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-xs">
                <thead>{colHeaders}</thead>
                <tbody>
                  {filterContracts(enrichedPuts).map(c => (
                    <ContractRow key={c.ticker} c={c} type="put" />
                  ))}
                  {filterContracts(enrichedPuts).length === 0 && (
                    <tr><td colSpan={10} className="py-4 text-center text-muted-foreground text-[10px]">No data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}