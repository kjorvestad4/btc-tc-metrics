import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { formatCurrency } from "@/lib/calculations";

export default function PreferredCard({ preferred, onChange }) {
  const [open, setOpen] = useState(false);
  const annualDiv = preferred.notional_amount * 1e6 * (preferred.dividend_rate / 100);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 border-primary/30 text-primary">
            {preferred.ticker}
          </Badge>
          <span className="text-xs text-muted-foreground">{formatCurrency(annualDiv)}/yr</span>
        </div>
        <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-2 pt-2 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px] text-muted-foreground">Notional ($M)</Label>
            <Input
              type="number"
              value={preferred.notional_amount}
              onChange={(e) => onChange({ ...preferred, notional_amount: parseFloat(e.target.value) || 0 })}
              className="h-6 text-xs font-mono bg-secondary border-border"
            />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Div Rate %</Label>
            <Input
              type="number"
              value={preferred.dividend_rate}
              onChange={(e) => onChange({ ...preferred, dividend_rate: parseFloat(e.target.value) || 0 })}
              className="h-6 text-xs font-mono bg-secondary border-border"
              step="0.1"
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-[10px] text-muted-foreground">BTC-Denominated</Label>
          <Switch
            checked={preferred.is_btc_denominated}
            onCheckedChange={(v) => onChange({ ...preferred, is_btc_denominated: v })}
            className="scale-75"
          />
        </div>
        <div className="text-[10px] text-muted-foreground/60">
          Annual liability: <span className="font-mono text-foreground">{formatCurrency(annualDiv)}</span>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}