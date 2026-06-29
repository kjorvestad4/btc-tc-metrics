import React from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Zap, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import SyncStatusIndicator from "@/components/dashboard/SyncStatusIndicator";
import PricePill from "@/components/dashboard/PricePill";

export default function Navbar({ onRefresh, refreshing, liveData, hasPolygonKey, params, lastSynced }) {
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
            <p className="text-xs font-bold text-foreground">BTC TC Metrics</p>
            
          </div>
        </div>

        {/* Price pills — always visible */}
        <div className="hidden md:flex items-center gap-2 ml-2">
          {btcPrice && (
            <PricePill
              label="BTC"
              priceStr={`$${Math.round(btcPrice).toLocaleString()}`}
              changePct={liveData?.sparklines?.BTC?.change_pct}
              sparkline={liveData?.sparklines?.BTC?.sparkline}
              bgClass="bg-amber-500/10"
              textClass="text-amber-400"
              borderClass="border-amber-500/20"
            />
          )}
          {mstrPrice && (
            <PricePill
              label="MSTR"
              priceStr={`$${parseFloat(mstrPrice).toFixed(2)}`}
              changePct={liveData?.sparklines?.MSTR?.change_pct}
              sparkline={liveData?.sparklines?.MSTR?.sparkline}
              bgClass="bg-primary/10"
              textClass="text-primary"
              borderClass="border-primary/20"
            />
          )}
          {asstPrice && (
            <PricePill
              label="ASST"
              priceStr={`$${parseFloat(asstPrice).toFixed(2)}`}
              changePct={liveData?.sparklines?.ASST?.change_pct}
              sparkline={liveData?.sparklines?.ASST?.sparkline}
              bgClass="bg-blue-500/10"
              textClass="text-blue-400"
              borderClass="border-blue-500/20"
            />
          )}
          {liveData && (liveData.errors?.length === 0 ?
          <CheckCircle2 className="w-3.5 h-3.5 text-primary" /> :

          <AlertCircle className="w-3.5 h-3.5 text-amber-400" />)
          }
        </div>
      </div>

      <div className="flex items-center gap-2">
        {!hasPolygonKey &&
        <span className="hidden lg:inline text-[10px] text-amber-400/70 font-medium">
            Add Polygon key on Overview for full live data
          </span>
        }
        <div className="hidden sm:flex items-center gap-2">
          <SyncStatusIndicator refreshing={refreshing} lastSynced={lastSynced} />
          <div className="hidden md:flex items-center gap-1 text-[9px] text-muted-foreground">
            <Clock className="w-3 h-3" />
            auto 60s
          </div>
        </div>
        <Button
          variant="default"
          size="sm"
          className="h-8 text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          onClick={onRefresh}
          disabled={refreshing}>
          
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">{refreshing ? "Fetching…" : "Refresh Now"}</span>
        </Button>
      </div>
    </header>);

}