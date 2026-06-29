import React from "react";
import {
  ComposedChart, Line, Area, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Cell, Label,
} from "recharts";
import { Radio } from "lucide-react";

const TICK = { fontSize: 9, fill: "hsl(215 20% 55%)" };
const GRID = "hsl(217 33% 17%)";

function formatPrice(v) {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${Math.round(v)}`;
}

export default function InteractiveOracle({ simResult, startPrice, scenario, onChainData }) {
  if (!simResult) return null;
  const { chartData, percentiles } = simResult;

  // On-chain bar data — matches Plotly demo: Hashrate Health, Treasury Herding Signal, Realized Cap Ratio
  const onChainBars = [
    { label: "Hashrate\nHealth", value: onChainData?.hash_health ?? 0.94, color: "#22C55E", display: (onChainData?.hash_health ?? 0.94).toFixed(2) },
    { label: "Treasury\nHerding", value: onChainData?.drift_signal ?? 1.62, color: "#F59E0B", display: (onChainData?.drift_signal ?? 1.62).toFixed(2) },
    { label: "Realized\nCap Ratio", value: onChainData?.realized_cap_ratio ?? 1.18, color: "#60A5FA", display: (onChainData?.realized_cap_ratio ?? 1.18).toFixed(2) },
  ];

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      {/* Title */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            Interactive Price Oracle Dashboard
          </h3>
        </div>
        {onChainData?.polled && (
          <span className="text-[9px] bg-primary/15 text-primary border border-primary/25 rounded-full px-2 py-0.5 font-medium animate-pulse">
            ● LIVE
          </span>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground mb-2" style={{ color: scenario.color }}>
        BTC Price Fan Chart — {scenario.label} Scenario
      </p>

      {/* Top panel: Price Fan Chart (62.5%) */}
      <ResponsiveContainer width="100%" height={380}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 4 }}>
          <defs>
            <linearGradient id="oracleBand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
          <XAxis dataKey="dateLabel" tick={TICK} interval="preserveStartEnd" minTickGap={40} />
          <YAxis tick={TICK} tickFormatter={formatPrice} scale="log" domain={[startPrice * 0.1, "auto"]} />
          <Tooltip
            contentStyle={{ background: "hsl(222 47% 10%)", border: "1px solid hsl(217 33% 17%)", borderRadius: 6, fontSize: 11 }}
            formatter={(v) => formatPrice(v)}
            labelFormatter={(l) => l}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
          <Area type="monotone" dataKey="p95" name="Bull Case (p95)" stroke="none" fill="url(#oracleBand)" />
          <Area type="monotone" dataKey="p5" name="Bear Case (p5)" stroke="none" fill="hsl(222 47% 8%)" />
          <Line type="monotone" dataKey="p50" name="Median (p50)" stroke="#3B82F6" strokeWidth={2.5} dot={false} />
          <Line type="monotone" dataKey="current" name="Current Price" stroke="#EF553B" strokeWidth={2} dot={false} strokeDasharray="5 3" />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Bottom panel: On-Chain Live Updater Panel (37.5%) */}
      <div className="mt-4 border-t border-border pt-3">
        <p className="text-[10px] text-muted-foreground mb-2">On-Chain Live Updater Panel</p>
        <ResponsiveContainer width="100%" height={180}>
          <ComposedChart data={onChainBars} margin={{ top: 8, right: 8, bottom: 20, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: "hsl(215 20% 55%)" }} />
            <YAxis tick={TICK} domain={[0, 2]} />
            <Tooltip
              contentStyle={{ background: "hsl(222 47% 10%)", border: "1px solid hsl(217 33% 17%)", borderRadius: 6, fontSize: 11 }}
              formatter={(v) => v?.toFixed(2)}
            />
            <Bar dataKey="value" name="Signal" radius={[4, 4, 0, 0]} barSize={80}>
              {onChainBars.map((b, i) => (
                <Cell key={i} fill={b.color} />
              ))}
            </Bar>
            <Label position="top" />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="flex justify-center gap-6 mt-1">
          {onChainBars.map((b) => (
            <div key={b.label} className="text-center">
              <p className="text-[9px] text-muted-foreground whitespace-pre-line">{b.label}</p>
              <p className="text-sm font-bold font-mono" style={{ color: b.color }}>{b.display}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}