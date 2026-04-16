import React, { useState, useMemo } from "react";
import MetricCard from "../dashboard/MetricCard";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import {
  Layers, DollarSign, Percent, Activity, RefreshCw, Wifi, TrendingUp, Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatPercent } from "@/lib/calculations";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, ReferenceLine, Legend
} from "recharts";
import { ASST_DEFAULTS } from "./ASSTModelTab";

// SATA (Strive Variable Rate Series A Perpetual Preferred) — April 2026 defaults
const SATA_DEFAULTS = {
  price: 99.45,
  par_value: 100,
  dividend_rate: 13.00,         // ~13% variable
  notional_M: 310,
  shares_outstanding: 3_100_000,
  payment_frequency: "monthly",
  target_range_low: 99.0,
  target_range_high: 101.0,
  issued_date: "2025-Q4",
  is_variable_rate: true,
};

// Historical SATA par trading stats
const SATA_PAR_STATS = {
  total_trading_days: 90,
  days_at_par: 54,
  days_within_1pct: 28,
  days_below_1pct: 8,
  avg_exdiv_drop_pct: 1.08,
  avg_recovery_days: 2.4,
  recent_recovery_days: 1.6,
  min_recovery_days: 0,
  max_recovery_days: 6,
};

// SATA recent monthly distribution history (last 6 months)
const SATA_DISTRIBUTION_HISTORY = [
  { month: "Apr 2026", rate: 13.00, monthly_per_share: 1.0833, note: "Variable rate reset" },
  { month: "Mar 2026", rate: 13.00, monthly_per_share: 1.0833 },
  { month: "Feb 2026", rate: 13.00, monthly_per_share: 1.0833 },
  { month: "Jan 2026", rate: 12.75, monthly_per_share: 1.0625, note: "Rate increased" },
  { month: "Dec 2025", rate: 12.75, monthly_per_share: 1.0625 },
  { month: "Nov 2025", rate: 12.50, monthly_per_share: 1.0417, note: "Initial rate" },
];

// Price history for chart
const SATA_PRICE_HISTORY = [
  { date: "Nov '25", price: 97.80, par: 100 },
  { date: "Dec '25", price: 98.50, par: 100 },
  { date: "Jan '26", price: 99.20, par: 100 },
  { date: "Feb '26", price: 99.60, par: 100 },
  { date: "Mar '26", price: 99.10, par: 100 },
  { date: "Apr '26", price: 99.45, par: 100 },
];

// SATA issuance → ASST BTC accumulation model
function generateSATAFlywheelModel(btcPrice, notionalM, dividendRate) {
  const points = [];
  let cumulativeSata = notionalM;
  let cumulativeBtc = ASST_DEFAULTS.btc_holdings;

  for (let m = 0; m <= 24; m++) {
    const addedSata = m > 0 && m % 3 === 0 ? 50 : 0; // ~$50M per quarter
    cumulativeSata += addedSata;
    const btcFromSata = addedSata > 0 ? (addedSata * 1e6) / (btcPrice * Math.pow(1.033, m / 12)) : 0;
    cumulativeBtc += btcFromSata;
    const annualDiv = cumulativeSata * 1e6 * (dividendRate / 100);
    const monthlyDiv = annualDiv / 12;
    const currentBtcNav = cumulativeBtc * btcPrice * Math.pow(1.033, m / 12);
    const divToBtcRatio = (annualDiv / currentBtcNav) * 100;

    points.push({
      month: m,
      label: m === 0 ? "Now" : `M${m}`,
      sata_notional_M: cumulativeSata,
      btc_holdings: Math.round(cumulativeBtc),
      monthly_div_liability: parseFloat((monthlyDiv / 1e6).toFixed(2)),
      annual_div_liability_M: parseFloat((annualDiv / 1e6).toFixed(1)),
      btc_nav_B: parseFloat((currentBtcNav / 1e9).toFixed(3)),
      div_to_btc_ratio_pct: parseFloat(divToBtcRatio.toFixed(2)),
    });
  }
  return points;
}

function StatRow({ label, value, accent = "text-foreground", sub }) {
  return (
    <div className="flex items-start justify-between py-1.5 border-b border-border/40 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <div className="text-right">
        <span className={`font-mono font-bold ${accent}`}>{value}</span>
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

export default function SATAModelTab({ params, liveData, onRefresh, refreshing }) {
  const [dividendRate, setDividendRate] = useState(SATA_DEFAULTS.dividend_rate);
  const [notionalM, setNotionalM] = useState(SATA_DEFAULTS.notional_M);

  const sataPrice = liveData?.sata_price ?? SATA_DEFAULTS.price;
  const isLive = !!liveData?.sata_price;

  const premiumDiscount = ((sataPrice / SATA_DEFAULTS.par_value) - 1) * 100;
  const currentYield = (dividendRate * SATA_DEFAULTS.par_value / sataPrice) / 100 * 100;
  const annualDivLiability = notionalM * 1e6 * (dividendRate / 100);
  const monthlyDivPerShare = (SATA_DEFAULTS.par_value * dividendRate / 100) / 12;
  const btcNav = ASST_DEFAULTS.btc_holdings * params.btc_price;
  const divToBtcRatio = (annualDivLiability / btcNav) * 100;

  const flywheelData = useMemo(
    () => generateSATAFlywheelModel(params.btc_price, notionalM, dividendRate),
    [params.btc_price, notionalM, dividendRate]
  );

  const parBarData = [
    { label: "At/Above Par", days: SATA_PAR_STATS.days_at_par, color: "#22C55E" },
    { label: "Within 1%", days: SATA_PAR_STATS.days_within_1pct, color: "#F59E0B" },
    { label: "Below 1%", days: SATA_PAR_STATS.days_below_1pct, color: "#EF4444" },
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
              <h3 className="text-sm font-semibold text-foreground">SATA — Strive Variable Rate Series A Perpetual Preferred</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                ~13% variable rate monthly preferred. Funds ASST BTC accumulation. Target trading range $99–$101 par.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px] gap-1.5 border-purple-400/30 text-purple-400 hover:bg-purple-400/10"
            onClick={onRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Fetching…" : "Refresh Live"}
          </Button>
        </div>

        <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium mt-3 ${
          isLive
            ? "bg-purple-400/15 text-purple-400 border border-purple-400/25"
            : "bg-secondary text-muted-foreground border border-border"
        }`}>
          <Wifi className="w-2.5 h-2.5" />
          {isLive ? "Live SATA price loaded" : "Static defaults — Polygon key required for live SATA"}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          title="SATA Price"
          value={formatCurrency(sataPrice, 2)}
          subtitle={premiumDiscount >= 0 ? `+${premiumDiscount.toFixed(2)}% to par` : `${premiumDiscount.toFixed(2)}% to par`}
          icon={DollarSign}
          accentClass="text-purple-400"
        />
        <MetricCard
          title="Dividend Rate"
          value={`${dividendRate.toFixed(2)}%`}
          subtitle={`$${monthlyDivPerShare.toFixed(4)}/share/mo`}
          icon={Percent}
          accentClass="text-green-400"
        />
        <MetricCard
          title="Notional"
          value={formatCurrency(notionalM * 1e6)}
          subtitle={`${(notionalM / 1000).toFixed(2)}B total`}
          icon={Layers}
          accentClass="text-amber-400"
        />
        <MetricCard
          title="Current Yield"
          value={formatPercent(currentYield)}
          subtitle="at current price"
          icon={Activity}
          accentClass="text-cyan-400"
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* SATA snapshot */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Layers className="w-4 h-4 text-purple-400" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">SATA Instrument Details</h4>
          </div>
          <StatRow label="Par Value" value="$100.00" accent="text-foreground" />
          <StatRow label="Current Price" value={formatCurrency(sataPrice, 2)} accent={Math.abs(premiumDiscount) < 1 ? "text-primary" : "text-amber-400"} sub={premiumDiscount >= 0 ? `+${premiumDiscount.toFixed(2)}% vs par` : `${premiumDiscount.toFixed(2)}% vs par`} />
          <StatRow label="Target Range" value="$99.00 – $101.00" accent="text-primary" />
          <StatRow label="Dividend Rate" value={`${dividendRate.toFixed(2)}% p.a.`} accent="text-green-400" sub="Variable — set monthly" />
          <StatRow label="Payment Frequency" value="Monthly" accent="text-foreground" />
          <StatRow label="Rate Type" value="Variable (Reset Monthly)" accent="text-purple-400" />
          <StatRow label="Shares Outstanding" value={SATA_DEFAULTS.shares_outstanding.toLocaleString()} accent="text-foreground" />
          <StatRow label="Total Notional" value={formatCurrency(notionalM * 1e6)} accent="text-amber-400" />
          <StatRow label="Ann. Div. Liability" value={formatCurrency(annualDivLiability)} accent="text-destructive" />
          <StatRow label="Div / ASST BTC Reserve" value={formatPercent(divToBtcRatio, 2)} accent={divToBtcRatio < 2.5 ? "text-primary" : "text-destructive"} sub={divToBtcRatio < 2.5 ? "Flywheel healthy" : "Monitor closely"} />
        </div>

        {/* Monthly distribution history */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-green-400" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">Monthly Distribution History</h4>
          </div>
          <table className="w-full text-xs mb-4">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-1.5 pr-3">Month</th>
                <th className="text-right py-1.5 pr-3">Rate</th>
                <th className="text-right py-1.5 pr-3">$/Share</th>
                <th className="text-right py-1.5">Ann. Rate</th>
              </tr>
            </thead>
            <tbody>
              {SATA_DISTRIBUTION_HISTORY.map((d, i) => (
                <tr key={d.month} className={`border-b border-border/30 ${i === 0 ? "bg-primary/5" : ""}`}>
                  <td className="py-1.5 pr-3 text-foreground">
                    {d.month}
                    {i === 0 && <span className="ml-1 text-[9px] bg-primary/20 text-primary px-1 rounded">LATEST</span>}
                    {d.note && <span className="ml-1 text-[9px] text-amber-400">*</span>}
                  </td>
                  <td className="py-1.5 pr-3 text-right font-mono text-purple-400">{d.rate.toFixed(2)}%</td>
                  <td className="py-1.5 pr-3 text-right font-mono text-green-400">${d.monthly_per_share.toFixed(4)}</td>
                  <td className="py-1.5 text-right font-mono text-muted-foreground">${(d.monthly_per_share * 12).toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Par trading stats */}
          <div className="flex items-center gap-2 mb-2 mt-4">
            <TrendingUp className="w-3.5 h-3.5 text-green-400" />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground">Par Trading Statistics</p>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-2">
            {parBarData.map((b) => (
              <div key={b.label} className="p-2 bg-secondary/50 rounded border border-border text-center">
                <p className="text-[9px] text-muted-foreground">{b.label}</p>
                <p className="text-sm font-bold font-mono" style={{ color: b.color }}>{b.days}</p>
                <p className="text-[9px] text-muted-foreground">
                  {((b.days / SATA_PAR_STATS.total_trading_days) * 100).toFixed(0)}%
                </p>
              </div>
            ))}
          </div>
          {[
            { label: "Avg ex-div drop", value: `-${SATA_PAR_STATS.avg_exdiv_drop_pct}%`, color: "text-destructive" },
            { label: "Avg recovery to par", value: `${SATA_PAR_STATS.avg_recovery_days} days`, color: "text-amber-400" },
            { label: "Recent recovery (4wk)", value: `${SATA_PAR_STATS.recent_recovery_days} days`, color: "text-primary" },
          ].map((item) => (
            <div key={item.label} className="flex justify-between text-[11px] py-0.5">
              <span className="text-muted-foreground">{item.label}</span>
              <span className={`font-mono font-semibold ${item.color}`}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* SATA price chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs font-semibold text-foreground mb-3">SATA Price vs $100 Par (Historical)</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={SATA_PRICE_HISTORY} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(215 20% 55%)" }} />
              <YAxis domain={[96, 102]} tick={{ fontSize: 9, fill: "hsl(215 20% 55%)" }} tickFormatter={(v) => `$${v}`} />
              <ReferenceLine y={100} stroke="#22C55E" strokeDasharray="4 4" label={{ value: "Par $100", position: "right", fontSize: 9, fill: "#22C55E" }} />
              <ReferenceLine y={99} stroke="hsl(217 33% 25%)" strokeDasharray="2 2" />
              <ReferenceLine y={101} stroke="hsl(217 33% 25%)" strokeDasharray="2 2" />
              <Tooltip
                contentStyle={{ background: "hsl(222 47% 10%)", border: "1px solid hsl(217 33% 17%)", borderRadius: 8, fontSize: 11 }}
                formatter={(v) => [`$${Number(v).toFixed(2)}`, "SATA Price"]}
              />
              <Line type="monotone" dataKey="price" name="SATA Price" stroke="#A78BFA" strokeWidth={2} dot={{ r: 3, fill: "#A78BFA" }} />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-muted-foreground mt-1">Green dashed = par $100. Grey bands = $99–$101 target range.</p>
        </div>

        {/* Flywheel simulator */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-purple-400" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">SATA → BTC Flywheel Simulator</h4>
          </div>
          <div className="space-y-3 mb-3">
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <Label className="text-[10px] text-muted-foreground">SATA Dividend Rate (%)</Label>
                <span className="text-[10px] font-mono text-purple-400">{dividendRate.toFixed(2)}%</span>
              </div>
              <Slider value={[dividendRate]} onValueChange={([v]) => setDividendRate(v)} min={8} max={18} step={0.25} />
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <Label className="text-[10px] text-muted-foreground">SATA Notional ($M)</Label>
                <span className="text-[10px] font-mono text-amber-400">${notionalM}M</span>
              </div>
              <Slider value={[notionalM]} onValueChange={([v]) => setNotionalM(v)} min={100} max={2000} step={50} />
            </div>
          </div>

          {/* Outputs */}
          <div className="p-3 bg-secondary/40 rounded-lg border border-border space-y-1.5">
            <p className="text-[10px] font-semibold text-foreground mb-2">Projected Outputs</p>
            {[
              { label: "Monthly Div/Share", value: `$${monthlyDivPerShare.toFixed(4)}` },
              { label: "Annual Div Liability", value: formatCurrency(annualDivLiability) },
              { label: "Div / BTC Reserve", value: formatPercent(divToBtcRatio, 2), color: divToBtcRatio < 2.5 ? "text-primary" : "text-destructive" },
              { label: "24M Projected BTC", value: flywheelData[flywheelData.length - 1]?.btc_holdings?.toLocaleString() ?? "—" },
              { label: "24M BTC NAV", value: formatCurrency((flywheelData[flywheelData.length - 1]?.btc_nav_B ?? 0) * 1e9) },
            ].map((item) => (
              <div key={item.label} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{item.label}</span>
                <span className={`font-mono font-bold ${item.color ?? "text-foreground"}`}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Flywheel charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs font-semibold text-foreground mb-3">ASST BTC Holdings Growth (SATA-Funded)</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={flywheelData.filter((_, i) => i % 3 === 0 || i === flywheelData.length - 1)} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
              <XAxis dataKey="label" tick={{ fontSize: 8, fill: "hsl(215 20% 55%)" }} />
              <YAxis tick={{ fontSize: 9, fill: "hsl(215 20% 55%)" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
              <Tooltip
                contentStyle={{ background: "hsl(222 47% 10%)", border: "1px solid hsl(217 33% 17%)", borderRadius: 8, fontSize: 11 }}
                formatter={(v) => [`${Number(v).toLocaleString()} BTC`, "ASST Holdings"]}
              />
              <Line type="monotone" dataKey="btc_holdings" name="BTC Holdings" stroke="#60A5FA" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs font-semibold text-foreground mb-3">Monthly Div Liability vs BTC NAV Growth</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={flywheelData.filter((_, i) => i % 3 === 0 || i === flywheelData.length - 1)} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
              <XAxis dataKey="label" tick={{ fontSize: 8, fill: "hsl(215 20% 55%)" }} />
              <YAxis yAxisId="left" tick={{ fontSize: 9, fill: "hsl(215 20% 55%)" }} tickFormatter={(v) => `$${v}M`} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9, fill: "hsl(215 20% 55%)" }} tickFormatter={(v) => `$${v}B`} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: "hsl(222 47% 10%)", border: "1px solid hsl(217 33% 17%)", borderRadius: 8, fontSize: 11 }}
              />
              <Line yAxisId="left" type="monotone" dataKey="monthly_div_liability" name="Monthly Div ($M)" stroke="#EF4444" strokeWidth={2} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="btc_nav_B" name="BTC NAV ($B)" stroke="#22C55E" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-muted-foreground mt-1">BTC NAV growing faster than div liability = flywheel intact.</p>
        </div>
      </div>

      {/* Strategy/STRC ecosystem context */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-amber-400" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">SATA ↔ Strategy Ecosystem Interaction</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px] text-muted-foreground">
          <ul className="space-y-1.5">
            <li>• <span className="text-purple-400 font-medium">SATA vs STRC:</span> Both are perpetual preferreds funding BTC accumulation via dividend carry. STRC is Strategy's (MSTR) program; SATA is Strive's (ASST) parallel.</li>
            <li>• <span className="text-purple-400 font-medium">Rate comparison:</span> SATA ~13% variable vs STRC ~10% fixed — SATA offers higher yield but variable rate adds uncertainty.</li>
            <li>• <span className="text-primary font-medium">BTC CAGR target:</span> Both programs profitable if BTC CAGR > dividend rate. At 40% BTC CAGR, both SATA and STRC are highly accretive.</li>
          </ul>
          <ul className="space-y-1.5">
            <li>• <span className="text-amber-400 font-medium">Par mechanics:</span> Like STRC, SATA should trade near par due to fixed liquidation preference. Monthly payments vs STRC's quarterly create smoother ex-div drops.</li>
            <li>• <span className="text-amber-400 font-medium">Issuance capacity:</span> ASST's SATA program has capacity for significant expansion. Each $100M raised at par = ~{Math.round(100e6 / (params.btc_price || 74300)).toLocaleString()} BTC at current prices.</li>
            <li>• <span className="text-destructive font-medium">Risk:</span> Variable rate means div liability could increase in rising rate environments. No hard floor on minimum rate.</li>
          </ul>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground/40 text-center">
        SATA model based on April 2026 public data. Variable rate distributions are subject to change. Not financial advice.
      </p>
    </div>
  );
}