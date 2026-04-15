import React from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, AreaChart } from "recharts";
import { formatCurrency } from "@/lib/calculations";

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload) return null;
  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-xl">
      <p className="text-xs font-medium text-muted-foreground mb-2">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-mono font-medium text-foreground">
            {typeof entry.value === "number" && entry.value > 100
              ? formatCurrency(entry.value)
              : typeof entry.value === "number"
              ? entry.value.toFixed(2)
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function ProjectionChart({ data, lines, title, height = 300, type = "line" }) {
  const ChartComponent = type === "area" ? AreaChart : LineChart;
  const DataComponent = type === "area" ? Area : Line;

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      {title && <h3 className="text-sm font-semibold text-foreground mb-4">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <ChartComponent data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
          <XAxis
            dataKey="label"
            tick={{ fill: "hsl(215 20% 55%)", fontSize: 10 }}
            axisLine={{ stroke: "hsl(217 33% 17%)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "hsl(215 20% 55%)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => (v >= 1000 ? formatCurrency(v) : v.toFixed(1))}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            iconType="circle"
            iconSize={8}
          />
          {lines.map((line) => (
            <DataComponent
              key={line.key}
              type="monotone"
              dataKey={line.key}
              name={line.name}
              stroke={line.color}
              fill={type === "area" ? `${line.color}20` : undefined}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          ))}
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  );
}