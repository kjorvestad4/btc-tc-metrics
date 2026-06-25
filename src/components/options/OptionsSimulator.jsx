import React, { useState, useMemo, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { formatCurrency } from "@/lib/calculations";
import { Plus, Trash2, Copy } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";

const TICK_STYLE = { fontSize: 9, fill: "hsl(215 20% 55%)" };
const GRID_COLOR = "hsl(217 33% 17%)";

// ── Black-Scholes ────────────────────────────────────────────────────────────
function normalCDF(x) {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741,
        a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

function blackScholes({ S, K, T, r, sigma, type }) {
  if (T <= 0 || sigma <= 0 || S <= 0 || K <= 0) {
    return type === "call" ? Math.max(0, S - K) : Math.max(0, K - S);
  }
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  if (type === "call") return S * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2);
  return K * Math.exp(-r * T) * normalCDF(-d2) - S * normalCDF(-d1);
}

function calcGreeks({ S, K, T, r, sigma, type }) {
  if (T <= 0 || sigma <= 0) return { delta: 0, gamma: 0, theta: 0, vega: 0 };
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  const nd1 = Math.exp(-d1 * d1 / 2) / Math.sqrt(2 * Math.PI);
  const delta = type === "call" ? normalCDF(d1) : normalCDF(d1) - 1;
  const gamma = nd1 / (S * sigma * Math.sqrt(T));
  const theta = type === "call"
    ? (-(S * nd1 * sigma) / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * normalCDF(d2)) / 365
    : (-(S * nd1 * sigma) / (2 * Math.sqrt(T)) + r * K * Math.exp(-r * T) * normalCDF(-d2)) / 365;
  const vega = S * nd1 * Math.sqrt(T) / 100;
  return { delta, gamma, theta, vega };
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function calcDTE(expiryDateStr) {
  if (!expiryDateStr) return 30;
  const exp = new Date(expiryDateStr);
  const now = new Date();
  const dte = Math.max(0, Math.round((exp - now) / (1000 * 60 * 60 * 24)));
  return dte;
}

function newLeg(overrides = {}) {
  return {
    id: Date.now() + Math.random(),
    type: "call",
    side: "buy",
    strike: 200,
    premium: 5,
    qty: 1,
    iv: 80,
    ...overrides,
  };
}

const LEG_COLORS = ["#22C55E", "#60A5FA", "#F59E0B", "#A855F7", "#EF4444", "#06B6D4"];

const STRATEGY_PRESETS = [
  { label: "Long Call", legs: [{ type: "call", side: "buy" }] },
  { label: "Long Put", legs: [{ type: "put", side: "buy" }] },
  { label: "Short Call", legs: [{ type: "call", side: "sell" }] },
  { label: "Short Put", legs: [{ type: "put", side: "sell" }] },
  { label: "Bull Call Spread", legs: [{ type: "call", side: "buy" }, { type: "call", side: "sell", strikeOffset: 20 }] },
  { label: "Bear Put Spread", legs: [{ type: "put", side: "buy" }, { type: "put", side: "sell", strikeOffset: -20 }] },
  { label: "Straddle", legs: [{ type: "call", side: "buy" }, { type: "put", side: "buy" }] },
  { label: "Strangle", legs: [{ type: "call", side: "buy", strikeOffset: 20 }, { type: "put", side: "buy", strikeOffset: -20 }] },
  { label: "Iron Condor", legs: [{ type: "put", side: "buy", strikeOffset: -40 }, { type: "put", side: "sell", strikeOffset: -20 }, { type: "call", side: "sell", strikeOffset: 20 }, { type: "call", side: "buy", strikeOffset: 40 }] },
];

function Card({ children, className = "" }) {
  return <div className={`bg-card border border-border rounded-xl p-4 ${className}`}>{children}</div>;
}

// ── Leg Row ──────────────────────────────────────────────────────────────────
function LegRow({ leg, idx, color, onChange, onRemove, onDuplicate }) {
  const update = (field, val) => onChange({ ...leg, [field]: val });
  return (
    <div className="grid grid-cols-12 gap-2 items-end p-2.5 rounded-xl border border-border bg-secondary/20">
      {/* Color dot + label */}
      <div className="col-span-1 flex flex-col items-center gap-1">
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
        <span className="text-[9px] text-muted-foreground font-mono">L{idx + 1}</span>
      </div>

      {/* Type */}
      <div className="col-span-2">
        <Label className="text-[9px] text-muted-foreground">Type</Label>
        <div className="flex gap-0.5 mt-0.5">
          {["call", "put"].map(t => (
            <button key={t} onClick={() => update("type", t)}
              className={`flex-1 text-[9px] py-1 rounded border font-semibold capitalize transition-colors ${
                leg.type === t
                  ? t === "call" ? "bg-green-500/20 border-green-500 text-green-400" : "bg-red-500/20 border-red-500 text-red-400"
                  : "border-border text-muted-foreground hover:bg-secondary"
              }`}>{t}</button>
          ))}
        </div>
      </div>

      {/* Side */}
      <div className="col-span-2">
        <Label className="text-[9px] text-muted-foreground">Side</Label>
        <div className="flex gap-0.5 mt-0.5">
          {["buy", "sell"].map(s => (
            <button key={s} onClick={() => update("side", s)}
              className={`flex-1 text-[9px] py-1 rounded border font-semibold capitalize transition-colors ${
                leg.side === s
                  ? s === "buy" ? "bg-primary/20 border-primary text-primary" : "bg-amber-500/20 border-amber-500 text-amber-400"
                  : "border-border text-muted-foreground hover:bg-secondary"
              }`}>{s}</button>
          ))}
        </div>
      </div>

      {/* Strike */}
      <div className="col-span-2">
        <Label className="text-[9px] text-muted-foreground">Strike ($)</Label>
        <Input type="number" value={leg.strike}
          onChange={e => update("strike", Math.max(1, parseFloat(e.target.value) || 1))}
          className="h-7 text-xs font-mono bg-secondary border-border mt-0.5" step={5} />
      </div>

      {/* Premium */}
      <div className="col-span-2">
        <Label className="text-[9px] text-muted-foreground">Premium ($)</Label>
        <Input type="number" value={leg.premium}
          onChange={e => update("premium", Math.max(0, parseFloat(e.target.value) || 0))}
          className="h-7 text-xs font-mono bg-secondary border-border mt-0.5" step={0.01} />
      </div>

      {/* IV */}
      <div className="col-span-1">
        <Label className="text-[9px] text-muted-foreground">IV%</Label>
        <Input type="number" value={leg.iv}
          onChange={e => update("iv", Math.max(1, parseFloat(e.target.value) || 1))}
          className="h-7 text-xs font-mono bg-secondary border-border mt-0.5" step={5} />
      </div>

      {/* Qty */}
      <div className="col-span-1">
        <Label className="text-[9px] text-muted-foreground">Qty</Label>
        <Input type="number" value={leg.qty}
          onChange={e => update("qty", Math.max(1, parseInt(e.target.value) || 1))}
          className="h-7 text-xs font-mono bg-secondary border-border mt-0.5" min={1} />
      </div>

      {/* Actions */}
      <div className="col-span-1 flex gap-1 justify-end pb-0.5">
        <button onClick={onDuplicate} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Duplicate">
          <Copy className="w-3 h-3" />
        </button>
        <button onClick={onRemove} className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors" title="Remove">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function OptionsSimulator({ selectedContract, underlyingPrice: liveUnderlyingPrice, selectedExpiry, liveData }) {
  const [underlyingPrice, setUnderlyingPrice] = useState(liveUnderlyingPrice ?? 200);
  const [daysToExpiry, setDaysToExpiry] = useState(() => calcDTE(selectedExpiry));
  const [riskFreeRate, setRiskFreeRate] = useState(5);

  // Multi-leg state
  const [legs, setLegs] = useState([
    newLeg({
      type: selectedContract?.contract_type ?? "call",
      side: "buy",
      strike: selectedContract?.strike_price ?? 200,
      premium: selectedContract?.mid ?? 5,
      iv: selectedContract?.iv ?? 80,
    }),
  ]);

  // Sync underlying price
  useEffect(() => {
    if (liveUnderlyingPrice) setUnderlyingPrice(liveUnderlyingPrice);
  }, [liveUnderlyingPrice]);

  // Auto-update DTE when selectedExpiry changes
  useEffect(() => {
    if (selectedExpiry) setDaysToExpiry(calcDTE(selectedExpiry));
  }, [selectedExpiry]);

  // Sync first leg from selected contract
  useEffect(() => {
    if (selectedContract) {
      setLegs(prev => {
        const updated = [...prev];
        updated[0] = {
          ...updated[0],
          type: selectedContract.contract_type ?? "call",
          strike: selectedContract.strike_price ?? updated[0].strike,
          premium: selectedContract.mid ?? selectedContract.ask ?? updated[0].premium,
          iv: selectedContract.iv ?? updated[0].iv,
        };
        return updated;
      });
    }
  }, [selectedContract]);

  const T = daysToExpiry / 365;
  const r = riskFreeRate / 100;

  // ── Leg management ──
  const updateLeg = (id, updated) => setLegs(prev => prev.map(l => l.id === id ? updated : l));
  const removeLeg = (id) => setLegs(prev => prev.filter(l => l.id !== id));
  const addLeg = () => setLegs(prev => [...prev, newLeg({ strike: underlyingPrice, iv: prev[0]?.iv ?? 80 })]);
  const duplicateLeg = (leg) => setLegs(prev => [...prev, newLeg({ ...leg, id: Date.now() + Math.random() })]);

  const applyPreset = (preset) => {
    const baseLeg = legs[0];
    setLegs(preset.legs.map((p, i) => newLeg({
      type: p.type,
      side: p.side,
      strike: Math.round(underlyingPrice + (p.strikeOffset ?? 0)),
      premium: baseLeg?.premium ?? 5,
      iv: baseLeg?.iv ?? 80,
      qty: 1,
    })));
  };

  // ── Combined P&L data ──
  const pnlData = useMemo(() => {
    const low = underlyingPrice * 0.4;
    const high = underlyingPrice * 1.8;
    const steps = 80;
    const step = (high - low) / steps;

    return Array.from({ length: steps + 1 }, (_, i) => {
      const S = low + i * step;
      let pnl_now = 0, pnl_half = 0, pnl_expiry = 0;

      legs.forEach(leg => {
        const sigma = leg.iv / 100;
        const mult = leg.qty * 100 * (leg.side === "buy" ? 1 : -1);
        const T_half = T / 2;

        const payoff = leg.type === "call" ? Math.max(0, S - leg.strike) : Math.max(0, leg.strike - S);
        pnl_expiry += (payoff - leg.premium) * mult;

        const bsNow = blackScholes({ S, K: leg.strike, T, r, sigma, type: leg.type });
        pnl_now += (bsNow - leg.premium) * mult;

        const bsHalf = blackScholes({ S, K: leg.strike, T: T_half, r, sigma, type: leg.type });
        pnl_half += (bsHalf - leg.premium) * mult;
      });

      return {
        price: parseFloat(S.toFixed(2)),
        pnl_now: parseFloat(pnl_now.toFixed(0)),
        pnl_half: parseFloat(pnl_half.toFixed(0)),
        pnl_expiry: parseFloat(pnl_expiry.toFixed(0)),
      };
    });
  }, [legs, underlyingPrice, T, r]);

  // ── Net Greeks ──
  const netGreeks = useMemo(() => {
    let delta = 0, gamma = 0, theta = 0, vega = 0, totalCost = 0;
    legs.forEach(leg => {
      const sigma = leg.iv / 100;
      const mult = leg.qty * 100 * (leg.side === "buy" ? 1 : -1);
      const g = calcGreeks({ S: underlyingPrice, K: leg.strike, T, r, sigma, type: leg.type });
      delta += g.delta * mult;
      gamma += g.gamma * mult;
      theta += g.theta * mult;
      vega += g.vega * mult;
      totalCost += leg.premium * leg.qty * 100 * (leg.side === "buy" ? 1 : -1);
    });
    return { delta, gamma, theta, vega, totalCost };
  }, [legs, underlyingPrice, T, r]);

  // ── Breakevens (zero crossings in expiry P&L) ──
  const breakevens = useMemo(() => {
    const bps = [];
    for (let i = 1; i < pnlData.length; i++) {
      const prev = pnlData[i - 1], curr = pnlData[i];
      if (prev.pnl_expiry * curr.pnl_expiry < 0) {
        const x = prev.price + (curr.price - prev.price) * Math.abs(prev.pnl_expiry) / (Math.abs(prev.pnl_expiry) + Math.abs(curr.pnl_expiry));
        bps.push(parseFloat(x.toFixed(2)));
      }
    }
    return bps;
  }, [pnlData]);

  // ── Scenario table ──
  const scenarios = useMemo(() => {
    return [-50, -30, -20, -10, -5, 0, 5, 10, 20, 30, 50, 100].map(pct => {
      const S = underlyingPrice * (1 + pct / 100);
      let pnl = 0;
      legs.forEach(leg => {
        const mult = leg.qty * 100 * (leg.side === "buy" ? 1 : -1);
        const payoff = leg.type === "call" ? Math.max(0, S - leg.strike) : Math.max(0, leg.strike - S);
        pnl += (payoff - leg.premium) * mult;
      });
      const costAbs = Math.abs(netGreeks.totalCost);
      return { pct, price: S, pnl, pnlPct: costAbs > 0 ? (pnl / costAbs) * 100 : 0 };
    });
  }, [legs, underlyingPrice, netGreeks.totalCost]);

  return (
    <div className="space-y-4">
      {/* Global Parameters */}
      <Card>
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3">Global Parameters</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-[10px] text-muted-foreground">Underlying Price ($)</Label>
            <Input type="number" value={underlyingPrice}
              onChange={e => setUnderlyingPrice(Math.max(0.01, parseFloat(e.target.value) || 0))}
              className="h-8 text-sm font-mono bg-secondary border-border mt-1" step={1} />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Days to Expiry (DTE)</Label>
            <Input type="number" value={daysToExpiry}
              onChange={e => setDaysToExpiry(Math.max(0, parseInt(e.target.value) || 0))}
              className="h-8 text-sm font-mono bg-secondary border-border mt-1" min={0} />
            {selectedExpiry && (
              <p className="text-[9px] text-primary mt-0.5">Auto from expiry: {selectedExpiry}</p>
            )}
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Risk-Free Rate (%)</Label>
            <Input type="number" value={riskFreeRate}
              onChange={e => setRiskFreeRate(Math.max(0, parseFloat(e.target.value) || 0))}
              className="h-8 text-sm font-mono bg-secondary border-border mt-1" step={0.25} />
          </div>
          <div className="flex flex-col justify-end">
            <p className="text-[9px] text-muted-foreground">Net Position Cost</p>
            <p className={`text-base font-bold font-mono ${netGreeks.totalCost < 0 ? "text-destructive" : "text-green-400"}`}>
              {netGreeks.totalCost >= 0 ? "+" : ""}{formatCurrency(netGreeks.totalCost, 0)}
            </p>
            <p className="text-[9px] text-muted-foreground">{netGreeks.totalCost >= 0 ? "credit received" : "debit paid"}</p>
          </div>
        </div>
      </Card>

      {/* Option Legs */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Option Legs</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">{legs.length} leg{legs.length !== 1 ? "s" : ""} — combined P&L shown in chart below</p>
          </div>
          <button onClick={addLeg}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-primary text-primary hover:bg-primary/10 transition-colors font-semibold">
            <Plus className="w-3.5 h-3.5" /> Add Leg
          </button>
        </div>

        {/* Strategy Presets */}
        <div className="mb-3">
          <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">Strategy Presets</p>
          <div className="flex flex-wrap gap-1.5">
            {STRATEGY_PRESETS.map(p => (
              <button key={p.label} onClick={() => applyPreset(p)}
                className="text-[10px] px-2.5 py-1 rounded-lg border border-border text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors font-semibold">
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Leg rows */}
        <div className="space-y-2">
          {legs.map((leg, idx) => (
            <LegRow
              key={leg.id}
              leg={leg}
              idx={idx}
              color={LEG_COLORS[idx % LEG_COLORS.length]}
              onChange={(updated) => updateLeg(leg.id, updated)}
              onRemove={() => legs.length > 1 && removeLeg(leg.id)}
              onDuplicate={() => duplicateLeg(leg)}
            />
          ))}
        </div>

        {/* Per-leg BS summary */}
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-[9px]">
                <th className="text-left py-1.5 pr-2">Leg</th>
                <th className="text-right py-1.5 pr-2">BS Value</th>
                <th className="text-right py-1.5 pr-2">vs Premium</th>
                <th className="text-right py-1.5 pr-2">Delta</th>
                <th className="text-right py-1.5 pr-2">Theta/day</th>
                <th className="text-right py-1.5">Breakeven</th>
              </tr>
            </thead>
            <tbody>
              {legs.map((leg, idx) => {
                const sigma = leg.iv / 100;
                const bs = blackScholes({ S: underlyingPrice, K: leg.strike, T, r, sigma, type: leg.type });
                const g = calcGreeks({ S: underlyingPrice, K: leg.strike, T, r, sigma, type: leg.type });
                const mult = leg.qty * 100;
                const be = leg.type === "call" ? leg.strike + leg.premium : leg.strike - leg.premium;
                const diff = bs - leg.premium;
                return (
                  <tr key={leg.id} className="border-b border-border/30">
                    <td className="py-1.5 pr-2">
                      <span className="font-mono text-[9px] font-bold" style={{ color: LEG_COLORS[idx % LEG_COLORS.length] }}>L{idx + 1}</span>
                      <span className="text-muted-foreground ml-1 text-[9px]">{leg.side === "buy" ? "Long" : "Short"} {leg.strike} {leg.type}</span>
                    </td>
                    <td className="py-1.5 pr-2 text-right font-mono text-primary">${bs.toFixed(2)}</td>
                    <td className={`py-1.5 pr-2 text-right font-mono font-bold ${diff > 0 ? "text-green-400" : diff < 0 ? "text-red-400" : "text-muted-foreground"}`}>
                      {diff >= 0 ? "+" : ""}{diff.toFixed(2)}
                    </td>
                    <td className="py-1.5 pr-2 text-right font-mono text-cyan-400">{g.delta.toFixed(3)}</td>
                    <td className="py-1.5 pr-2 text-right font-mono text-red-400">${(g.theta * mult).toFixed(2)}</td>
                    <td className="py-1.5 text-right font-mono text-amber-400">${be.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Net Greeks */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: "Net Delta", value: netGreeks.delta.toFixed(2), color: "text-cyan-400", sub: "$ per $1 move" },
          { label: "Net Gamma", value: netGreeks.gamma.toFixed(4), color: "text-purple-400", sub: "delta/$ move" },
          { label: "Net Theta", value: `$${netGreeks.theta.toFixed(2)}/day`, color: "text-red-400", sub: "daily decay" },
          { label: "Net Vega", value: `$${netGreeks.vega.toFixed(2)}/1%`, color: "text-amber-400", sub: "per IV point" },
          { label: "Breakevens", value: breakevens.length > 0 ? breakevens.map(b => `$${b}`).join(" / ") : "N/A", color: "text-amber-400", sub: "at expiry" },
          { label: "Net Cost / Credit", value: `${netGreeks.totalCost >= 0 ? "+" : ""}${formatCurrency(netGreeks.totalCost, 0)}`, color: netGreeks.totalCost >= 0 ? "text-green-400" : "text-destructive", sub: netGreeks.totalCost >= 0 ? "credit" : "debit" },
        ].map(m => (
          <div key={m.label} className="p-2.5 bg-card border border-border rounded-xl text-center">
            <p className="text-[9px] text-muted-foreground leading-tight">{m.label}</p>
            <p className={`text-xs font-bold font-mono mt-0.5 ${m.color}`}>{m.value}</p>
            {m.sub && <p className="text-[8px] text-muted-foreground mt-0.5">{m.sub}</p>}
          </div>
        ))}
      </div>

      {/* Combined P&L Chart */}
      <Card>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">
          Combined P&L — {legs.length} Leg{legs.length !== 1 ? "s" : ""} · {daysToExpiry} DTE
          {selectedExpiry && <span className="text-primary ml-1">({selectedExpiry})</span>}
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={pnlData} margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
            <XAxis dataKey="price" tick={TICK_STYLE} tickFormatter={v => `$${parseFloat(v).toFixed(0)}`} />
            <YAxis tick={TICK_STYLE} tickFormatter={v => formatCurrency(v, 0)} />
            <Tooltip
              contentStyle={{ background: "hsl(222 47% 10%)", border: "1px solid hsl(217 33% 17%)", fontSize: 11 }}
              formatter={(v, name) => [formatCurrency(v, 0), name]}
              labelFormatter={l => `Stock @ $${parseFloat(l).toFixed(2)}`}
            />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <ReferenceLine y={0} stroke="#EF4444" strokeDasharray="4 2" strokeWidth={1.5} />
            <ReferenceLine x={underlyingPrice} stroke="hsl(217 33% 40%)" strokeDasharray="3 3"
              label={{ value: "Now", fontSize: 8, fill: "hsl(215 20% 55%)" }} />
            {breakevens.map((be, i) => (
              <ReferenceLine key={i} x={be} stroke="#F59E0B" strokeDasharray="3 3"
                label={{ value: `BE $${be}`, fontSize: 8, fill: "#F59E0B" }} />
            ))}
            <Line type="monotone" dataKey="pnl_now" stroke="#60A5FA" strokeWidth={1.5} name="P&L Now (BS)" dot={false} strokeDasharray="5 3" />
            <Line type="monotone" dataKey="pnl_half" stroke="#A78BFA" strokeWidth={1.5} name="P&L at 50% DTE" dot={false} strokeDasharray="3 2" />
            <Line type="monotone" dataKey="pnl_expiry" stroke="#22C55E" strokeWidth={2.5} name="P&L at Expiry" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Scenario table */}
      <Card>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Scenario Analysis — Combined P&L at Expiry</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-[9px]">
                <th className="text-left py-1.5 pr-3">Underlying Move</th>
                <th className="text-right py-1.5 pr-3">Stock Price</th>
                <th className="text-right py-1.5 pr-3">Combined P&L</th>
                <th className="text-right py-1.5">Return on Debit</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map(s => (
                <tr key={s.pct} className={`border-b border-border/30 ${s.pct === 0 ? "bg-secondary/40" : ""}`}>
                  <td className={`py-1.5 pr-3 font-mono font-bold ${s.pct < 0 ? "text-destructive" : s.pct === 0 ? "text-muted-foreground" : "text-primary"}`}>
                    {s.pct > 0 ? "+" : ""}{s.pct}%
                  </td>
                  <td className="py-1.5 pr-3 text-right font-mono text-foreground">${s.price.toFixed(2)}</td>
                  <td className={`py-1.5 pr-3 text-right font-mono font-bold ${s.pnl > 0 ? "text-green-400" : "text-destructive"}`}>
                    {formatCurrency(s.pnl, 0)}
                  </td>
                  <td className={`py-1.5 text-right font-mono ${s.pnl > 0 ? "text-green-400" : "text-destructive"}`}>
                    {isFinite(s.pnlPct) && s.pnlPct !== 0 ? `${s.pnlPct > 0 ? "+" : ""}${s.pnlPct.toFixed(0)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-[9px] text-muted-foreground/50 text-center">
        Black-Scholes pricing. Assumes European-style options and no dividends. For illustrative purposes only.
      </p>
    </div>
  );
}