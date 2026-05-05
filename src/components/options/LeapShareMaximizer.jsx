import React, { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendingUp, Plus, Trash2, Info, Zap, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
  ResponsiveContainer, Cell
} from "recharts";

// ── Black-Scholes helpers ─────────────────────────────────────────────────────
function erf(x) {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741,
    a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}
function normCDF(x) { return 0.5 * (1 + erf(x / Math.sqrt(2))); }
function bsCall(S, K, T, r, sigma) {
  if (T <= 0) return Math.max(S - K, 0);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  return S * normCDF(d1) - K * Math.exp(-r * T) * normCDF(d2);
}

// ── Bull scenario ASST projected price (mirrors Bitcoin24Simulator Bull preset) ──
// Bull: BTC CAGR starts at 90%, decelerates 7%/yr, terminal 15%
// ASST mNAV = 2.0x in bull, BTC holdings grow ~20K/yr
function projectASST_Bull(btcStart, asstBtcHoldings, asstSharesDilutedM, tYears) {
  let btcPrice = btcStart;
  let btcHold = asstBtcHoldings;
  let growthRate = 0.90;
  const terminalRate = 0.15;
  const declinePerYr = 0.07;
  const asstMnav = 2.0;
  const asstAccumPerYr = 20000;
  for (let i = 0; i < tYears; i++) {
    growthRate = Math.max(growthRate - declinePerYr, terminalRate);
    btcPrice = btcPrice * (1 + growthRate);
    btcHold += asstAccumPerYr;
  }
  const navPerShare = (btcHold * btcPrice) / (asstSharesDilutedM * 1e6);
  return parseFloat((navPerShare * asstMnav).toFixed(2));
}

// ── Default LEAP rows ─────────────────────────────────────────────────────────
const DEFAULT_LEAPS = [
  { id: 1, strike: 15, premium: 5.20 },
  { id: 2, strike: 12, premium: 6.80 },
  { id: 3, strike: 10, premium: 8.10 },
  { id: 4, strike: 8,  premium: 9.40 },
];

const ASST_SHARES_DILUTED_M = 100.77;
const ASST_BTC_HOLDINGS = 15000.5;

// Annual contribution from user context
const ANNUAL_CONTRIBUTION = 96500;

function Card({ children, className = "" }) {
  return <div className={`bg-card border border-border rounded-xl p-4 ${className}`}>{children}</div>;
}

export default function LeapShareMaximizer({ liveData }) {
  const asstLive = liveData?.asst_price;
  const btcLive = liveData?.btc_price;

  const [s0, setS0] = useState(asstLive ?? 16.36);
  const [tYears, setTYears] = useState(1.5);
  const [sigma, setSigma] = useState(0.75); // 75% implied vol for ASST
  const [leaps, setLeaps] = useState(DEFAULT_LEAPS);
  const [nextId, setNextId] = useState(5);
  const [useContributions, setUseContributions] = useState(true);
  const [mstyRedirect, setMstyRedirect] = useState(500); // $/mo from MSTY DRIP redirect
  const [showBS, setShowBS] = useState(false);
  const [volSensitivity, setVolSensitivity] = useState(false);

  // Auto-sync S0 with live price
  const effectiveS0 = asstLive ?? s0;

  // Bull projected price
  const stBull = useMemo(() =>
    projectASST_Bull(btcLive ?? 105000, ASST_BTC_HOLDINGS, ASST_SHARES_DILUTED_M, tYears),
    [btcLive, tYears]
  );

  // Capital available to deploy
  const annualCapital = useContributions ? ANNUAL_CONTRIBUTION + mstyRedirect * 12 : 0;
  const capitalForT = annualCapital * tYears;

  // Core LEAP calculations
  const results = useMemo(() => {
    return leaps.map(({ id, strike: K, premium: P }) => {
      const K_num = parseFloat(K) || 0;
      const P_num = parseFloat(P) || 0;
      if (K_num <= 0 || P_num <= 0) return null;

      const S0 = effectiveS0;
      const ST = stBull;
      const T = tYears;
      const r = 0.05; // risk-free rate

      // Core formulas
      const breakeven = (K_num * S0) / (S0 - P_num);
      const shareMult = (ST * (S0 - P_num)) / (K_num * S0);
      const effectiveCostBasis = P_num + K_num;
      const pctMoreShares = (shareMult - 1) * 100;

      // Black-Scholes approx premium
      const bsPremium = bsCall(S0, K_num, T, r, sigma);
      const premiumDiff = P_num - bsPremium;

      // Shares buyable with available capital
      const sharesViaStock = capitalForT > 0 ? capitalForT / S0 : null;
      const leapContractsAffordable = capitalForT > 0 ? Math.floor(capitalForT / (P_num * 100)) : null;
      const sharesViaLeap = leapContractsAffordable != null ? leapContractsAffordable * 100 * shareMult : null;
      const capitalAdvantage = sharesViaLeap != null && sharesViaStock != null
        ? ((sharesViaLeap / sharesViaStock) - 1) * 100 : null;

      // Recommendation
      const advantage = shareMult > 1 ? "strong" : shareMult > 0.9 ? "marginal" : "weak";
      const rec = shareMult >= 1.05 ? "Buy LEAP" : "Buy Stock";

      return {
        id, K: K_num, P: P_num,
        breakeven: parseFloat(breakeven.toFixed(2)),
        shareMult: parseFloat(shareMult.toFixed(3)),
        effectiveCostBasis: parseFloat(effectiveCostBasis.toFixed(2)),
        pctMoreShares: parseFloat(pctMoreShares.toFixed(1)),
        bsPremium: parseFloat(bsPremium.toFixed(2)),
        premiumDiff: parseFloat(premiumDiff.toFixed(2)),
        advantage, rec,
        sharesViaStock, sharesViaLeap, capitalAdvantage, leapContractsAffordable,
      };
    }).filter(Boolean);
  }, [leaps, effectiveS0, stBull, tYears, sigma, capitalForT]);

  // Sensitivity: ±20% vol & ±20% BTC growth
  const sensitivityRows = useMemo(() => {
    const volRange = [sigma * 0.8, sigma, sigma * 1.2];
    const growthMultipliers = [0.8, 1.0, 1.2];
    return volRange.flatMap(v =>
      growthMultipliers.map(gm => {
        const stAdj = stBull * gm;
        return {
          vol: `${(v * 100).toFixed(0)}%`,
          growth: `${gm === 1 ? "Base" : gm > 1 ? "+20%" : "-20%"}`,
          bestLeap: leaps.map(({ strike: K, premium: P }) => {
            const K_num = parseFloat(K) || 0;
            const P_num = parseFloat(P) || 0;
            if (!K_num || !P_num) return null;
            const mult = (stAdj * (effectiveS0 - P_num)) / (K_num * effectiveS0);
            return { K: K_num, mult };
          }).filter(Boolean).sort((a, b) => b.mult - a.mult)[0],
        };
      })
    );
  }, [leaps, stBull, effectiveS0, sigma]);

  // Bar chart data
  const barData = results.map(r => ({
    name: `$${r.K}`,
    mult: parseFloat(r.shareMult.toFixed(3)),
    pct: r.pctMoreShares,
    color: r.shareMult >= 1.15 ? "#22c55e" : r.shareMult >= 1.0 ? "#f59e0b" : "#ef4444",
  }));

  const addLeap = () => {
    setLeaps(prev => [...prev, { id: nextId, strike: "", premium: "" }]);
    setNextId(n => n + 1);
  };

  const removeLeap = (id) => setLeaps(prev => prev.filter(l => l.id !== id));

  const updateLeap = (id, field, val) => {
    setLeaps(prev => prev.map(l => l.id === id ? { ...l, [field]: val } : l));
  };

  // Optimal strikes summary
  const strongLeaps = results.filter(r => r.shareMult >= 1.05);
  const bestMult = strongLeaps.length ? Math.max(...strongLeaps.map(r => r.pctMoreShares)).toFixed(1) : null;
  const strikeRange = strongLeaps.length
    ? `$${Math.min(...strongLeaps.map(r => r.K))}–$${Math.max(...strongLeaps.map(r => r.K))}`
    : null;

  return (
    <Card>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
            ASST LEAP vs Stock Share Maximizer
          </h3>
          <span className="text-[10px] bg-blue-500/15 text-blue-400 border border-blue-500/25 rounded-full px-2 py-0.5 font-semibold">
            Bull Scenario · ≥180 DTE
          </span>
        </div>
        {asstLive && (
          <span className="text-[10px] text-green-400 font-mono flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
            Live ASST ${asstLive.toFixed(2)}
          </span>
        )}
      </div>

      {/* ── Inputs ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div>
          <Label className="text-[10px] text-muted-foreground mb-1 block">Current ASST (S₀)</Label>
          <Input
            type="number" step="0.01"
            value={effectiveS0}
            onChange={e => setS0(parseFloat(e.target.value) || 0)}
            className="h-8 text-xs font-mono bg-secondary border-border"
            disabled={!!asstLive}
          />
          {asstLive && <p className="text-[9px] text-green-400 mt-0.5">Auto-pulled live</p>}
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground mb-1 block">T (years)</Label>
          <Input
            type="number" step="0.25" min="0.5" max="3"
            value={tYears}
            onChange={e => setTYears(parseFloat(e.target.value) || 1.5)}
            className="h-8 text-xs font-mono bg-secondary border-border"
          />
          <p className="text-[9px] text-muted-foreground mt-0.5">≈ {Math.round(tYears * 365)} DTE</p>
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground mb-1 block">Projected ASST (S_T)</Label>
          <div className="h-8 flex items-center px-3 bg-secondary/60 border border-border rounded-md">
            <span className="text-xs font-mono font-bold text-green-400">${stBull.toFixed(2)}</span>
          </div>
          <p className="text-[9px] text-muted-foreground mt-0.5">Bull model auto-calc</p>
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground mb-1 block">Implied Vol (σ)</Label>
          <Input
            type="number" step="0.05" min="0.2" max="2"
            value={sigma}
            onChange={e => setSigma(parseFloat(e.target.value) || 0.75)}
            className="h-8 text-xs font-mono bg-secondary border-border"
          />
          <p className="text-[9px] text-muted-foreground mt-0.5">{(sigma * 100).toFixed(0)}% annualized</p>
        </div>
      </div>

      {/* Contributions */}
      <div className="flex flex-wrap items-center gap-4 p-3 bg-secondary/30 rounded-lg border border-border mb-4 text-xs">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={useContributions} onChange={e => setUseContributions(e.target.checked)}
            className="accent-primary w-3.5 h-3.5" />
          <span className="text-muted-foreground">Include annual contributions</span>
          <span className="font-mono text-primary font-bold">$96,500/yr</span>
        </label>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">+ MSTY DRIP redirect:</span>
          <span className="text-violet-400 font-mono font-bold">$</span>
          <Input type="number" value={mstyRedirect} onChange={e => setMstyRedirect(parseFloat(e.target.value) || 0)}
            className="h-7 w-20 text-xs font-mono bg-secondary border-border" />
          <span className="text-muted-foreground">/mo</span>
        </div>
        {useContributions && (
          <span className="text-[10px] text-muted-foreground ml-auto">
            Total capital for {tYears}y:
            <span className="text-amber-400 font-mono font-bold ml-1">${capitalForT.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          </span>
        )}
      </div>

      {/* ── LEAP table inputs ── */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Available Deep-ITM LEAPs</p>
          <Button size="sm" variant="outline" onClick={addLeap}
            className="h-7 text-[10px] gap-1 border-border text-muted-foreground hover:text-foreground">
            <Plus className="w-3 h-3" /> Add Row
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-1.5 pr-2">Strike K</th>
                <th className="text-left py-1.5 pr-2">Premium P (ask/mid)</th>
                <th className="text-right py-1.5 pr-2">Breakeven S_T</th>
                <th className="text-right py-1.5 pr-2">Share Mult</th>
                <th className="text-right py-1.5 pr-2">% More Shares</th>
                <th className="text-right py-1.5 pr-2">Cost Basis</th>
                {showBS && <th className="text-right py-1.5 pr-2">BS Fair Value</th>}
                <th className="text-right py-1.5 pr-2">Rec</th>
                <th className="py-1.5 w-6" />
              </tr>
            </thead>
            <tbody>
              {leaps.map(row => {
                const res = results.find(r => r.id === row.id);
                return (
                  <tr key={row.id} className={`border-b border-border/30 transition-colors ${
                    res?.shareMult >= 1.15 ? "bg-green-500/5" :
                    res?.shareMult >= 1.0  ? "bg-amber-500/5" : ""
                  }`}>
                    <td className="py-1.5 pr-2">
                      <Input type="number" value={row.strike} placeholder="$15"
                        onChange={e => updateLeap(row.id, "strike", e.target.value)}
                        className="h-7 w-20 text-xs font-mono bg-secondary border-border" />
                    </td>
                    <td className="py-1.5 pr-2">
                      <Input type="number" step="0.05" value={row.premium} placeholder="$5.20"
                        onChange={e => updateLeap(row.id, "premium", e.target.value)}
                        className="h-7 w-24 text-xs font-mono bg-secondary border-border" />
                    </td>
                    <td className="text-right pr-2 font-mono">
                      {res ? (
                        <span className={res.breakeven <= stBull ? "text-green-400 font-bold" : "text-red-400"}>
                          ${res.breakeven.toFixed(2)}
                        </span>
                      ) : "—"}
                    </td>
                    <td className={`text-right pr-2 font-mono font-bold ${
                      !res ? "text-muted-foreground" :
                      res.shareMult >= 1.15 ? "text-green-400" :
                      res.shareMult >= 1.0 ? "text-amber-400" : "text-red-400"
                    }`}>
                      {res ? `${res.shareMult.toFixed(3)}x` : "—"}
                    </td>
                    <td className={`text-right pr-2 font-mono font-bold ${
                      !res ? "text-muted-foreground" :
                      res.pctMoreShares >= 15 ? "text-green-400" :
                      res.pctMoreShares >= 0 ? "text-amber-400" : "text-red-400"
                    }`}>
                      {res ? `${res.pctMoreShares >= 0 ? "+" : ""}${res.pctMoreShares.toFixed(1)}%` : "—"}
                    </td>
                    <td className="text-right pr-2 font-mono text-foreground">
                      {res ? `$${res.effectiveCostBasis.toFixed(2)}` : "—"}
                    </td>
                    {showBS && (
                      <td className={`text-right pr-2 font-mono text-[10px] ${
                        res && res.premiumDiff < 0 ? "text-green-400" : "text-amber-400"
                      }`}>
                        {res ? (
                          <span title={`${res.premiumDiff >= 0 ? "+" : ""}${res.premiumDiff.toFixed(2)} vs model`}>
                            ${res.bsPremium.toFixed(2)}
                            <span className="text-[9px] ml-1 opacity-70">
                              ({res.premiumDiff >= 0 ? "+" : ""}{res.premiumDiff.toFixed(2)})
                            </span>
                          </span>
                        ) : "—"}
                      </td>
                    )}
                    <td className="text-right pr-2">
                      {res && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          res.rec === "Buy LEAP"
                            ? "bg-green-500/15 text-green-400 border border-green-500/30"
                            : "bg-secondary text-muted-foreground border border-border"
                        }`}>
                          {res.rec}
                        </span>
                      )}
                    </td>
                    <td className="py-1.5">
                      <button onClick={() => removeLeap(row.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Projected S_T vs Breakeven row ── */}
      <div className="p-3 bg-secondary/20 border border-border rounded-lg mb-4">
        <div className="flex flex-wrap gap-4 text-[11px]">
          <span className="text-muted-foreground">S₀ (now): <span className="text-foreground font-mono font-bold">${effectiveS0.toFixed(2)}</span></span>
          <span className="text-muted-foreground">S_T Bull ({tYears}y): <span className="text-green-400 font-mono font-bold">${stBull.toFixed(2)}</span></span>
          <span className="text-muted-foreground">Upside: <span className="text-amber-400 font-mono font-bold">+{(((stBull / effectiveS0) - 1) * 100).toFixed(1)}%</span></span>
          <span className="text-muted-foreground">BTC source: <span className="text-amber-400 font-mono">${(btcLive ?? 105000).toLocaleString()}</span></span>
        </div>
      </div>

      {/* ── Bar chart: Share Multiplier ── */}
      {barData.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Share Multiplier by Strike (1.0x = Break Even vs Buying Stock)</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={barData} margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} />
              <YAxis tick={{ fontSize: 9, fill: "hsl(215 20% 55%)" }} tickFormatter={v => `${v.toFixed(2)}x`} domain={[0, "auto"]} />
              <Tooltip
                contentStyle={{ background: "hsl(222 47% 10%)", border: "1px solid hsl(217 33% 17%)", borderRadius: 6, fontSize: 11 }}
                formatter={(v, name) => [`${parseFloat(v).toFixed(3)}x`, "Share Multiplier"]}
              />
              <ReferenceLine y={1} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: "Break-even 1.0x", position: "insideTopRight", fontSize: 9, fill: "#94a3b8" }} />
              <Bar dataKey="mult" radius={[3, 3, 0, 0]}>
                {barData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Capital deployment comparison ── */}
      {useContributions && results.some(r => r.capitalAdvantage != null) && (
        <div className="mb-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
            Capital Efficiency — ${capitalForT.toLocaleString(undefined, {maximumFractionDigits: 0})} deployed over {tYears}y
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-1.5 pr-3">Strike</th>
                  <th className="text-right pr-3">LEAP Contracts</th>
                  <th className="text-right pr-3">Shares via LEAP</th>
                  <th className="text-right pr-3">Shares via Stock</th>
                  <th className="text-right pr-3">Capital Advantage</th>
                </tr>
              </thead>
              <tbody>
                {results.filter(r => r.capitalAdvantage != null).map(r => (
                  <tr key={r.id} className="border-b border-border/30 hover:bg-secondary/20">
                    <td className="py-1.5 pr-3 font-mono font-bold text-foreground">${r.K}</td>
                    <td className="text-right pr-3 font-mono text-blue-400">{r.leapContractsAffordable}</td>
                    <td className="text-right pr-3 font-mono text-green-400">{r.sharesViaLeap?.toFixed(0)}</td>
                    <td className="text-right pr-3 font-mono text-muted-foreground">{r.sharesViaStock?.toFixed(0)}</td>
                    <td className={`text-right pr-3 font-mono font-bold ${r.capitalAdvantage >= 10 ? "text-green-400" : r.capitalAdvantage >= 0 ? "text-amber-400" : "text-red-400"}`}>
                      {r.capitalAdvantage >= 0 ? "+" : ""}{r.capitalAdvantage?.toFixed(1)}%
                    </td>
                  </tr>
                ))}
                <tr className="border-b border-border/30 text-muted-foreground">
                  <td className="py-1.5 pr-3 font-semibold" colSpan={2}>Buy Stock Direct</td>
                  <td className="text-right pr-3 font-mono text-muted-foreground" colSpan={2}>
                    {results[0]?.sharesViaStock?.toFixed(0)} shares
                  </td>
                  <td className="text-right pr-3 font-mono text-muted-foreground">0.0% (baseline)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Recommendation summary ── */}
      {strongLeaps.length > 0 && bestMult && (
        <div className="p-3 bg-green-500/10 border border-green-500/25 rounded-xl mb-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-green-400" />
            <span className="text-xs font-bold text-green-400">Recommendation Summary</span>
          </div>
          <p className="text-[11px] text-foreground">
            Optimal strikes: <span className="text-green-400 font-mono font-bold">{strikeRange}</span>
            {" "}— expected <span className="text-green-400 font-mono font-bold">+{bestMult}%</span> more ASST shares vs straight stock purchase under the Bull scenario.
            {useContributions && (
              <span> With ${capitalForT.toLocaleString(undefined, {maximumFractionDigits: 0})} deployed, the best LEAP gives <span className="text-amber-400 font-mono font-bold">
                {Math.round(Math.max(...strongLeaps.map(r => r.sharesViaLeap ?? 0))).toLocaleString()}
              </span> effective shares vs <span className="text-muted-foreground font-mono">
                {results[0]?.sharesViaStock?.toFixed(0)}
              </span> via stock.</span>
            )}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Rows in <span className="text-green-400 font-semibold">green</span> = projected S_T well above breakeven.
            <span className="text-amber-400 font-semibold ml-1">Amber</span> = marginal. Always verify with live chain data.
          </p>
        </div>
      )}
      {strongLeaps.length === 0 && results.length > 0 && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl mb-4">
          <p className="text-xs text-amber-400 font-bold">No LEAPs beat buying stock under current Bull scenario inputs.</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Try adjusting T (years) longer, or check lower-premium strikes. Consider buying stock directly.</p>
        </div>
      )}

      {/* ── Toggles ── */}
      <div className="flex flex-wrap gap-3">
        <button onClick={() => setShowBS(v => !v)}
          className={`text-[10px] px-3 py-1.5 rounded-lg border font-semibold transition-colors flex items-center gap-1.5 ${
            showBS ? "bg-primary/15 border-primary text-primary" : "border-border text-muted-foreground hover:bg-secondary"
          }`}>
          <Info className="w-3 h-3" />
          Black-Scholes vs Market
        </button>
        <button onClick={() => setVolSensitivity(v => !v)}
          className={`text-[10px] px-3 py-1.5 rounded-lg border font-semibold transition-colors flex items-center gap-1.5 ${
            volSensitivity ? "bg-amber-500/15 border-amber-500 text-amber-400" : "border-border text-muted-foreground hover:bg-secondary"
          }`}>
          <TrendingUp className="w-3 h-3" />
          ±20% Vol/Growth Sensitivity
        </button>
      </div>

      {/* ── Sensitivity table ── */}
      {volSensitivity && (
        <div className="mt-3 overflow-x-auto">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Best Strike Multiplier under Vol × Growth Scenarios</p>
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-1.5 pr-3">Vol σ</th>
                <th className="text-left py-1.5 pr-3">BTC Growth</th>
                <th className="text-right py-1.5 pr-3">Best Strike</th>
                <th className="text-right py-1.5">Multiplier</th>
              </tr>
            </thead>
            <tbody>
              {sensitivityRows.map((row, i) => (
                <tr key={i} className={`border-b border-border/30 ${row.growth === "Base" && row.vol === `${(sigma * 100).toFixed(0)}%` ? "bg-secondary/20" : ""}`}>
                  <td className="py-1 pr-3 font-mono text-foreground">{row.vol}</td>
                  <td className={`py-1 pr-3 font-semibold ${row.growth === "+20%" ? "text-green-400" : row.growth === "-20%" ? "text-red-400" : "text-foreground"}`}>
                    {row.growth}
                  </td>
                  <td className="text-right pr-3 font-mono text-blue-400">
                    {row.bestLeap ? `$${row.bestLeap.K}` : "—"}
                  </td>
                  <td className={`text-right font-mono font-bold ${
                    !row.bestLeap ? "text-muted-foreground" :
                    row.bestLeap.mult >= 1.15 ? "text-green-400" :
                    row.bestLeap.mult >= 1.0 ? "text-amber-400" : "text-red-400"
                  }`}>
                    {row.bestLeap ? `${row.bestLeap.mult.toFixed(3)}x` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[9px] text-muted-foreground/40 mt-4">
        Share multiplier = (S_T × (S₀ − P)) / (K × S₀). Breakeven = (K × S₀) / (S₀ − P). Bull S_T derived from Bitcoin24 Bull preset (90% initial BTC CAGR, 7% annual deceleration). Not financial advice.
      </p>
    </Card>
  );
}