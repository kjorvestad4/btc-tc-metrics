import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

function MiniSparkline({ data, color }) {
  if (!data || data.length < 2) return null;
  const w = 36;
  const h = 14;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} className="shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function PricePill({
  label,
  priceStr,
  changePct,
  sparkline,
  bgClass,
  textClass,
  borderClass,
}) {
  const hasChange = changePct != null;
  const isUp = hasChange && changePct >= 0;
  const sparkColor = isUp ? "#22C55E" : "#EF4444";

  return (
    <div
      className={`flex items-center gap-1 text-[10px] font-mono ${bgClass} ${textClass} ${borderClass} border rounded px-2 py-0.5`}
    >
      <span className="font-bold">{label}</span>
      <span>{priceStr}</span>
      {hasChange && (
        <span
          className={`flex items-center gap-0.5 ${isUp ? "text-green-400" : "text-red-400"}`}
        >
          {isUp ? (
            <TrendingUp className="w-2.5 h-2.5" />
          ) : (
            <TrendingDown className="w-2.5 h-2.5" />
          )}
          {isUp ? "+" : ""}
          {changePct.toFixed(2)}%
        </span>
      )}
      {sparkline && sparkline.length > 1 && (
        <MiniSparkline data={sparkline} color={sparkColor} />
      )}
    </div>
  );
}