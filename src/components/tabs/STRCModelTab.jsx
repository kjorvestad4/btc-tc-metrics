import React, { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Layers, Activity, RefreshCw, Wifi, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { formatCurrency } from "@/lib/calculations";
import {
  STRC_ATM_PROGRAM, STRC_RECENT_ACTIVITY, STRC_PAR_STATS
} from "@/lib/correlationData";
import {
  ResponsiveContainer, BarChart, Bar, Cell, CartesianGrid, XAxis, YAxis
} from "recharts";

const STRC_DEFINITIONS = {
  strc: {
    short: "STRC — Strategy Convertible Preferred, Series C",
    full: `STRC (Strategy Series C Perpetual Preferred) is a perpetual preferred equity instrument issued by MicroStrategy (Strategy) under its ATM (At-the-Market) program authorized March 23, 2026.

Key terms:
• Fixed dividend rate: 10% per annum, paid semi-annually
• Liquidation preference: $100 per share
• ATM program size: $21 billion authorized
• Conversion feature: convertible into MSTR common stock

The STRC ATM program is unique in that it operates as an ongoing "tap" — Strategy can sell shares continuously into the market at prevailing prices, collecting proceeds whenever STRC trades at or above $100 par. Proceeds are used 100% to purchase Bitcoin.

Unlike traditional fixed-income preferred, STRC has no maturity and no call date — it is perpetual. The semi-annual dividend is paid in cash.

Source: Strategy 8-K filings, March 23 2026 ATM authorization.`
  },
  atmProgram: {
    short: "$21B ATM program — continuous preferred share issuance above par",
    full: `The STRC ATM (At-the-Market) Program authorizes Strategy to sell up to $21 billion in aggregate liquidation preference of STRC preferred shares.

Mechanics:
1. Strategy files a prospectus supplement authorizing the issuance
2. Underwriter sells STRC into the open market when price ≥ $100 par
3. Net proceeds go directly to BTC purchases
4. Program has no fixed end date — runs until capacity is exhausted or withdrawn

Why ATM vs. block deals?
• Minimizes market impact — small daily tranches vs. large block offerings
• Flexible — can pause/accelerate based on market conditions
• Only executes when STRC ≥ $100 par (accretive issuance only)

The reflexive element: As BTC rises, MSTR mNAV rises, STRC demand increases, STRC price rises above par, issuance accelerates, more BTC purchased, driving the flywheel further.

Source: Strategy SEC filings — STRC prospectus supplement (March 2026)`
  },
  parTrading: {
    short: "STRC par ($100) dynamics — ex-dividend drop and recovery patterns",
    full: `STRC Par Trading Mechanics:

The $100 par value is the issuance price and liquidation preference. The ATM program only captures proceeds when STRC trades at or above $100.

Ex-dividend dynamics:
• STRC pays 10% annual dividend semi-annually (~$5.00 per payment)
• On ex-dividend dates, STRC price typically drops by roughly the dividend amount (~$5)
• This temporarily pushes STRC below par, pausing ATM issuance
• Market recovers STRC to par within days as buyers step in for the next dividend cycle

Recovery pattern: As of April 2026, average recovery to par is ~4.2 days post ex-div. This has been improving (faster recovery) as more market participants understand the mechanics and buy the ex-div dip.

Strategic implication: Rapid par recovery means the ATM program is rarely paused for long — issuance is effectively near-continuous.`
  }
};

function SectionHeader({ icon: Icon, title, color = "text-primary" }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className={`w-4 h-4 ${color}`} />
      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">{title}</h3>
    </div>
  );
}

export default function STRCModelTab({ params, liveData, onRefresh, refreshing }) {
  const prog = STRC_ATM_PROGRAM;
  const [captureRate, setCaptureRate] = useState(prog.avg_capture_pct);
  const [issuanceRate, setIssuanceRate] = useState(prog.avg_daily_volume_M);

  const isLive = !!liveData?.strc_price;
  const strcPrice = liveData?.strc_price ?? 97.50;

  const dailyProceeds = issuanceRate * (captureRate / 100);
  const dailyBtcImpact = params.btc_price > 0 ? (dailyProceeds * 1e6) / params.btc_price : 0;
  const quarterlyBtcImpact = dailyBtcImpact * 63;
  const remainingCapacity = prog.strc_remaining_M;
  const pctUsed = ((prog.strc_issued_to_date_M / prog.strc_total_capacity_M) * 100).toFixed(1);
  const newBtcHoldings = params.mstr_btc_holdings + quarterlyBtcImpact;
  const holdingsImpactPct = ((quarterlyBtcImpact / params.mstr_btc_holdings) * 100).toFixed(2);

  const s = STRC_PAR_STATS;
  const barData = [
    { label: "≥ Par", days: s.days_above_par, color: "#22C55E" },
    { label: "Within 1%", days: s.days_within_1pct, color: "#F59E0B" },
    { label: "Below 1%", days: s.days_below_1pct, color: "#EF4444" },
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
              <h3 className="text-sm font-semibold text-foreground">STRC — Strategy Convertible Preferred Series C</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                $21B ATM program · 10% semi-annual · perpetual · proceeds → BTC accumulation
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
          isLive ? "bg-purple-400/15 text-purple-400 border border-purple-400/25" : "bg-secondary text-muted-foreground border border-border"
        }`}>
          <Wifi className="w-2.5 h-2.5" />
          {isLive ? "Live STRC price loaded" : "Static defaults — Polygon key required for live STRC"}
        </div>
      </div>

      {/* Program overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-[10px] text-muted-foreground">STRC Price</p>
          <p className="text-xl font-bold font-mono text-purple-400">${strcPrice.toFixed(2)}</p>
          <p className="text-[9px] text-muted-foreground">{strcPrice >= 100 ? "✓ At/above par" : "Below par"}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-[10px] text-muted-foreground">Total Program</p>
          <p className="text-xl font-bold font-mono text-purple-400">$21B</p>
          <p className="text-[9px] text-muted-foreground">Auth. Mar 23, 2026</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-[10px] text-muted-foreground">Issued to Date</p>
          <p className="text-xl font-bold font-mono text-primary">${prog.strc_issued_to_date_M.toLocaleString()}M</p>
          <p className="text-[9px] text-muted-foreground">{pctUsed}% utilized</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-[10px] text-muted-foreground">Remaining</p>
          <p className="text-xl font-bold font-mono text-cyan-400">${remainingCapacity.toLocaleString()}M</p>
          <p className="text-[9px] text-muted-foreground">dry powder</p>
        </div>
      </div>

      {/* ATM Simulator + Par Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ATM Simulator */}
        <div className="bg-card border border-border rounded-xl p-4">
          <SectionHeader icon={Layers} title="ATM Issuance Simulator" color="text-purple-400" />
          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <Label className="text-[10px] text-muted-foreground">Daily ATM Volume ($M)</Label>
                <span className="text-[10px] font-mono text-primary">${issuanceRate}M</span>
              </div>
              <Slider value={[issuanceRate]} onValueChange={([v]) => setIssuanceRate(v)} min={5} max={150} step={5} />
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <Label className="text-[10px] text-muted-foreground">Capture Rate (% of vol ≥ $100 par)</Label>
                <span className="text-[10px] font-mono text-amber-400">{captureRate}%</span>
              </div>
              <Slider value={[captureRate]} onValueChange={([v]) => setCaptureRate(v)} min={10} max={100} step={5} />
            </div>

            <div className="p-3 bg-secondary/50 rounded-lg border border-border space-y-2">
              <p className="text-xs font-semibold text-foreground">Projected Output</p>
              {[
                { label: "Daily Proceeds", value: `$${dailyProceeds.toFixed(1)}M` },
                { label: "Daily BTC Acquired", value: `~${Math.round(dailyBtcImpact).toLocaleString()} BTC` },
                { label: "Quarterly BTC Impact", value: `~${Math.round(quarterlyBtcImpact).toLocaleString()} BTC` },
                { label: "vs. Current Holdings", value: `+${holdingsImpactPct}%`, highlight: true },
                { label: "New Total Holdings (est.)", value: `${Math.round(newBtcHoldings).toLocaleString()} BTC`, highlight: true },
              ].map((item) => (
                <div key={item.label} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className={`font-mono font-bold ${item.highlight ? "text-primary" : "text-foreground"}`}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Par Trading Stats */}
        <div className="bg-card border border-border rounded-xl p-4">
          <SectionHeader icon={Activity} title="Par Trading Statistics" color="text-green-400" />
          <div className="grid grid-cols-3 gap-2 mb-4">
            {barData.map((b) => (
              <div key={b.label} className="p-2.5 bg-secondary/50 rounded-lg border border-border text-center">
                <p className="text-[10px] text-muted-foreground">{b.label}</p>
                <p className="text-xl font-bold font-mono" style={{ color: b.color }}>{b.days}</p>
                <p className="text-[9px] text-muted-foreground">
                  {((b.days / s.total_trading_days_observed) * 100).toFixed(0)}% of days
                </p>
              </div>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={110}>
            <BarChart data={barData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: "hsl(215 20% 55%)" }} />
              <YAxis tick={{ fontSize: 9, fill: "hsl(215 20% 55%)" }} />
              <Bar dataKey="days" radius={[3, 3, 0, 0]}>
                {barData.map((b, i) => <Cell key={i} fill={b.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 space-y-1.5 text-xs">
            {[
              { label: "Avg ex-div drawdown", value: `-${s.avg_exdiv_drop_pct}%`, color: "text-destructive" },
              { label: "Avg days to recover to par", value: `${s.avg_recovery_days} days`, color: "text-amber-400" },
              { label: "Recent recovery (last 4 wks)", value: `${s.recent_recovery_days} days`, color: "text-primary" },
              { label: "Fastest / Slowest recovery", value: `${s.min_recovery_days} / ${s.max_recovery_days} days`, color: "text-muted-foreground" },
            ].map((item) => (
              <div key={item.label} className="flex justify-between">
                <span className="text-muted-foreground">{item.label}</span>
                <span className={`font-mono font-semibold ${item.color}`}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent activity table */}
      <div className="bg-card border border-border rounded-xl p-4">
        <SectionHeader icon={Layers} title="Recent Daily ATM Activity (Last 10 Trading Days)" color="text-purple-400" />
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-1.5 pr-3 font-medium">Date</th>
                <th className="text-right py-1.5 pr-3 font-medium">Price</th>
                <th className="text-right py-1.5 pr-3 font-medium">Volume ($M)</th>
                <th className="text-right py-1.5 pr-3 font-medium">% ≥ Par</th>
                <th className="text-right py-1.5 pr-3 font-medium">Capture%</th>
                <th className="text-right py-1.5 pr-3 font-medium">Proceeds</th>
                <th className="text-right py-1.5 font-medium">BTC est.</th>
              </tr>
            </thead>
            <tbody>
              {STRC_RECENT_ACTIVITY.map((row) => {
                const atPar = row.price >= 100;
                return (
                  <tr key={row.date} className={`border-b border-border/30 ${atPar ? "bg-primary/5" : ""}`}>
                    <td className="py-1 pr-3 font-mono text-foreground">{row.date}</td>
                    <td className={`py-1 pr-3 text-right font-mono ${atPar ? "text-primary font-bold" : "text-muted-foreground"}`}>
                      ${row.price.toFixed(2)}{atPar && " ✓"}
                    </td>
                    <td className="py-1 pr-3 text-right font-mono text-foreground">{row.volume_M.toFixed(1)}</td>
                    <td className={`py-1 pr-3 text-right font-mono ${row.pct_at_par > 0 ? "text-primary" : "text-muted-foreground"}`}>
                      {row.pct_at_par > 0 ? `${row.pct_at_par.toFixed(1)}%` : "—"}
                    </td>
                    <td className={`py-1 pr-3 text-right font-mono ${row.capture_pct > 0 ? "text-amber-400" : "text-muted-foreground"}`}>
                      {row.capture_pct > 0 ? `${row.capture_pct}%` : "—"}
                    </td>
                    <td className={`py-1 pr-3 text-right font-mono ${row.proceeds_M > 0 ? "text-cyan-400" : "text-muted-foreground"}`}>
                      {row.proceeds_M > 0 ? `$${row.proceeds_M.toFixed(2)}M` : "—"}
                    </td>
                    <td className={`py-1 text-right font-mono ${row.btc_acquired > 0 ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                      {row.btc_acquired > 0 ? row.btc_acquired.toLocaleString() : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Definitions Accordion */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">STRC Definitions</h3>
        </div>
        <Accordion type="multiple" className="space-y-1">
          {Object.entries(STRC_DEFINITIONS).map(([key, def]) => (
            <AccordionItem key={key} value={key} className="border border-border/50 rounded-lg px-3 overflow-hidden">
              <AccordionTrigger className="text-xs text-foreground font-medium py-2 hover:no-underline">
                <span className="text-purple-400 font-mono mr-2 uppercase">{key}</span>
                <span className="text-muted-foreground font-normal">{def.short}</span>
              </AccordionTrigger>
              <AccordionContent>
                <pre className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-wrap font-sans pb-2">{def.full}</pre>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>

      <p className="text-[10px] text-muted-foreground/40 text-center">
        STRC data based on March–April 2026 public filings and market data. Not financial advice.
      </p>
    </div>
  );
}