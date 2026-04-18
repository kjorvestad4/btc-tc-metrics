import React from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Zap, CheckCircle2, AlertCircle, Clock } from "lucide-react";

export default function Navbar({ onRefresh, refreshing, liveData, hasPolygonKey, params }) {
  const btcPrice = liveData?.btc_price ?? params?.btc_price;
  const mstrPrice = liveData?.mstr_price ?? params?.mstr_price;
  const asstPrice = liveData?.asst_price ?? params?.asst_price;

  return (
    <header className="h-14 border-b border-border bg-card/80 backdrop-blur-sm flex items-center justify-between px-4 sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-bold text-foreground">Strategy Dashboard</p>
            <p className="text-[10px] text-muted-foreground leading-none mt-0.5">BTC Treasury Analytics</p>
          </div>
        </div>

        {/* Price pills — always visible */}
        <div className="hidden md:flex items-center gap-2 ml-2">
          {btcPrice && (
            <span className="text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded px-2 py-0.5">
              BTC ${Math.round(btcPrice).toLocaleString()}
            </span>
          )}
          {mstrPrice && (
            <span className="text-[10px] font-mono bg-primary/10 text-primary border border-primary/20 rounded px-2 py-0.5">
              MSTR ${parseFloat(mstrPrice).toFixed(2)}
            </span>
          )}
          {asstPrice && (
            <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded px-2 py-0.5">
              ASST ${parseFloat(asstPrice).toFixed(2)}
            </span>
          )}
          {liveData && (liveData.errors?.length === 0 ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {!hasPolygonKey && (
          <span className="hidden lg:inline text-[10px] text-amber-400/70 font-medium">
            Add Polygon key on Overview for full live data
          </span>
        )}
        <div className="hidden sm:flex items-center gap-1 text-[9px] text-muted-foreground">
          <Clock className="w-3 h-3" />
          auto-refresh 60s
        </div>
        <Button
          variant="default"
          size="sm"
          className="h-8 text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          onClick={onRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">{refreshing ? "Fetching…" : "Refresh Now"}</span>
        </Button>
      </div>
    </header>
  );
}