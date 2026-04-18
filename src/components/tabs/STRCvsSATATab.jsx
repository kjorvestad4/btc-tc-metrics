import React, { useState } from "react";
import MetricCard from "../dashboard/MetricCard";
import { Layers, Activity, BarChart3, RefreshCw, ToggleLeft, ToggleRight, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatPercent } from "@/lib/calculations";
import { PREFERRED_SHARPE_RATIOS } from "@/lib/correlationData";
import { STRC_PAR_STATS, SATA_PAR_STATS, STRC_ATM_PROGRAM, SATA_ATM_PROGRAM } from "@/lib/correlationData";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell
} from "recharts";

const TICK = { fontSize: 9, fill: "hsl(215 20% 55%)" };
const GRID = "hsl(217 33% 17%)";

function CompareRow({ label, strcVal, sataVal, highlight, strcColor = "text-primary", sataColor = "text-violet-400" }) {
  return (
    <div className={`flex items-start justify-between py-2 border-b border-border/40 gap-2 ${highlight ? "bg-secondary/20 -mx-2 px-2 rounded" : ""}`}>
      <span className="text-xs text-muted-foreground flex-1">{label}</span>
      <span className={`text-xs font-mono font-bold ${strcColor} w-32 text-right shrink-0`}>{strcVal}</span>
      <span className={`text-xs font-mono font-bold ${sataColor} w-32 text-right shrink-0`}>{sataVal}</span>
    </div>
  );
}

export default function STRCvsSATATab({ params, liveData, onRefresh, refreshing }) {
  const [showDiff, setShowDiff] = useState(false);

  const btcPrice = liveData?.btc_price ?? params.btc_price;

  // Live prices
  const strcData = liveData?.strc_data ?? null;
  const strcPrice = liveData?.strc_price ?? strcData?.price ?? 99.21;
  const sataPrice = liveData?.sata_price ?? 99.45;

  // Static from correlationData
  const strcSharpe = PREFERRED_SHARPE_RATIOS.find(p => p.ticker === "STRC");
  const sataSharpe = PREFERRED_SHARPE_RATIOS.find(p => p.ticker === "SATA");

  // Annual div amounts
  const strcAnnualDiv = STRC_ATM_PROGRAM.strc_issued_to_date_M * 1e6 * 0.115; // 11.5% variable
  const sataAnnualDiv = SATA_ATM_PROGRAM.sata_issued_to_date_M * 1e6 * (SATA_ATM_PROGRAM.dividend_rate / 100);

  // Sharpe bar chart
  const sharpeData = [
    { ticker: "STRC", sharpe: strcSharpe?.sharpe ?? 2.41, fill: "#22C55E" },
    { ticker: "SATA", sharpe: sataSharpe?.sharpe ?? 2.30, fill: "#8B5CF6" },
  ];

  // Par trading comparison
  const parData = [
    { metric: "Days ≥ Par", STRC: STRC_PAR_STATS.days_above_par, SATA: SATA_PAR_STATS.days_above_par },
    { metric: "Within 1%", STRC: STRC_PAR_STATS.days_within_1pct, SATA: SATA_PAR_STATS.days_within_1pct },
    { metric: "Below 1%", STRC: STRC_PAR_STATS.days_below_1pct, SATA: SATA_PAR_STATS.days_below_1pct },
  ];

  // Price history (illustrative, near-par trading)
  const priceHistory = [
    { date: "Mar 2", STRC: 100.40, SATA: 100.20 },
    { date: "Mar 9", STRC: 99.80, SATA: 100.10 },
    { date: "Mar 16", STRC: 98.50, SATA: 99.80 },
    { date: "Mar 23", STRC: 99.20, SATA: 99.60 },
    { date: "Mar 30", STRC: 101.10, SATA: 100.80 },
    { date: "Apr 7", STRC: 100.80, SATA: 100.30 },
    { date: "Apr 14", STRC: 92.10, SATA: 99.20 },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">STRC vs. SATA — Side-by-Side Comparison</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Strategy's STRC preferred vs. Strive's SATA preferred — both near-par, high-yield instruments.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1.5" onClick={() => setShowDiff(!showDiff)}>
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
        <MetricCard title="STRC Price" value={formatCurrency(strcPrice, 2)} subtitle={liveData?.strc_price ? "Live" : "Static default"} icon={Layers} accentClass="text-primary" />
        <MetricCard title="SATA Price" value={formatCurrency(sataPrice, 2)} subtitle={liveData?.sata_price ? "Live" : "Default"} icon={Layers} accentClass="text-violet-400" />
        <MetricCard title="STRC Sharpe (30D)" value={strcSharpe?.sharpe?.toFixed(2) ?? "2.41"} subtitle="risk-adj. yield" icon={BarChart3} accentClass="text-primary" />
        <MetricCard title="SATA Sharpe (30D)" value={sataSharpe?.sharpe?.toFixed(2) ?? "2.30"} subtitle="risk-adj. yield" icon={BarChart3} accentClass="text-violet-400" />
      </div>

      {/* Side-by-side comparison table */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Instrument Comparison</h3>
          </div>
          <div className="flex gap-4 text-xs">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary inline-block" /> STRC</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-violet-400 inline-block" /> SATA</span>
          </div>
        </div>

        <CompareRow label="" strcVal="STRC" sataVal="SATA" strcColor="text-primary font-semibold" sataColor="text-violet-400 font-semibold" />
        <CompareRow label="Issuer" strcVal="Strategy (MSTR)" sataVal="Strive (ASST)" strcColor="text-muted-foreground" sataColor="text-muted-foreground" />
        <CompareRow label="Current Price" strcVal={`$${strcPrice.toFixed(2)}`} sataVal={`$${sataPrice.toFixed(2)}`} highlight={showDiff} />
        <CompareRow label="Par Value" strcVal="$100" sataVal="$100" />
        <CompareRow label="Dividend Rate" strcVal="11.50% variable" sataVal="13.00% variable" strcColor="text-green-400" sataColor="text-green-500" highlight={showDiff} />
        <CompareRow label="Payment Frequency" strcVal="Monthly" sataVal="Monthly" />
        <CompareRow label="ATM Program Size" strcVal="$21B total" sataVal="$500M total" highlight={showDiff} />
        <CompareRow label="Issued to Date" strcVal={`$${STRC_ATM_PROGRAM.strc_issued_to_date_M.toLocaleString()}M`} sataVal={`$${SATA_ATM_PROGRAM.sata_issued_to_date_M.toFixed(0)}M`} highlight={showDiff} />
        <CompareRow label="Remaining Capacity" strcVal={`$${STRC_ATM_PROGRAM.strc_remaining_M.toLocaleString()}M`} sataVal={`$${SATA_ATM_PROGRAM.sata_remaining_M.toFixed(0)}M`} />
        <CompareRow label="Avg Capture Rate" strcVal={`${STRC_ATM_PROGRAM.avg_capture_pct}%`} sataVal={`${SATA_ATM_PROGRAM.avg_capture_pct}%`} />
        <CompareRow label="Days ≥ Par" strcVal={`${STRC_PAR_STATS.days_above_par}/${STRC_PAR_STATS.total_trading_days_observed}`} sataVal={`${SATA_PAR_STATS.days_above_par}/${SATA_PAR_STATS.total_trading_days_observed}`} highlight={showDiff} />
        <CompareRow label="Avg Ex-Div Drop" strcVal={`-${STRC_PAR_STATS.avg_exdiv_drop_pct}%`} sataVal={`-${SATA_PAR_STATS.avg_exdiv_drop_pct}%`} strcColor="text-destructive" sataColor="text-destructive" highlight={showDiff} />
        <CompareRow label="Avg Recovery Days" strcVal={`${STRC_PAR_STATS.avg_recovery_days}d`} sataVal={`${SATA_PAR_STATS.avg_recovery_days}d`} highlight={showDiff} />
        <CompareRow label="30D Vol" strcVal={`${strcSharpe?.vol_30d ?? 3.0}%`} sataVal={`${sataSharpe?.vol_30d ?? 3.8}%`} mstrColor="text-muted-foreground" asstColor="text-muted-foreground" strcColor="text-muted-foreground" sataColor="text-muted-foreground" />
        <CompareRow label="Sharpe Ratio (30D)" strcVal={strcSharpe?.sharpe?.toFixed(2) ?? "2.41"} sataVal={sataSharpe?.sharpe?.toFixed(2) ?? "2.30"} strcColor="text-green-400" sataColor="text-green-400" />
        <CompareRow label="Effective Yield" strcVal={`${strcSharpe?.current_yield?.toFixed(2) ?? 11.59}%`} sataVal={`${sataSharpe?.current_yield?.toFixed(2) ?? 13.07}%`} strcColor="text-green-400" sataColor="text-green-500" />
        <CompareRow label="Annual Div Liability" strcVal={formatCurrency(strcAnnualDiv)} sataVal={formatCurrency(sataAnnualDiv)} highlight={showDiff} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-primary" /> Price History (Near Par)
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={priceHistory} margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
              <XAxis dataKey="date" tick={TICK} />
              <YAxis domain={[88, 104]} tick={TICK} tickFormatter={v => `$${v}`} />
              <Tooltip contentStyle={{ background: "hsl(222 47% 10%)", border: "1px solid hsl(217 33% 17%)", borderRadius: 6, fontSize: 11 }}
                formatter={v => [`$${v.toFixed(2)}`]} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Line type="monotone" dataKey="STRC" stroke="#22C55E" strokeWidth={2} dot={{ r: 2 }} />
              <Line type="monotone" dataKey="SATA" stroke="#8B5CF6" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-[9px] text-muted-foreground/50 mt-2">⚠ Illustrative price series. Use live data for trading decisions.</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <BarChart3 className="w-3.5 h-3.5 text-cyan-400" /> Par Trading Days & Sharpe
          </h3>
          <ResponsiveContainer width="100%" height={90}>
            <BarChart data={parData} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 56 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
              <XAxis type="number" tick={TICK} />
              <YAxis dataKey="metric" type="category" tick={{ fontSize: 9, fill: "hsl(215 20% 55%)" }} width={56} />
              <Tooltip contentStyle={{ background: "hsl(222 47% 10%)", border: "1px solid hsl(217 33% 17%)", borderRadius: 6, fontSize: 11 }} />
              <Bar dataKey="STRC" fill="#22C55E" radius={[0, 3, 3, 0]} />
              <Bar dataKey="SATA" fill="#8B5CF6" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {sharpeData.map(d => (
              <div key={d.ticker} className="p-2 rounded-lg bg-secondary/50 border border-border text-center">
                <p className="text-[10px] text-muted-foreground">{d.ticker} Sharpe (30D)</p>
                <p className="text-xl font-bold font-mono" style={{ color: d.fill }}>{d.sharpe.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground/40 text-center">
        STRC data from strategy.com. SATA data from treasury.strive.com. Sharpe = (Eff. Yield − 4.35%) ÷ 30D Vol. Educational only.
      </p>
    </div>
  );
}