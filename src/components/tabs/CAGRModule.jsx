import React from "react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, LineChart, Line, Legend
} from "recharts";
import { TrendingUp, BarChart3, Activity, Zap } from "lucide-react";
import { HISTORICAL_CAGRS, CAGR_CORRELATION_MATRIX, formatPercent } from "@/lib/calculations";

function Card({ children, className = "" }) {
  return <div className={`bg-card border border-border rounded-xl p-4 ${className}`}>{children}</div>;
}

function SectionHeader({ icon: Icon, title, color = "text-primary" }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className={`w-4 h-4 ${color}`} />
      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">{title}</h3>
    </div>
  );
}

// Historical CAGR table
function HistoricalCAGRTable() {
  const assets = [
    { key: "btc",  label: "Bitcoin (BTC)",   color: "text-amber-400",   data: HISTORICAL_CAGRS.btc },
    { key: "mstr", label: "MSTR",             color: "text-primary",     data: HISTORICAL_CAGRS.mstr },
    { key: "asst", label: "ASST (Strive)",    color: "text-cyan-400",    data: HISTORICAL_CAGRS.asst },
    { key: "msty_tr", label: "MSTY (Total Return)", color: "text-green-400", data: HISTORICAL_CAGRS.msty.total_return },
    { key: "msty_px", label: "MSTY (Price Only)",   color: "text-muted-foreground", data: HISTORICAL_CAGRS.msty.price },
  ];
  const periods = ["1Y", "3Y", "5Y", "since_inception"];
  const periodLabels = { "1Y": "1-Year", "3Y": "3-Year", "5Y": "5-Year", "since_inception": "Since Inception" };

  return (
    <Card>
      <SectionHeader icon={BarChart3} title="Historical Back-Tested CAGRs" color="text-amber-400" />
      <p className="text-[10px] text-muted-foreground mb-3">
        Back-tested through April 2026. ASST/MSTY are newer instruments with limited history.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left py-1.5 pr-3 font-medium">Asset</th>
              {periods.map(p => (
                <th key={p} className="text-right py-1.5 pr-3 font-medium">{periodLabels[p]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => (
              <tr key={asset.key} className="border-b border-border/30 hover:bg-secondary/30">
                <td className={`py-1.5 pr-3 font-semibold ${asset.color}`}>{asset.label}</td>
                {periods.map(p => {
                  const val = asset.data?.[p];
                  return (
                    <td key={p} className={`py-1.5 pr-3 text-right font-mono ${
                      val == null ? "text-muted-foreground/40"
                        : val > 0 ? "text-primary" : "text-destructive"
                    }`}>
                      {val == null ? "—" : `${val > 0 ? "+" : ""}${val}%`}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-muted-foreground/60 mt-2">
        ⚠ Back-tested returns are approximate. Past performance ≠ future results. ASST/MSTY have &lt;2Y of history.
      </p>
    </Card>
  );
}

// CAGR sensitivity table: If BTC CAGR = X% → expected MSTR/ASST/MSTY
function CAGRSensitivityTable() {
  const btcScenarios = [10, 20, 30, 40, 50, 60, 75, 100];
  return (
    <Card>
      <SectionHeader icon={Activity} title="CAGR Sensitivity: If BTC CAGR = X%..." color="text-cyan-400" />
      <p className="text-[10px] text-muted-foreground mb-3">
        Implied CAGRs for MSTR, ASST, MSTY based on back-tested beta to BTC. MSTY total return includes ~35pp div yield.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left py-1.5 pr-3 font-medium">BTC CAGR</th>
              <th className="text-right py-1.5 pr-3 font-medium text-primary">MSTR</th>
              <th className="text-right py-1.5 pr-3 font-medium text-cyan-400">ASST</th>
              <th className="text-right py-1.5 pr-3 font-medium text-green-400">MSTY (TR)</th>
              <th className="text-right py-1.5 font-medium text-muted-foreground">MSTY (Px)</th>
            </tr>
          </thead>
          <tbody>
            {btcScenarios.map(btc => {
              const implied = CAGR_CORRELATION_MATRIX.impliedCAGR(btc);
              return (
                <tr key={btc} className={`border-b border-border/30 ${btc === 40 ? "bg-primary/5" : ""}`}>
                  <td className={`py-1.5 pr-3 font-mono font-bold ${btc >= 40 ? "text-primary" : "text-amber-400"}`}>
                    {btc}%
                    {btc === 40 && <span className="ml-1.5 text-[9px] bg-primary/20 text-primary px-1 rounded">BASE</span>}
                  </td>
                  <td className="py-1.5 pr-3 text-right font-mono text-primary">+{implied.mstr.toFixed(0)}%</td>
                  <td className="py-1.5 pr-3 text-right font-mono text-cyan-400">+{implied.asst.toFixed(0)}%</td>
                  <td className="py-1.5 pr-3 text-right font-mono text-green-400">+{implied.msty_total.toFixed(0)}%</td>
                  <td className="py-1.5 text-right font-mono text-muted-foreground">+{implied.msty_price.toFixed(0)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// Scatter: BTC CAGR vs MSTR/ASST scatter (synthetic annual returns)
function CAGRScatterChart() {
  // Synthetic annual-return pairs: BTC vs MSTR, BTC vs ASST (approximate historical years)
  const mstrData = [
    { btc: -73, mstr: -89 }, { btc: 155, mstr: 352 }, { btc: 60, mstr: 145 },
    { btc: -64, mstr: -74 }, { btc: 125, mstr: 280 }, { btc: 28, mstr: 38 },
    { btc: -20, mstr: -48 }, { btc: 44, mstr: 88 },
  ];
  const asstData = [
    { btc: 28, asst: 22 }, { btc: -20, asst: -31 },
  ];

  return (
    <Card>
      <SectionHeader icon={TrendingUp} title="Annual Return Scatter — BTC vs MSTR / ASST" color="text-primary" />
      <p className="text-[10px] text-muted-foreground mb-3">
        Each point = 1 calendar year. MSTR β≈1.92x to BTC (R²=71%). ASST β≈1.61x (limited history).
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <ScatterChart margin={{ top: 4, right: 8, bottom: 20, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
          <XAxis dataKey="btc" name="BTC Annual %" type="number" domain={[-80, 180]}
            tickFormatter={v => `${v}%`} tick={{ fontSize: 9, fill: "hsl(215 20% 55%)" }}
            label={{ value: "BTC Annual %", position: "insideBottom", offset: -12, fontSize: 9, fill: "hsl(215 20% 55%)" }} />
          <YAxis dataKey="mstr" name="MSTR %" type="number" domain={[-100, 400]}
            tickFormatter={v => `${v}%`} tick={{ fontSize: 9, fill: "hsl(215 20% 55%)" }} />
          <Tooltip content={({ payload }) => {
            if (!payload?.length) return null;
            const d = payload[0].payload;
            return (
              <div className="bg-popover border border-border rounded p-2 text-xs">
                <p>BTC: <span className="font-mono text-amber-400">{d.btc > 0 ? "+" : ""}{d.btc}%</span></p>
                {d.mstr != null && <p>MSTR: <span className="font-mono text-primary">{d.mstr > 0 ? "+" : ""}{d.mstr}%</span></p>}
                {d.asst != null && <p>ASST: <span className="font-mono text-cyan-400">{d.asst > 0 ? "+" : ""}{d.asst}%</span></p>}
              </div>
            );
          }} />
          <ReferenceLine x={0} stroke="hsl(217 33% 25%)" />
          <ReferenceLine y={0} stroke="hsl(217 33% 25%)" />
          <Scatter name="MSTR" data={mstrData} fill="#22C55E" opacity={0.8} r={5} />
          <Scatter name="ASST" data={asstData.map(d => ({ btc: d.btc, mstr: d.asst }))} fill="#06B6D4" opacity={0.8} r={5} />
        </ScatterChart>
      </ResponsiveContainer>
      <div className="flex gap-4 mt-1.5">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-primary" /><span className="text-[10px] text-muted-foreground">MSTR (β=1.92x)</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-cyan-400" /><span className="text-[10px] text-muted-foreground">ASST (β=1.61x, 2yr)</span></div>
      </div>
    </Card>
  );
}

// CAGR Assumption sliders (user-editable, drive projections)
function CAGRAssumptionSliders({ params, onParamsChange }) {
  const sliders = [
    { key: "cagr_btc",  label: "Bitcoin CAGR",       color: "text-amber-400", min: 5,  max: 150, step: 5 },
    { key: "cagr_mstr", label: "MSTR CAGR (target)",  color: "text-primary",   min: 10, max: 300, step: 5 },
    { key: "cagr_asst", label: "ASST CAGR (target)",  color: "text-cyan-400",  min: 10, max: 200, step: 5 },
    { key: "cagr_msty", label: "MSTY Total Return CAGR", color: "text-green-400", min: 5, max: 150, step: 5 },
  ];

  // Implied values from BTC input
  const implied = CAGR_CORRELATION_MATRIX.impliedCAGR(params.cagr_btc || 40);

  return (
    <Card>
      <SectionHeader icon={Zap} title="CAGR Assumptions (User-Editable)" color="text-purple-400" />
      <p className="text-[10px] text-muted-foreground mb-3">
        Set your own CAGR targets to override the beta-implied defaults. These drive the 1–10Y projections.
      </p>
      <div className="space-y-4">
        {sliders.map(s => {
          const val = params[s.key] ?? (s.key === "cagr_btc" ? 40 : s.key === "cagr_mstr" ? 75 : s.key === "cagr_asst" ? 60 : 35);
          return (
            <div key={s.key} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className={`text-xs ${s.color} font-semibold`}>{s.label}</Label>
                <span className={`text-xs font-mono font-bold ${s.color}`}>{val}%</span>
              </div>
              <Slider
                value={[Number(val)]}
                onValueChange={(vals) => {
                  console.log("CAGR slider changed:", s.key, vals[0]);
                  onParamsChange({ ...params, [s.key]: Number(vals[0]) });
                }}
                min={s.min}
                max={s.max}
                step={s.step}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-4 p-3 rounded-lg bg-secondary/50 border border-border">
        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-2">
          Beta-Implied CAGRs at BTC = {params.cagr_btc || 40}%
        </p>
        {[
          { label: "MSTR (β=1.92x)", value: implied.mstr, color: "text-primary" },
          { label: "ASST (β=1.61x)", value: implied.asst, color: "text-cyan-400" },
          { label: "MSTY Total Return", value: implied.msty_total, color: "text-green-400" },
          { label: "MSTY Price Only", value: implied.msty_price, color: "text-muted-foreground" },
        ].map(item => (
          <div key={item.label} className="flex justify-between text-xs py-0.5">
            <span className="text-muted-foreground">{item.label}</span>
            <span className={`font-mono font-bold ${item.color}`}>+{item.value.toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// Projected CAGR comparison chart (1–10Y)
function CAGRProjectionChart({ params }) {
  const years = [1, 2, 3, 4, 5, 7, 10];
  const cagrs = {
    btc:  params.cagr_btc  || 40,
    mstr: params.cagr_mstr || 75,
    asst: params.cagr_asst || 60,
    msty: params.cagr_msty || 35,
  };
  const data = years.map(y => ({
    year: `Y${y}`,
    BTC:  +((Math.pow(1 + cagrs.btc  / 100, y) - 1) * 100).toFixed(0),
    MSTR: +((Math.pow(1 + cagrs.mstr / 100, y) - 1) * 100).toFixed(0),
    ASST: +((Math.pow(1 + cagrs.asst / 100, y) - 1) * 100).toFixed(0),
    MSTY: +((Math.pow(1 + cagrs.msty / 100, y) - 1) * 100).toFixed(0),
  }));

  return (
    <Card>
      <SectionHeader icon={TrendingUp} title="Cumulative Return Projection (User CAGRs)" color="text-primary" />
      <p className="text-[10px] text-muted-foreground mb-3">
        Based on your CAGR assumptions above. $1 invested compounds to...
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
          <XAxis dataKey="year" tick={{ fontSize: 9, fill: "hsl(215 20% 55%)" }} />
          <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 9, fill: "hsl(215 20% 55%)" }} />
          <Tooltip formatter={(v, name) => [`+${v}%`, name]} contentStyle={{ background: "hsl(222 47% 10%)", border: "1px solid hsl(217 33% 17%)", borderRadius: 6, fontSize: 11 }} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          <Line type="monotone" dataKey="BTC"  stroke="#F59E0B" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="MSTR" stroke="#22C55E" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="ASST" stroke="#06B6D4" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="MSTY" stroke="#A78BFA" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}

export default function CAGRModule({ params, onParamsChange }) {
  return (
    <div className="space-y-4">
      {/* Header banner */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-start gap-3">
          <BarChart3 className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">CAGR Assumptions & Back-Testing Module</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Historical back-tested CAGRs, beta correlations, sensitivity tables, and user-editable CAGR assumptions that drive 1–10Y projections.
            </p>
          </div>
        </div>
      </div>

      {/* Historical CAGRs + Sensitivity side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <HistoricalCAGRTable />
        <CAGRSensitivityTable />
      </div>

      {/* Scatter + Sliders side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CAGRScatterChart />
        <CAGRAssumptionSliders params={params} onParamsChange={onParamsChange} />
      </div>

      {/* Projection chart full width */}
      <CAGRProjectionChart params={params} />

      <p className="text-[10px] text-muted-foreground/40 text-center">
        CAGR sensitivity based on OLS regression of annual returns through April 2026. Back-tested correlations are not predictive. Not financial advice.
      </p>
    </div>
  );
}