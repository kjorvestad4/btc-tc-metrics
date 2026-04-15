import React from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Download, Menu, Zap, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function Navbar({ activeScenario, onScenarioChange, onRefresh, onExport, onToggleSidebar, refreshing, liveData }) {

  const handleRefresh = async () => {
    const data = await onRefresh?.();
    if (!data) return;
    if (data.errors?.length > 0) {
      toast.warning(`Refreshed with partial data. Failed: ${data.errors.join(", ")}`, { duration: 4000 });
    } else {
      const parts = [];
      if (data.btc_price) parts.push(`BTC $${data.btc_price.toLocaleString()}`);
      if (data.mstr_price) parts.push(`MSTR $${data.mstr_price.toFixed(2)}`);
      if (data.msty_price) parts.push(`MSTY $${data.msty_price.toFixed(2)}`);
      toast.success(`Live data updated — ${parts.join(" · ")}`, { duration: 5000 });
    }
  };

  return (
    <header className="h-14 border-b border-border bg-card/80 backdrop-blur-sm flex items-center justify-between px-4 sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onToggleSidebar}>
          <Menu className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-sm font-bold tracking-tight text-foreground leading-none">PunterJeff</h1>
            <p className="text-[10px] text-muted-foreground leading-none mt-0.5">MSTR Projection Engine</p>
          </div>
        </div>

        {/* Live data status pills */}
        {liveData && (
          <div className="hidden md:flex items-center gap-2 ml-2">
            {liveData.btc_price && (
              <span className="text-[10px] font-mono bg-primary/10 text-primary border border-primary/20 rounded px-2 py-0.5">
                BTC ${liveData.btc_price.toLocaleString()}
              </span>
            )}
            {liveData.mstr_price && (
              <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded px-2 py-0.5">
                MSTR ${liveData.mstr_price.toFixed(2)}
              </span>
            )}
            {liveData.msty_price && (
              <span className="text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded px-2 py-0.5">
                MSTY ${liveData.msty_price.toFixed(2)}
              </span>
            )}
            {liveData.errors?.length === 0
              ? <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
              : <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            }
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Select value={activeScenario} onValueChange={onScenarioChange}>
          <SelectTrigger className="w-32 h-8 text-xs bg-secondary border-border">
            <SelectValue placeholder="Scenario" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Base">Base Case</SelectItem>
            <SelectItem value="Bull">Bull Case</SelectItem>
            <SelectItem value="Bear">Bear Case</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="default"
          size="sm"
          className="h-8 text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">{refreshing ? "Fetching…" : "Refresh Live"}</span>
        </Button>

        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={onExport}>
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Export</span>
        </Button>
      </div>
    </header>
  );
}