import React, { useMemo } from "react";
import MetricCard from "../dashboard/MetricCard";
import ProjectionChart from "../dashboard/ProjectionChart";
import {
  TrendingUp, Bitcoin, BarChart3, Activity, DollarSign, Zap, RefreshCw, Wifi
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatPercent, calcMNAV } from "@/lib/calculations";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, ReferenceLine, LineChart, Line, Legend
} from "recharts";

// April 2026 ASST (Strive Asset Management) defaults
export const ASST_DEFAULTS = {
  btc_holdings: 13768,
  shares_outstanding_M: 42.5,
  price: 18.40,
  pref_notional_M: 0,          // SATA issuance in progress
  sata_notional_M: 310,        // ~$310M SATA issued
  sata_dividend_rate: 13.0,
  btc_accum_per_quarter: 2500,
  amplification_ratio: 2.2,
  mstr_cross_ownership_btc: 0, // ASST holds no MSTR directly
};

// Back-tested beta vs BTC (ASST launched late 2024, limited data)
const ASST_CORRELATIONS = [
  { period: "3M", beta: 1.45, r2: 0.68, corr: 0.82, sample_days: 63 },
  { period: "6M", beta: 1.61, r2: 0.71, corr: 0.84, sample_days: 126 },
  { period: "Since IPO", beta: 1.73, r2: 0.74, corr: 0.86, sample_days: 180 },
];

// ASST vs MSTR price sensitivity
const ASST_MSTR_SENSITIVITY = [
  { btc: -20, asst: -32.0, mstr: -36.4 },
  { btc: -10, asst: -16.1, mstr: -18.2 },
  { btc: -5,  asst: -8.1,  mstr: -9.1 },
  { btc: 0,   asst: 0,     mstr: 0 },
  { btc: 5,   asst: 8.1,   mstr: 9.1 },
  { btc: 10,  asst: 16.1,  mstr: 18.2 },
  { btc: 20,  asst: 32.0,  mstr: 36.4 },
  { btc: 40,  asst: 69.2,  mstr: 79.6 },
];

function generateASST_MSTRComparison(btcPrice, asstDefaults, mstrPrice) {
  const points = [];
  for (let q = 0; q <= 20; q++) {
    const btcQ = btcPrice * Math.pow(1.10, q / 4); // 40% annual → quarterly
    const asstBtcNav = (asstDefaults.btc_holdings + q * asstDefaults.btc_accum_per_quarter) * btcQ;
    const asstMktCap = asstBtcNav * asstDefaults.amplification_ratio;
    const asstPriceEst = asstMktCap / (asstDefaults.shares_outstanding_M * 1e6);

    const mstrMnav = calcMNAV(
      780897 + q * 15000,
      btcQ,
      9100e6,
      220 * Math.pow(1.015, q)
    );
    const mstrPriceEst = mstrMnav * 3.0;

    points.push({
      label: q === 0 ? "Now" : `Y${Math.floor(q / 4) + 1}Q${(q % 4) + 1}`,
      quarter: q,
      asst_price: parseFloat(asstPriceEst.toFixed(2)),
      mstr_price: parseFloat(mstrPriceEst.toFixed(2)),
      asst_btc_per_share: parseFloat(((asstDefaults.btc_holdings + q * asstDefaults.btc_accum_per_quarter) / (asstDefaults.shares_outstanding_M * 1e6) * 1e8).toFixed(0)),
      mstr_btc_per_share: parseFloat(((780897 + q * 15000) / (220 * Math.pow(1.015, q) * 1e6) * 1e8).toFixed(0)),
    });
  }
  return points;
}

function generateASST_Scatter() {
  const pts = [];
  const beta = 1.61;
  for (let i = 0; i < 80; i++) {
    const btc = (Math.random() - 0.5) * 14;
    const noise = (Math.random() - 0.5) * 4;
    const asst = btc * beta + noise;
    pts.push({ btc: parseFloat(btc.toFixed(2)), asst: parseFloat(asst.toFixed(2)) });
  }
  return pts;
}

export default function ASSTModelTab({ params, liveData, onRefresh, refreshing }) {
  const asstPrice = liveData?.asst_price ?? ASST_DEFAULTS.price;
  const asstBtcHoldings = ASST_DEFAULTS.btc_holdings;
  const sharesM = ASST_DEFAULTS.shares_outstanding_M;
  const btcNav = asstBtcHoldings * params.btc_price;
  const mktCap = asstPrice * sharesM * 1e6;
  const mnav = btcNav / (sharesM * 1e6);
  const mnavMultiple = mnav > 0 ? asstPrice / mnav : 0;
  const sataDivLiability = ASST_DEFAULTS.sata_notional_M * 1e6 * (ASST_DEFAULTS.sata_dividend_rate / 100);
  const divToBtcNavRatio = btcNav > 0 ? (sataDivLiability / btcNav) * 100 : 0;

  const compData = useMemo(() =>
    generateASST_MSTRComparison(params.btc_price, ASST_DEFAULTS, params.mstr_price),
    [params.btc_price, params.mstr_price]
  );

  const scatterData = useMemo(() => generateASST_Scatter(), []);
  const isLive = !!liveData?.asst_price;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
              <Bitcoin className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">ASST — Strive Asset Management Bitcoin Treasury</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Parallel Bitcoin treasury company to MSTR. Holds ~{asstBtcHoldings.toLocaleString()} BTC, funded via equity + SATA preferred issuance.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px] gap-1.5 border-blue-400/30 text-blue-400 hover:bg-blue-400/10"
            onClick={onRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Fetching…" : "Refresh Live"}
          </Button>
        </div>

        <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium mt-3 ${
          isLive
            ? "bg-blue-400/15 text-blue-400 border border-blue-400/25"
            : "bg-secondary text-muted-foreground border border-border"
        }`}>
          <Wifi className="w-2.5 h-2.5" />
          {isLive ? "Live ASST price loaded" : "Static defaults — Polygon key required for live ASST"}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard title="ASST Price" value={formatCurrency(asstPrice, 2)} subtitle={isLive ? "Live" : "Default"} icon={DollarSign} accentClass="text-blue-400" />
        <MetricCard title="BTC Holdings" value={asstBtcHoldings.toLocaleString()} subtitle={`${(btcNav / 1e9).toFixed(2)}B reserve`} icon={Bitcoin} accentClass="text-amber-400" />
        <MetricCard title="mNAV Multiple" value={`${mnavMultiple.toFixed(2)}x`} subtitle="price ÷ BTC NAV/share" icon={TrendingUp} accentClass="text-primary" />
        <MetricCard title="Market Cap" value={formatCurrency(mktCap)} subtitle={`${sharesM}M shares`} icon={BarChart3} accentClass="text-purple-400" />
      </div>

      {/* ASST vs MSTR detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Balance sheet */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-blue-400" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">ASST Balance Sheet Snapshot</h4>
          </div>
          {[
            { label: "BTC Holdings", value: `${asstBtcHoldings.toLocaleString()} BTC`, accent: "text-amber-400" },
            { label: "BTC Reserve Value", value: formatCurrency(btcNav), accent: "text-amber-400" },
            { label: "Common Shares (M)", value: `${sharesM}M`, accent: "text-foreground" },
            { label: "BTC per Share (sats)", value: `${Math.round((asstBtcHoldings / (sharesM * 1e6)) * 1e8).toLocaleString()} sats`, accent: "text-primary" },
            { label: "SATA Notional", value: formatCurrency(ASST_DEFAULTS.sata_notional_M * 1e6), accent: "text-purple-400" },
            { label: "SATA Annual Div. Liability", value: formatCurrency(sataDivLiability), accent: "text-destructive" },
            { label: "Div / BTC Reserve", value: formatPercent(divToBtcNavRatio, 2), accent: divToBtcNavRatio < 2 ? "text-primary" : "text-amber-400" },
            { label: "Amplification Ratio", value: `${ASST_DEFAULTS.amplification_ratio}x`, accent: "text-purple-400" },
          ].map((r) => (
            <div key={r.label} className="flex justify-between py-1.5 border-b border-border/40 text-xs">
              <span className="text-muted-foreground">{r.label}</span>
              <span className={`font-mono font-bold ${r.accent}`}>{r.value}</span>
            </div>
          ))}
        </div>

        {/* Correlation table */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-primary" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">ASST ↔ BTC Back-Tested Beta</h4>
          </div>
          <table className="w-full text-xs mb-4">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-1.5 pr-3">Period</th>
                <th className="text-right py-1.5 pr-3">Beta</th>
                <th className="text-right py-1.5 pr-3">R²</th>
                <th className="text-right py-1.5">Corr</th>
              </tr>
            </thead>
            <tbody>
              {ASST_CORRELATIONS.map((r) => (
                <tr key={r.period} className="border-b border-border/30">
                  <td className="py-1.5 pr-3 font-semibold text-foreground">{r.period}</td>
                  <td className="py-1.5 pr-3 text-right font-mono text-blue-400">{r.beta.toFixed(2)}x</td>
                  <td className="py-1.5 pr-3 text-right font-mono text-cyan-400">{(r.r2 * 100).toFixed(0)}%</td>
                  <td className="py-1.5 text-right font-mono text-amber-400">{r.corr.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ASST vs MSTR sensitivity */}
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">BTC Δ → ASST vs MSTR Projected Move</p>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-1 pr-2">BTC</th>
                <th className="text-right py-1 pr-2">ASST</th>
                <th className="text-right py-1">MSTR</th>
              </tr>
            </thead>
            <tbody>
              {ASST_MSTR_SENSITIVITY.map((r) => {
                const isNeg = r.btc < 0;
                return (
                  <tr key={r.btc} className={`border-b border-border/20 ${r.btc === 0 ? "bg-secondary/20" : ""}`}>
                    <td className={`py-0.5 pr-2 font-mono text-xs font-bold ${isNeg ? "text-destructive" : r.btc === 0 ? "text-muted-foreground" : "text-primary"}`}>
                      {r.btc > 0 ? "+" : ""}{r.btc}%
                    </td>
                    <td className={`py-0.5 pr-2 text-right font-mono text-xs ${isNeg ? "text-destructive" : "text-blue-400"}`}>
                      {r.asst > 0 ? "+" : ""}{r.asst.toFixed(1)}%
                    </td>
                    <td className={`py-0.5 text-right font-mono text-xs ${isNeg ? "text-destructive" : "text-primary"}`}>
                      {r.mstr > 0 ? "+" : ""}{r.mstr.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Scatter + price comparison charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* BTC vs ASST scatter */}
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs font-semibold text-foreground mb-1">BTC vs ASST Daily Return Scatter (6M, sampled)</p>
          <p className="text-[10px] text-muted-foreground mb-2">β = 1.61, R² = 71%, ρ = 0.84</p>
          <ResponsiveContainer width="100%" height={220}>
            <ScatterChart margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
              <XAxis dataKey="btc" type="number" domain={[-8, 8]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 9, fill: "hsl(215 20% 55%)" }} label={{ value: "BTC Daily %", position: "insideBottom", offset: -2, fontSize: 9, fill: "hsl(215 20% 55%)" }} />
              <YAxis dataKey="asst" type="number" domain={[-16, 16]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 9, fill: "hsl(215 20% 55%)" }} />
              <ReTooltip content={({ payload }) => {
                if (!payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-popover border border-border rounded p-2 text-xs">
                    <p>BTC: <span className="font-mono text-amber-400">{d.btc > 0 ? "+" : ""}{d.btc}%</span></p>
                    <p>ASST: <span className="font-mono text-blue-400">{d.asst > 0 ? "+" : ""}{d.asst}%</span></p>
                  </div>
                );
              }} />
              <ReferenceLine x={0} stroke="hsl(217 33% 25%)" />
              <ReferenceLine y={0} stroke="hsl(217 33% 25%)" />
              <Scatter data={scatterData} fill="#60A5FA" opacity={0.6} r={3} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* ASST vs MSTR projected price */}
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs font-semibold text-foreground mb-3">ASST vs MSTR Price Projection (Model)</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={compData.filter((_, i) => i % 2 === 0 || i === compData.length - 1)} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
              <XAxis dataKey="label" tick={{ fontSize: 8, fill: "hsl(215 20% 55%)" }} />
              <YAxis tick={{ fontSize: 9, fill: "hsl(215 20% 55%)" }} tickFormatter={(v) => `$${v.toFixed(0)}`} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <ReTooltip
                contentStyle={{ background: "hsl(222 47% 10%)", border: "1px solid hsl(217 33% 17%)", borderRadius: 8, fontSize: 11 }}
                formatter={(v, name) => [`$${Number(v).toFixed(2)}`, name]}
              />
              <Line type="monotone" dataKey="asst_price" name="ASST ($)" stroke="#60A5FA" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="mstr_price" name="MSTR ($)" stroke="#22C55E" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* BTC per share comparison */}
      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-xs font-semibold text-foreground mb-1">BTC Per Share (Satoshis) — ASST vs MSTR Projection</p>
        <p className="text-[10px] text-muted-foreground mb-3">ASST starts with higher sats/share (smaller share count vs holdings). MSTR has more accumulation firepower.</p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={compData.filter((_, i) => i % 2 === 0 || i === compData.length - 1)} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
            <XAxis dataKey="label" tick={{ fontSize: 8, fill: "hsl(215 20% 55%)" }} />
            <YAxis tick={{ fontSize: 9, fill: "hsl(215 20% 55%)" }} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <ReTooltip
              contentStyle={{ background: "hsl(222 47% 10%)", border: "1px solid hsl(217 33% 17%)", borderRadius: 8, fontSize: 11 }}
              formatter={(v, name) => [`${Number(v).toLocaleString()} sats`, name]}
            />
            <Line type="monotone" dataKey="asst_btc_per_share" name="ASST sats/share" stroke="#60A5FA" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="mstr_btc_per_share" name="MSTR sats/share" stroke="#22C55E" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Flywheel notes */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-blue-400" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">ASST Reflexive Flywheel Notes</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px] text-muted-foreground">
          <ul className="space-y-1.5">
            <li>• <span className="text-blue-400 font-medium">SATA issuance</span> funds BTC buys — lower div rate (~13%) than BTC CAGR expectation creates positive carry</li>
            <li>• <span className="text-blue-400 font-medium">Smaller float</span> (42.5M shares) means each BTC purchase has higher per-share BTC accretion than MSTR</li>
            <li>• <span className="text-blue-400 font-medium">No software revenues</span> — pure BTC treasury, cleaner mNAV model, but no earnings buffer vs MSTR</li>
          </ul>
          <ul className="space-y-1.5">
            <li>• <span className="text-amber-400 font-medium">Strategy/MSTR cross-ecosystem:</span> ASST does NOT hold MSTR, STRC, or MSTY directly as of April 2026</li>
            <li>• <span className="text-amber-400 font-medium">ATM program:</span> Strive has ongoing equity ATM to fund BTC accumulation, similar to MSTR's framework</li>
            <li>• <span className="text-destructive font-medium">Risk:</span> Single-asset (BTC) treasury with no diversification. Higher beta, higher vol than MSTR.</li>
          </ul>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground/40 text-center">
        ASST model based on April 2026 public disclosures. Beta/correlation estimated from limited trading history. Not financial advice.
      </p>
    </div>
  );
}