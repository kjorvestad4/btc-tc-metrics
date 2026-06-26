import React from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Line,
} from "recharts";
import { TrendingUp } from "lucide-react";

const TICK = { fontSize: 9, fill: "hsl(215 20% 55%)" };
const GRID = "hsl(217 33% 17%)";

function formatPrice(v) {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v?.toFixed(0)}`;
}

export default function BTCEngineChart({ simResult, startPrice, scenario }) {
  if (!simResult) return null;
  const { chartData, percentiles } = simResult;

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4" style={{ color: scenario.color }} />
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            {scenario.label} — Price Distribution ({simResult.params.simulations} sims)
          </h3>
        </div>
        <div className="flex gap-2 text-[10px]">
          {[
            { label: "p5", value: percentiles.p5, color: "#EF4444" },
            { label: "p50", value: percentiles.p50, color: "#F59E0B" },
            { label: "p95", value: percentiles.p95, color: "#22C55E" },
          ].map(p => (
            <div key={p.label} className="px-2 py-1 rounded-lg border border-border bg-secondary/50">
              <span className="text-muted-foreground">{p.label}: </span>
              <span className="font-mono font-bold" style={{ color: p.color }}>{formatPrice(p.value)}</span>
            </div>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={360}>
        <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 20, left: 4 }}>
          <defs>
            <linearGradient id="p95p5" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={scenario.color} stopOpacity={0.08} />
              <stop offset="100%" stopColor={scenario.color} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="p75p25" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={scenario.color} stopOpacity={0.2} />
              <stop offset="100%" stopColor={scenario.color} stopOpacity={0.08} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
          <XAxis dataKey="months" tick={TICK} label={{ value: "Months Ahead", position: "insideBottom", offset: -8, fontSize: 9, fill: "hsl(215 20% 55%)" }} />
          <YAxis tick={TICK} tickFormatter={formatPrice} scale="log" domain={[startPrice * 0.1, "auto"]} />
          <Tooltip
            contentStyle={{ background: "hsl(222 47% 10%)", border: "1px solid hsl(217 33% 17%)", borderRadius: 6, fontSize: 11 }}
            formatter={(v) => formatPrice(v)}
            labelFormatter={(l) => `Month ${l}`}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
          {/* p5–p95 outer band */}
          <Area type="monotone" dataKey="p95" name="p95 (bull)" stroke="none" fill="url(#p95p5)" />
          <Area type="monotone" dataKey="p5" name="p5 (bear)" stroke="none" fill="hsl(222 47% 8%)" />
          {/* p25–p75 inner band */}
          <Area type="monotone" dataKey="p75" name="p75" stroke="none" fill="url(#p75p25)" />
          <Area type="monotone" dataKey="p25" name="p25" stroke="none" fill="hsl(222 47% 8%)" />
          {/* Median line */}
          <Line type="monotone" dataKey="p50" name="p50 (median)" stroke={scenario.color} strokeWidth={2.5} dot={false} />
        </AreaChart>
      </ResponsiveContainer>

      <p className="text-[9px] text-muted-foreground/50 mt-2">
        Log scale. Shaded bands: p5–p95 (outer) and p25–p75 (inner). Median line = p50.
        {scenario.description && ` ${scenario.description}.`}
      </p>
    </div>
  );
}