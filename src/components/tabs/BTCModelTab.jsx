import React from "react";
import ProjectionChart from "../dashboard/ProjectionChart";
import MetricCard from "../dashboard/MetricCard";
import { Bitcoin, TrendingUp, ArrowUpRight, Wallet } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/calculations";

export default function BTCModelTab({ params, projections }) {
  const y1 = projections.find((p) => p.quarter === 4);
  const y3 = projections.find((p) => p.quarter === 12);
  const y5 = projections.find((p) => p.quarter === 20);
  const last = projections[projections.length - 1];

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold text-foreground mb-1">Bitcoin Price Path Model</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Projecting BTC at <span className="text-amber-400 font-mono">{params.btc_cagr}% CAGR</span> with{" "}
          <span className="text-primary font-mono">{formatNumber(params.btc_accumulation_per_quarter)} BTC/quarter</span> accumulation.
          Per @PunterJeff, Bitcoin's monetary premium compounds as fiat debasement accelerates.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard title="Current BTC" value={formatCurrency(params.btc_price)} icon={Bitcoin} accentClass="text-amber-400" />
          <MetricCard title="Year 1" value={y1 ? formatCurrency(y1.btc_price) : "—"} icon={ArrowUpRight} accentClass="text-green-400" />
          <MetricCard title="Year 3" value={y3 ? formatCurrency(y3.btc_price) : "—"} icon={ArrowUpRight} accentClass="text-blue-400" />
          <MetricCard title="Year 5" value={y5 ? formatCurrency(y5.btc_price) : "—"} icon={ArrowUpRight} accentClass="text-purple-400" />
        </div>
      </div>

      <ProjectionChart
        title="Bitcoin Price Projection"
        data={projections}
        lines={[{ key: "btc_price", name: "BTC Price (USD)", color: "#F59E0B" }]}
        type="area"
        height={320}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ProjectionChart
          title="Strategy BTC Holdings Over Time"
          data={projections}
          lines={[{ key: "btc_holdings", name: "BTC Holdings", color: "#22C55E" }]}
          type="area"
          height={250}
        />
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">BTC Accumulation Impact</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-xs text-muted-foreground">Starting Holdings</span>
              <span className="text-sm font-mono text-foreground">{formatNumber(params.mstr_btc_holdings)} BTC</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-xs text-muted-foreground">Quarterly Accumulation</span>
              <span className="text-sm font-mono text-primary">+{formatNumber(params.btc_accumulation_per_quarter)} BTC</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-xs text-muted-foreground">Annual Accumulation</span>
              <span className="text-sm font-mono text-primary">+{formatNumber(params.btc_accumulation_per_quarter * 4)} BTC</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-xs text-muted-foreground">5Y Holdings Projection</span>
              <span className="text-sm font-mono text-amber-400">{last ? formatNumber(last.btc_holdings) : "—"} BTC</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-xs text-muted-foreground">5Y BTC NAV</span>
              <span className="text-sm font-mono text-amber-400">{last ? formatCurrency(last.btc_nav) : "—"}</span>
            </div>
          </div>
          <div className="mt-4 p-3 rounded-lg bg-amber-400/5 border border-amber-400/20">
            <p className="text-[10px] text-amber-400/80 leading-relaxed">
              <strong>@PunterJeff insight:</strong> Strategy uses perpetual preferred equity ("digital credit") to continuously acquire BTC without selling. 
              Each issuance funds more BTC, increasing mNAV, creating a reflexive flywheel.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}