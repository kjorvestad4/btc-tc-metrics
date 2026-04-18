import React from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

export default function MetricCard({ title, value, subtitle, icon: Icon, trend, trendLabel, tooltip, accentClass = "text-primary" }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-all duration-300 group">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          {Icon && <Icon className={`w-4 h-4 ${accentClass}`} />}
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</span>
        </div>
        {tooltip &&
        <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="w-3.5 h-3.5 text-muted-foreground/50 hover:text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                {tooltip}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        }
      </div>
      <div className={`text-2xl font-bold font-mono tracking-tight ${accentClass}`}>
        {value}
      </div>
      <div className="flex items-center justify-between mt-1.5">
        {subtitle && <span className="text-xs text-muted-foreground hidden">{subtitle}</span>}
        {trend !== undefined &&
        <span className={`text-xs font-medium ${trend >= 0 ? "text-green-400" : "text-red-400"}`}>
            {trend >= 0 ? "▲" : "▼"} {trendLabel || `${Math.abs(trend).toFixed(1)}%`}
          </span>
        }
      </div>
    </div>);

}