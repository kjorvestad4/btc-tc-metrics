import React, { useState, useMemo, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { formatCurrency } from "@/lib/calculations";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend, AreaChart, Area,
} from "recharts";

const TICK_STYLE = { fontSize: 9, fill: "hsl(215 20% 55%)" };
const GRID_COLOR = "hsl(217 33% 17%)";

/**
 * Black-Scholes pricing model
 */
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
    // At expiration
    if (type === "call") return Math.max(0, S - K);
    return Math.max(0, K - S);
  }
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  if (type === "call") {
    return S * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2);
  } else {
    return K * Math.exp(-r * T) * normalCDF(-d2) - S * normalCDF(-d1);
  }
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

const STRATEGY_PRESETS = [
  { id: "long_call", label: "Long Call", legs: [{ type: "call", side: "buy", qty: 1 }] },
  { id: "long_put", label: "Long Put", legs: [{ type: "put", side: "buy", qty: 1 }] },
  { id: "covered_call", label: "Covered Call", legs: [{ type: "call", side: "sell", qty: 1 }], note: "Assumes 100 shares of underlying" },
  { id: "cash_secured_put", label: "Cash-Secured Put", legs: [{ type: "put", side: "sell", qty: 1 }] },
  { id: "bull_call_spread", label: "Bull Call Spread", legs: [{ type: "call", side: "buy", qty: 1 }, { type: "call", side: "sell", qty: 1, strikeOffset: 20 }] },
  { id: "bear_put_spread", label: "Bear Put Spread", legs: [{ type: "put", side: "buy", qty: 1 }, { type: "put", side: "sell", qty: 1, strikeOffset: -20 }] },
  { id: "straddle", label: "Long Straddle", legs: [{ type: "call", side: "buy", qty: 1 }, { type: "put", side: "buy", qty: 1 }] },
  { id: "strangle", label: "Long Strangle", legs: [{ type: "call", side: "buy", qty: 1, strikeOffset: 20 }, { type: "put", side: "buy", qty: 1, strikeOffset: -20 }] },
];

function Card({ children, className = "" }) {
  return <div className={`bg-card border border-border rounded-xl p-4 ${className}`}>{children}</div>;
}

export default function OptionsSimulator({ selectedContract, underlyingPrice: liveUnderlyingPrice }) {
  // Position parameters
  const [contractType, setContractType] = useState(selectedContract?.contract_type ?? "call");
  const [strikePrice, setStrikePrice] = useState(selectedContract?.strike_price ?? 200);
  const [premium, setPremium] = useState(selectedContract?.mid ?? 10);
  const [contracts, setContracts] = useState(1);
  const [daysToExpiry, setDaysToExpiry] = useState(30);
  const [iv, setIv] = useState(selectedContract?.iv ?? 80);
  const [underlyingPrice, setUnderlyingPrice] = useState(liveUnderlyingPrice ?? 200);
  const [riskFreeRate, setRiskFreeRate] = useState(5);
  const [side, setSide] = useState("buy"); // buy | sell
  const [strategy, setStrategy] = useState("single"); // single | preset
  const [selectedPreset, setSelectedPreset] = useState("long_call");

  // Sync from selected contract
  React.useEffect(() => {
    if (selectedContract) {
      setContractType(selectedContract.contract_type ?? "call");
      setStrikePrice(selectedContract.strike_price ?? 200);
      setPremium(selectedContract.mid ?? selectedContract.ask ?? 10);
      if (selectedContract.iv) setIv(selectedContract.iv);
    }
  }, [selectedContract]);

  React.useEffect(() => {
    if (liveUnderlyingPrice) setUnderlyingPrice(liveUnderlyingPrice);
  }, [liveUnderlyingPrice]);

  // Black-Scholes at current parameters
  const T = daysToExpiry / 365;
  const sigma = iv / 100;
  const r = riskFreeRate / 100;

  const bsPrice = blackScholes({ S: underlyingPrice, K: strikePrice, T, r, sigma, type: contractType });
  const greeks = calcGreeks({ S: underlyingPrice, K: strikePrice, T, r, sigma, type: contractType });

  // P&L at expiration across a range of underlying prices
  const pnlData = useMemo(() => {
    const low = underlyingPrice * 0.4;
    const high = underlyingPrice * 1.8;
    const steps = 80;
    const step = (high - low) / steps;
    const multiplier = contracts * 100;

    return Array.from({ length: steps + 1 }, (_, i) => {
      const S = low + i * step;
      // P&L at expiry
      let payoff = 0;
      if (contractType === "call") payoff = Math.max(0, S - strikePrice);
      else payoff = Math.max(0, strikePrice - S);
      const pnl_expiry = (payoff - premium) * multiplier * (side === "buy" ? 1 : -1);

      // Current theoretical P&L (using BS)
      const currentBS = blackScholes({ S, K: strikePrice, T, r, sigma, type: contractType });
      const pnl_now = (currentBS - premium) * multiplier * (side === "buy" ? 1 : -1);

      // P&L at 50% of time elapsed
      const T_half = T / 2;
      const halfBS = blackScholes({ S, K: strikePrice, T: T_half, r, sigma, type: contractType });
      const pnl_half = (halfBS - premium) * multiplier * (side === "buy" ? 1 : -1);

      return {
        price: parseFloat(S.toFixed(2)),
        pnl_now: parseFloat(pnl_now.toFixed(0)),
        pnl_half: parseFloat(pnl_half.toFixed(0)),
        pnl_expiry: parseFloat(pnl_expiry.toFixed(0)),
      };
    });
  }, [underlyingPrice, strikePrice, premium, contracts, contractType, side, T, sigma, r]);

  // Key metrics
  const multiplier = contracts * 100;
  const maxLoss = side === "buy" ? -premium * multiplier : Infinity;
  const maxGain = side === "buy"
    ? (contractType === "call" ? Infinity : strikePrice * multiplier - premium * multiplier)
    : premium * multiplier;
  const breakeven = contractType === "call"
    ? strikePrice + premium
    : strikePrice - premium;
  const costBasis = premium * multiplier * (side === "buy" ? 1 : -1);
  const intrinsic = contractType === "call"
    ? Math.max(0, underlyingPrice - strikePrice)
    : Math.max(0, strikePrice - underlyingPrice);
  const timeValue = Math.max(0, bsPrice - intrinsic);
  const isItm = contractType === "call" ? underlyingPrice > strikePrice : underlyingPrice < strikePrice;

  // Scenario table: what happens at specific % moves
  const scenarios = useMemo(() => {
    return [-50, -30, -20, -10, -5, 0, 5, 10, 20, 30, 50, 100].map(pct => {
      const S = underlyingPrice * (1 + pct / 100);
      let payoff = contractType === "call" ? Math.max(0, S - strikePrice) : Math.max(0, strikePrice - S);
      const pnl = (payoff - premium) * multiplier * (side === "buy" ? 1 : -1);
      const pnlPct = costBasis !== 0 ? (pnl / Math.abs(costBasis)) * 100 : 0;
      return { pct, price: S, pnl, pnlPct };
    });
  }, [underlyingPrice, strikePrice, premium, multiplier, contractType, side, costBasis]);

  const typeColor = contractType === "call" ? "text-green-400" : "text-red-400";
  const sideColor = side === "buy" ? "text-primary" : "text-amber-400";

  return (
    <div className="space-y-4">
      {/* Contract selector */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-2 h-2 rounded-full ${contractType === "call" ? "bg-green-400" : "bg-red-400"}`} />
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Contract Parameters</h3>
          {selectedContract && (
            <span className="text-[10px] text-primary bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5 ml-auto">
              Loaded from chain: {selectedContract.ticker}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {/* Type */}
          <div>
            <Label className="text-[10px] text-muted-foreground">Contract Type</Label>
            <div className="flex gap-1 mt-1">
              {["call", "put"].map(t => (
                <button key={t} onClick={() => setContractType(t)}
                  className={`flex-1 text-xs py-1.5 rounded-lg border font-semibold capitalize transition-colors ${
                    contractType === t
                      ? t === "call" ? "bg-green-500/20 border-green-500 text-green-400" : "bg-red-500/20 border-red-500 text-red-400"
                      : "border-border text-muted-foreground hover:bg-secondary"
                  }`}>{t}
                </button>
              ))}
            </div>
          </div>

          {/* Side */}
          <div>
            <Label className="text-[10px] text-muted-foreground">Position</Label>
            <div className="flex gap-1 mt-1">
              {["buy", "sell"].map(s => (
                <button key={s} onClick={() => setSide(s)}
                  className={`flex-1 text-xs py-1.5 rounded-lg border font-semibold capitalize transition-colors ${
                    side === s
                      ? s === "buy" ? "bg-primary/20 border-primary text-primary" : "bg-amber-500/20 border-amber-500 text-amber-400"
                      : "border-border text-muted-foreground hover:bg-secondary"
                  }`}>{s}
                </button>
              ))}
            </div>
          </div>

          {/* Strike */}
          <div>
            <Label className="text-[10px] text-muted-foreground">Strike Price ($)</Label>
            <Input type="number" value={strikePrice} onChange={e => setStrikePrice(Math.max(1, parseFloat(e.target.value) || 0))}
              className="h-8 text-sm font-mono bg-secondary border-border mt-1" step={5} />
          </div>

          {/* Contracts */}
          <div>
            <Label className="text-[10px] text-muted-foreground">Contracts (#)</Label>
            <Input type="number" value={contracts} onChange={e => setContracts(Math.max(1, parseInt(e.target.value) || 1))}
              className="h-8 text-sm font-mono bg-secondary border-border mt-1" min={1} />
          </div>

          {/* Premium */}
          <div>
            <Label className="text-[10px] text-muted-foreground">Premium / Contract ($)</Label>
            <Input type="number" value={premium} onChange={e => setPremium(Math.max(0, parseFloat(e.target.value) || 0))}
              className="h-8 text-sm font-mono bg-secondary border-border mt-1" step={0.01} />
            <p className="text-[9px] text-muted-foreground mt-0.5">Total cost: <span className="text-foreground font-mono">{formatCurrency(Math.abs(costBasis), 0)}</span></p>
          </div>

          {/* DTE */}
          <div>
            <Label className="text-[10px] text-muted-foreground">Days to Expiry (DTE)</Label>
            <Input type="number" value={daysToExpiry} onChange={e => setDaysToExpiry(Math.max(0, parseInt(e.target.value) || 0))}
              className="h-8 text-sm font-mono bg-secondary border-border mt-1" min={0} />
          </div>

          {/* Underlying price */}
          <div>
            <Label className="text-[10px] text-muted-foreground">Underlying Price ($)</Label>
            <Input type="number" value={underlyingPrice} onChange={e => setUnderlyingPrice(Math.max(0.01, parseFloat(e.target.value) || 0))}
              className="h-8 text-sm font-mono bg-secondary border-border mt-1" step={1} />
          </div>

          {/* IV */}
          <div>
            <Label className="text-[10px] text-muted-foreground">Implied Volatility (%)</Label>
            <Input type="number" value={iv} onChange={e => setIv(Math.max(1, parseFloat(e.target.value) || 0))}
              className="h-8 text-sm font-mono bg-secondary border-border mt-1" step={1} />
          </div>
        </div>

        {/* IV slider */}
        <div className="space-y-1.5 p-3 bg-secondary/30 rounded-xl border border-border">
          <div className="flex justify-between">
            <Label className="text-[10px] text-muted-foreground">Implied Volatility (σ)</Label>
            <span className="text-[10px] font-mono text-amber-400 font-bold">{iv}%</span>
          </div>
          <Slider value={[iv]} onValueChange={([v]) => setIv(v)} min={5} max={300} step={5} />
          <p className="text-[9px] text-muted-foreground">MSTR historical 1Y vol ≈ 80%. Higher IV = more expensive options.</p>
        </div>
      </Card>

      {/* Key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: "BS Theoretical Value", value: `$${bsPrice.toFixed(2)}`, color: "text-primary", sub: premium > 0 ? (bsPrice > premium ? "Underpriced ✓" : "Overpriced ⚠") : "" },
          { label: "Breakeven at Expiry", value: `$${breakeven.toFixed(2)}`, color: "text-amber-400", sub: `${((breakeven / underlyingPrice - 1) * 100).toFixed(1)}% from now` },
          { label: "Max Loss", value: isFinite(maxLoss) ? formatCurrency(maxLoss, 0) : "Unlimited", color: "text-destructive", sub: side === "sell" && contractType === "call" ? "Theoretically unlimited" : "" },
          { label: "Max Gain", value: isFinite(maxGain) ? formatCurrency(maxGain, 0) : "Unlimited", color: "text-green-400", sub: side === "buy" && contractType === "call" ? "Unlimited upside" : "" },
          { label: "Delta", value: greeks.delta.toFixed(3), color: "text-cyan-400", sub: `${(greeks.delta * 100).toFixed(0)} delta cents/$ move` },
          { label: "Theta", value: `$${(greeks.theta * multiplier).toFixed(2)}/day`, color: "text-red-400", sub: "daily time decay" },
          { label: "Intrinsic / Time", value: `$${intrinsic.toFixed(2)} / $${timeValue.toFixed(2)}`, color: isItm ? "text-primary" : "text-muted-foreground", sub: isItm ? "In the money" : "Out of the money" },
        ].map(m => (
          <div key={m.label} className="p-2.5 bg-card border border-border rounded-xl text-center">
            <p className="text-[9px] text-muted-foreground leading-tight">{m.label}</p>
            <p className={`text-xs font-bold font-mono mt-0.5 ${m.color}`}>{m.value}</p>
            {m.sub && <p className="text-[8px] text-muted-foreground mt-0.5">{m.sub}</p>}
          </div>
        ))}
      </div>

      {/* P&L Chart */}
      <Card>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">
          Profit & Loss at Expiry — {contracts} {contractType}(s) @ ${strikePrice} strike ({side === "buy" ? "Long" : "Short"})
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={pnlData} margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
            <XAxis dataKey="price" tick={TICK_STYLE} tickFormatter={v => `$${v.toFixed(0)}`} />
            <YAxis tick={TICK_STYLE} tickFormatter={v => formatCurrency(v, 0)} />
            <Tooltip
              contentStyle={{ background: "hsl(222 47% 10%)", border: "1px solid hsl(217 33% 17%)", fontSize: 11 }}
              formatter={(v, name) => [formatCurrency(v, 0), name]}
              labelFormatter={l => `Stock @ $${parseFloat(l).toFixed(2)}`}
            />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <ReferenceLine y={0} stroke="#EF4444" strokeDasharray="4 2" strokeWidth={1.5} />
            <ReferenceLine x={underlyingPrice} stroke="hsl(217 33% 40%)" strokeDasharray="3 3" label={{ value: "Now", fontSize: 8, fill: "hsl(215 20% 55%)" }} />
            <ReferenceLine x={breakeven} stroke="#F59E0B" strokeDasharray="3 3" label={{ value: "BE", fontSize: 8, fill: "#F59E0B" }} />
            <Line type="monotone" dataKey="pnl_now" stroke="#60A5FA" strokeWidth={1.5} name="P&L Now (BS)" dot={false} strokeDasharray="5 3" />
            <Line type="monotone" dataKey="pnl_half" stroke="#A78BFA" strokeWidth={1.5} name="P&L at 50% DTE" dot={false} strokeDasharray="3 2" />
            <Line type="monotone" dataKey="pnl_expiry" stroke={contractType === "call" ? "#22C55E" : "#EF4444"} strokeWidth={2.5} name="P&L at Expiry" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Scenario table */}
      <Card>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Scenario Analysis — P&L at Expiry by Underlying Move</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-[9px]">
                <th className="text-left py-1.5 pr-3 font-medium">Underlying Move</th>
                <th className="text-right py-1.5 pr-3 font-medium">Stock Price</th>
                <th className="text-right py-1.5 pr-3 font-medium">P&L</th>
                <th className="text-right py-1.5 font-medium">Return on Premium</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map(s => {
                const isGain = s.pnl > 0;
                const isBreakeven = Math.abs(s.pnl) < Math.abs(costBasis) * 0.02;
                return (
                  <tr key={s.pct} className={`border-b border-border/30 ${s.pct === 0 ? "bg-secondary/40" : ""}`}>
                    <td className={`py-1.5 pr-3 font-mono font-bold ${s.pct < 0 ? "text-destructive" : s.pct === 0 ? "text-muted-foreground" : "text-primary"}`}>
                      {s.pct > 0 ? "+" : ""}{s.pct}%
                    </td>
                    <td className="py-1.5 pr-3 text-right font-mono text-foreground">${s.price.toFixed(2)}</td>
                    <td className={`py-1.5 pr-3 text-right font-mono font-bold ${isGain ? "text-green-400" : "text-destructive"}`}>
                      {formatCurrency(s.pnl, 0)}
                    </td>
                    <td className={`py-1.5 text-right font-mono ${isGain ? "text-green-400" : "text-destructive"}`}>
                      {isFinite(s.pnlPct) ? `${s.pnlPct > 0 ? "+" : ""}${s.pnlPct.toFixed(0)}%` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Greeks summary */}
        <div className="mt-4 p-3 bg-secondary/30 rounded-xl border border-border">
          <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider mb-2">Full Greeks (per {contracts} contract{contracts > 1 ? "s" : ""})</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { name: "Delta (Δ)", val: (greeks.delta * multiplier).toFixed(2), desc: "$ move per $1 underlying move", color: "text-cyan-400" },
              { name: "Gamma (Γ)", val: (greeks.gamma * multiplier).toFixed(4), desc: "Delta change per $1 underlying move", color: "text-purple-400" },
              { name: "Theta (Θ)", val: `$${(greeks.theta * multiplier).toFixed(2)}/day`, desc: "Daily time decay (negative = cost)", color: "text-red-400" },
              { name: "Vega (ν)", val: `$${(greeks.vega * multiplier).toFixed(2)}/1% IV`, desc: "P&L change per 1% IV move", color: "text-amber-400" },
            ].map(g => (
              <div key={g.name} className="p-2 bg-secondary/40 rounded-lg border border-border">
                <p className={`text-xs font-bold font-mono ${g.color}`}>{g.val}</p>
                <p className="text-[9px] text-foreground font-semibold mt-0.5">{g.name}</p>
                <p className="text-[8px] text-muted-foreground mt-0.5">{g.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <p className="text-[9px] text-muted-foreground/50 text-center">
        Black-Scholes pricing model. Assumes European-style options and no dividends. For illustrative purposes only. Not financial advice.
      </p>
    </div>
  );
}