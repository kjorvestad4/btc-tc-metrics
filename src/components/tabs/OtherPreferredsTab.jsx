import React from "react";
import MetricCard from "../dashboard/MetricCard";
import { Layers, Shield, Percent, BarChart3, BookOpen } from "lucide-react";
import { formatCurrency } from "@/lib/calculations";
import { PREFERRED_SHARPE_RATIOS } from "@/lib/correlationData";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend
} from "recharts";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const TICK = { fontSize: 9, fill: "hsl(215 20% 55%)" };
const GRID = "hsl(217 33% 17%)";

// Official data from strategy.com/credit, /strf, /strk, /strd (Apr 2026)
// Seniority order: STRF > STRK > STRD
const PREFERREDS = [
  {
    ticker: "STRF",
    name: "Strategy 10.00% Series A Perpetual Strife Preferred",
    dividend_rate: 10.0,
    rate_type: "Fixed",
    payment: "Quarterly",
    notional_M: 3450,
    liquidation_pref: 100,
    price: 99.90,
    vol_30d: 20.0,
    current_yield: 10.01,
    sharpe: 0.28,
    convertible: false,
    btc_denominated: false,
    seniority: 1,
    call_schedule: "Not callable (perpetual, no call date)",
    description: "Senior perpetual preferred. Highest seniority in the Strategy capital stack after convertible notes. Fixed 10% quarterly cash dividend. No conversion feature — pure fixed income preferred.",
    color: "#22C55E",
  },
  {
    ticker: "STRK",
    name: "Strategy 8.00% Series A Perpetual Strike Preferred",
    dividend_rate: 8.0,
    rate_type: "Fixed",
    payment: "Quarterly",
    notional_M: 2100,
    liquidation_pref: 100,
    price: 76.88,
    vol_30d: 30.0,
    current_yield: 10.41,
    sharpe: 0.20,
    convertible: true,
    conversion_price: 1000,
    btc_denominated: false,
    seniority: 2,
    call_schedule: "Not callable (perpetual, no call date)",
    description: "Convertible perpetual preferred. Junior to STRF. Fixed 8% quarterly cash dividend. Convertible into MSTR common at a premium — provides equity upside optionality. Trades well below par due to lower coupon + conversion premium.",
    color: "#F59E0B",
  },
  {
    ticker: "STRD",
    name: "Strategy 10.00% Series A Perpetual Stride Preferred",
    dividend_rate: 10.0,
    rate_type: "Fixed",
    payment: "Quarterly",
    notional_M: 900,
    liquidation_pref: 100,
    price: 77.14,
    vol_30d: 18.0,
    current_yield: 12.96,
    sharpe: 0.48,
    convertible: true,
    conversion_price: 1500,
    btc_denominated: false,
    seniority: 3,
    call_schedule: "Not callable (perpetual, no call date)",
    description: "Convertible perpetual preferred. Lowest seniority among the three. Fixed 10% quarterly cash dividend. Convertible into MSTR common — highest equity optionality. Trades below par due to BTC/MSTR price fluctuations and liquidation seniority risk.",
    color: "#60A5FA",
  },
];

const TOTAL_NOTIONAL = PREFERREDS.reduce((s, p) => s + p.notional_M, 0);
const TOTAL_ANNUAL_DIV = PREFERREDS.reduce((s, p) => s + (p.notional_M * 1e6 * p.dividend_rate / 100), 0);

export default function OtherPreferredsTab({ liveData }) {
  const sharpeData = PREFERREDS.map(p => ({
    ticker: p.ticker,
    sharpe: p.sharpe,
    color: p.sharpe >= 0.7 ? "#22C55E" : p.sharpe >= 0.3 ? "#F59E0B" : "#EF4444",
  }));

  const yieldData = PREFERREDS.map(p => ({
    ticker: p.ticker,
    "Current Yield": p.current_yield,
    "Par Yield": p.dividend_rate,
    color: p.color,
  }));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Strategy Preferred Program — STRF, STRK, STRD</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Official data from strategy.com/credit, /strf, /strk, /strd. Seniority order: <span className="text-green-400 font-medium">STRF</span> &gt; <span className="text-amber-400 font-medium">STRK</span> &gt; <span className="text-blue-400 font-medium">STRD</span>. STRE has been eliminated.
            </p>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard title="Total Notional" value={formatCurrency(TOTAL_NOTIONAL * 1e6)} subtitle="3 series outstanding" icon={Layers} accentClass="text-purple-400" />
        <MetricCard title="Annual Div Liability" value={formatCurrency(TOTAL_ANNUAL_DIV)} subtitle="cash out per year" icon={Percent} accentClass="text-destructive" />
        <MetricCard title="STRF Price" value={`$${PREFERREDS[0].price.toFixed(2)}`} subtitle="near par" icon={Shield} accentClass="text-green-400" />
        <MetricCard title="STRK Price" value={`$${PREFERREDS[1].price.toFixed(2)}`} subtitle="below par" icon={Shield} accentClass="text-amber-400" />
      </div>

      {/* Main table */}
      <div className="bg-card border border-border rounded-xl p-4 overflow-x-auto">
        <div className="flex items-center gap-2 mb-3">
          <Layers className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Preferred Series — Full Details</h3>
        </div>
        <table className="w-full text-xs min-w-[640px]">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left py-1.5 pr-3 font-medium">Ticker</th>
              <th className="text-left py-1.5 pr-3 font-medium">Seniority</th>
              <th className="text-right py-1.5 pr-3 font-medium">Par Yield</th>
              <th className="text-right py-1.5 pr-3 font-medium">Price</th>
              <th className="text-right py-1.5 pr-3 font-medium">Eff. Yield</th>
              <th className="text-right py-1.5 pr-3 font-medium">30D Vol</th>
              <th className="text-right py-1.5 pr-3 font-medium">Sharpe</th>
              <th className="text-right py-1.5 pr-3 font-medium">Notional</th>
              <th className="text-right py-1.5 font-medium">Convertible</th>
            </tr>
          </thead>
          <tbody>
            {PREFERREDS.map(p => (
              <tr key={p.ticker} className="border-b border-border/30 hover:bg-secondary/30">
                <td className="py-2 pr-3 font-mono font-bold" style={{ color: p.color }}>{p.ticker}</td>
                <td className="py-2 pr-3 text-muted-foreground">#{p.seniority}</td>
                <td className="py-2 pr-3 text-right font-mono text-muted-foreground">{p.dividend_rate.toFixed(2)}%</td>
                <td className="py-2 pr-3 text-right font-mono text-foreground">${p.price.toFixed(2)}</td>
                <td className="py-2 pr-3 text-right font-mono text-green-400">{p.current_yield.toFixed(2)}%</td>
                <td className="py-2 pr-3 text-right font-mono text-muted-foreground">{p.vol_30d.toFixed(0)}%</td>
                <td className={`py-2 pr-3 text-right font-mono font-bold ${p.sharpe >= 0.7 ? "text-green-400" : p.sharpe >= 0.3 ? "text-amber-400" : "text-destructive"}`}>
                  {p.sharpe.toFixed(2)}
                </td>
                <td className="py-2 pr-3 text-right font-mono text-muted-foreground">${p.notional_M.toLocaleString()}M</td>
                <td className="py-2 text-right font-mono">{p.convertible ? <span className="text-cyan-400">Yes</span> : <span className="text-muted-foreground">No</span>}</td>
              </tr>
            ))}
            <tr className="border-t border-border">
              <td className="py-2 font-bold text-foreground" colSpan={7}>Total</td>
              <td className="py-2 text-right font-mono font-bold text-purple-400">${TOTAL_NOTIONAL.toLocaleString()}M</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <BarChart3 className="w-3.5 h-3.5 text-cyan-400" /> Yield Comparison
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={yieldData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
              <XAxis dataKey="ticker" tick={TICK} />
              <YAxis tick={TICK} tickFormatter={v => `${v}%`} />
              <Tooltip contentStyle={{ background: "hsl(222 47% 10%)", border: "1px solid hsl(217 33% 17%)", borderRadius: 6, fontSize: 11 }}
                formatter={v => [`${v.toFixed(2)}%`]} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="Par Yield" fill="#6B7280" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Current Yield" fill="#22C55E" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <Percent className="w-3.5 h-3.5 text-green-400" /> Sharpe Ratio (30D)
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={sharpeData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
              <XAxis dataKey="ticker" tick={TICK} />
              <YAxis tick={TICK} domain={[0, 1]} />
              <Tooltip contentStyle={{ background: "hsl(222 47% 10%)", border: "1px solid hsl(217 33% 17%)", borderRadius: 6, fontSize: 11 }}
                formatter={v => [v.toFixed(2), "Sharpe"]} />
              <Bar dataKey="sharpe" radius={[3, 3, 0, 0]}>
                {sharpeData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[9px] text-muted-foreground/60 mt-2">Sharpe = (Eff. Yield − 4.35% risk-free) ÷ 30D Vol</p>
        </div>
      </div>

      {/* Individual series detail cards */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Series Details</h3>
        </div>
        <Accordion type="multiple" className="space-y-1">
          {PREFERREDS.map(p => (
            <AccordionItem key={p.ticker} value={p.ticker} className="border border-border/50 rounded-lg px-3 overflow-hidden">
              <AccordionTrigger className="text-xs text-foreground font-medium py-2 hover:no-underline">
                <span className="font-mono font-bold mr-2" style={{ color: p.color }}>{p.ticker}</span>
                <span className="text-muted-foreground font-normal">{p.name}</span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="pb-2 space-y-2">
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{p.description}</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                    {[
                      { label: "Seniority", val: `#${p.seniority}` },
                      { label: "Dividend Rate", val: `${p.dividend_rate}% (${p.rate_type})` },
                      { label: "Frequency", val: p.payment },
                      { label: "Call Schedule", val: p.call_schedule },
                      { label: "Convertible", val: p.convertible ? `Yes (@ $${p.conversion_price?.toLocaleString()})` : "No" },
                      { label: "BTC Denominated", val: p.btc_denominated ? "Yes" : "No" },
                    ].map(item => (
                      <div key={item.label} className="p-2 rounded bg-secondary/50 border border-border">
                        <p className="text-[9px] text-muted-foreground">{item.label}</p>
                        <p className="text-xs font-semibold text-foreground">{item.val}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>

      <p className="text-[10px] text-muted-foreground/40 text-center">
        Data from strategy.com/credit, /strf, /strk, /strd (April 2026). STRE eliminated per official sources. Educational use only.
      </p>
    </div>
  );
}