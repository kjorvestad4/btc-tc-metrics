import React, { useState } from "react";
import MetricCard from "../dashboard/MetricCard";
import { TrendingUp, Building2, Bitcoin, Activity, Shield, Layers, RefreshCw, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/calculations";
import { ASST_DEFAULTS } from "./ASSTModelTab";
import {
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar
} from "recharts";

const MSTR_DEBT_M = 8254;
const MSTR_PREF_M = 11355;
const MSTR_DEBT_PREF_M = MSTR_DEBT_M + MSTR_PREF_M;
const MSTR_CASH_M = 2250; // official: $2.25B USD cash reserve

const TICK = { fontSize: 9, fill: "hsl(215 20% 55%)" };
const GRID = "hsl(217 33% 17%)";

function CompareRow({ label, mstrVal, asstVal, highlight, mstrColor = "text-primary", asstColor = "text-blue-400" }) {
  return (
    <div className={`flex items-start justify-between py-2 border-b border-border/40 gap-2 ${highlight ? "bg-secondary/20 -mx-2 px-2 rounded" : ""}`}>
      <span className="text-xs text-muted-foreground flex-1">{label}</span>
      <span className={`text-xs font-mono font-bold ${mstrColor} w-28 text-right shrink-0`}>{mstrVal}</span>
      <span className={`text-xs font-mono font-bold ${asstColor} w-28 text-right shrink-0`}>{asstVal}</span>
    </div>
  );
}

export default function MSTRvsASSTTab({ params, liveData, onRefresh, refreshing }) {
  const [showDiff, setShowDiff] = useState(false);

  const btcPrice = liveData?.btc_price ?? params.btc_price;
  const mstrPrice = liveData?.mstr_price ?? params.mstr_price;
  const asstPrice = liveData?.asst_price ?? ASST_DEFAULTS.price;

  // MSTR calcs
  const mstrBtcNav = params.mstr_btc_holdings * btcPrice;
  const mstrMarketCap = mstrPrice * params.mstr_shares_outstanding * 1e6;
  const mstrEV = mstrMarketCap + MSTR_DEBT_PREF_M * 1e6;
  const mstrMnav = mstrBtcNav > 0 ? mstrEV / mstrBtcNav : 0;
  const mstrAmplPct = mstrBtcNav > 0 ? (MSTR_DEBT_PREF_M * 1e6 / mstrBtcNav) * 100 : 0;
  const mstrBps = (params.mstr_btc_holdings / (params.mstr_shares_outstanding * 1.18 * 1e6)) * 1e8;
  const mstrBtcYieldYTD = 5.6;
  const mstrAvgCost = 75577;
  const mstrUnrealizedPct = ((btcPrice / mstrAvgCost) - 1) * 100;

  // ASST calcs
  const asstBtcNav = ASST_DEFAULTS.btc_holdings * btcPrice;
  const asstMarketCap = asstPrice * ASST_DEFAULTS.shares_outstanding_M * 1e6;
  const asstEV = asstMarketCap + ASST_DEFAULTS.total_debt_pref_M * 1e6;
  const asstMnav = asstBtcNav > 0 ? asstEV / asstBtcNav : 0;
  const asstAmplPct = asstBtcNav > 0 ? (ASST_DEFAULTS.total_debt_pref_M * 1e6 / asstBtcNav) * 100 : 0;
  const asstBps = (ASST_DEFAULTS.btc_holdings / (ASST_DEFAULTS.shares_outstanding_M * 1.15 * 1e6)) * 1e8;

  // Chart: BTC reserve vs market cap comparison
  const barData = [
    { metric: "BTC Reserve", MSTR: mstrBtcNav / 1e9, ASST: asstBtcNav / 1e9 },
    { metric: "Market Cap", MSTR: mstrMarketCap / 1e9, ASST: asstMarketCap / 1e9 },
    { metric: "EV", MSTR: mstrEV / 1e9, ASST: asstEV / 1e9 },
  ];

  // Price index chart (rebased to 100)
  const priceHistory = [
    { date: "Q3 '25", MSTR: 100, ASST: 100 },
    { date: "Q4 '25", MSTR: 145, ASST: 138 },
    { date: "Q1 '26", MSTR: 118, ASST: 112 },
    { date: "Apr '26", MSTR: 134, ASST: 128 },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">MSTR vs. ASST — Side-by-Side Comparison</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Strategy (MSTR) vs. Strive Asset Management (ASST) — both Bitcoin treasury equities.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px] gap-1.5"
              onClick={() => setShowDiff(!showDiff)}
            >
              {showDiff ? <ToggleRight className="w-3.5 h-3.5 text-primary" /> : <ToggleLeft className="w-3.5 h-3.5" />}
              {showDiff ? "Differences ON" : "Show Differences"}
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1.5 border-primary/30 text-primary" onClick={onRefresh} disabled={refreshing}>
              <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard title="MSTR Price" value={formatCurrency(mstrPrice, 2)} subtitle={liveData?.mstr_price ? "Live" : "Default"} icon={TrendingUp} accentClass="text-primary" />
        <MetricCard title="ASST Price" value={formatCurrency(asstPrice, 2)} subtitle={liveData?.asst_price ? "Live" : "Default"} icon={Building2} accentClass="text-blue-400" />
        <MetricCard title="MSTR mNAV" value={`${mstrMnav.toFixed(2)}x`} subtitle="EV ÷ BTC Reserve" icon={Shield} accentClass="text-primary" />
        <MetricCard title="ASST mNAV" value={`${asstMnav.toFixed(2)}x`} subtitle="EV ÷ BTC Reserve" icon={Shield} accentClass="text-blue-400" />
      </div>

      {/* Side-by-side comparison table */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Full Comparison</h3>
          </div>
          <div className="flex gap-4 text-xs">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary inline-block" /> MSTR</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> ASST</span>
          </div>
        </div>

        <CompareRow label="" mstrVal="MSTR" asstVal="ASST" mstrColor="text-primary font-semibold" asstColor="text-blue-400 font-semibold" />

        <CompareRow label="Share Price" mstrVal={formatCurrency(mstrPrice, 2)} asstVal={formatCurrency(asstPrice, 2)} />
        <CompareRow label="BTC Holdings" mstrVal={params.mstr_btc_holdings.toLocaleString()} asstVal={ASST_DEFAULTS.btc_holdings.toLocaleString()} highlight={showDiff} />
        <CompareRow label="Avg Cost Basis" mstrVal={formatCurrency(mstrAvgCost)} asstVal="—" />
        <CompareRow label="Unrealized Gain" mstrVal={`+${mstrUnrealizedPct.toFixed(1)}%`} asstVal="—" mstrColor="text-green-400" />
        <CompareRow label="BTC Reserve" mstrVal={formatCurrency(mstrBtcNav)} asstVal={formatCurrency(asstBtcNav)} highlight={showDiff} />
        <CompareRow label="Market Cap" mstrVal={formatCurrency(mstrMarketCap)} asstVal={formatCurrency(asstMarketCap)} highlight={showDiff} />
        <CompareRow label="Enterprise Value" mstrVal={formatCurrency(mstrEV)} asstVal={formatCurrency(asstEV)} />
        <CompareRow label="mNAV Multiple" mstrVal={`${mstrMnav.toFixed(2)}x`} asstVal={`${asstMnav.toFixed(2)}x`} mstrColor="text-amber-400" asstColor="text-amber-300" highlight={showDiff} />
        <CompareRow label="Amplification %" mstrVal={`${mstrAmplPct.toFixed(1)}%`} asstVal={`${asstAmplPct.toFixed(1)}%`} mstrColor="text-purple-400" asstColor="text-purple-300" highlight={showDiff} />
        <CompareRow label="BPS (Sats)" mstrVal={`${Math.round(mstrBps).toLocaleString()}`} asstVal={`${Math.round(asstBps).toLocaleString()}`} mstrColor="text-amber-400" asstColor="text-amber-300" />
        <CompareRow label="BTC Yield (YTD)" mstrVal={`${mstrBtcYieldYTD}%`} asstVal="—" mstrColor="text-green-400" />
        <CompareRow label="Total Debt + Pref" mstrVal={formatCurrency(MSTR_DEBT_PREF_M * 1e6)} asstVal={formatCurrency(ASST_DEFAULTS.total_debt_pref_M * 1e6)} highlight={showDiff} />
        <CompareRow label="Cash Reserve" mstrVal={formatCurrency(MSTR_CASH_M * 1e6)} asstVal="—" />
        <CompareRow label="Shares Outstanding" mstrVal={`${params.mstr_shares_outstanding.toFixed(0)}M`} asstVal={`${ASST_DEFAULTS.shares_outstanding_M}M`} />
        <CompareRow label="Primary Strategy" mstrVal="Digital credit ATM" asstVal="SATA preferred + equity" mstrColor="text-muted-foreground" asstColor="text-muted-foreground" />
      </div>

      {/* Charts — Balance Sheet only (Price Index removed per user request) */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <Bitcoin className="w-3.5 h-3.5 text-amber-400" /> Balance Sheet Comparison ($B)
        </h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={barData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis dataKey="metric" tick={TICK} />
            <YAxis tick={TICK} tickFormatter={v => `$${v}B`} />
            <Tooltip contentStyle={{ background: "hsl(222 47% 10%)", border: "1px solid hsl(217 33% 17%)", borderRadius: 6, fontSize: 11 }}
              formatter={v => [`$${v.toFixed(1)}B`]} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Bar dataKey="MSTR" fill="#22C55E" radius={[3, 3, 0, 0]} />
            <Bar dataKey="ASST" fill="#60A5FA" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="text-[10px] text-muted-foreground/40 text-center">
        MSTR data from strategy.com. ASST data from treasury.strive.com. Educational use only.
      </p>
    </div>
  );
}