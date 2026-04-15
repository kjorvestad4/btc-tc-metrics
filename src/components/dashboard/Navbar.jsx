import React from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Download, Menu, Zap } from "lucide-react";
import { toast } from "sonner";

export default function Navbar({ activeScenario, onScenarioChange, onRefresh, onExport, onToggleSidebar }) {
  const [refreshing, setRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh?.();
    setTimeout(() => {
      setRefreshing(false);
      toast.success("Market data refreshed");
    }, 1200);
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

        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Refresh</span>
        </Button>

        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={onExport}>
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Export</span>
        </Button>
      </div>
    </header>
  );
}