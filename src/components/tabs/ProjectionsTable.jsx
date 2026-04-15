import React, { useState } from "react";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/calculations";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ProjectionsTable({ projections, params }) {
  const [view, setView] = useState("quarterly");

  const data = view === "annual"
    ? projections.filter((p) => p.quarter % 4 === 0)
    : projections;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Full Projections Table</h3>
          <p className="text-xs text-muted-foreground">
            {params.projection_years}-year projection under{" "}
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono border-primary/30 text-primary">
              {params.active_scenario}
            </Badge>{" "}
            scenario
          </p>
        </div>
        <Tabs value={view} onValueChange={setView}>
          <TabsList className="h-7 bg-secondary">
            <TabsTrigger value="quarterly" className="text-xs h-5 px-2">Quarterly</TabsTrigger>
            <TabsTrigger value="annual" className="text-xs h-5 px-2">Annual</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/50">
              <TableHead className="text-[10px] font-semibold">Period</TableHead>
              <TableHead className="text-[10px] font-semibold text-right">BTC Price</TableHead>
              <TableHead className="text-[10px] font-semibold text-right">BTC Holdings</TableHead>
              <TableHead className="text-[10px] font-semibold text-right">Shares (M)</TableHead>
              <TableHead className="text-[10px] font-semibold text-right">mNAV</TableHead>
              <TableHead className="text-[10px] font-semibold text-right">MSTR Price</TableHead>
              <TableHead className="text-[10px] font-semibold text-right">Premium</TableHead>
              <TableHead className="text-[10px] font-semibold text-right">Market Cap</TableHead>
              <TableHead className="text-[10px] font-semibold text-right">BTC NAV</TableHead>
              <TableHead className="text-[10px] font-semibold text-right">MSTY Div/Mo</TableHead>
              <TableHead className="text-[10px] font-semibold text-right">MSTY Yield</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, i) => (
              <TableRow
                key={row.quarter}
                className={`${i === 0 ? "bg-primary/5" : "hover:bg-secondary/30"} transition-colors`}
              >
                <TableCell className="font-mono text-xs text-foreground">{row.label}</TableCell>
                <TableCell className="text-right font-mono text-xs text-amber-400">{formatCurrency(row.btc_price)}</TableCell>
                <TableCell className="text-right font-mono text-xs">{formatNumber(row.btc_holdings)}</TableCell>
                <TableCell className="text-right font-mono text-xs">{row.shares_outstanding_m.toFixed(1)}</TableCell>
                <TableCell className="text-right font-mono text-xs text-blue-400">{formatCurrency(row.mnav)}</TableCell>
                <TableCell className="text-right font-mono text-xs text-primary">{formatCurrency(row.mstr_price)}</TableCell>
                <TableCell className="text-right font-mono text-xs">
                  <span className={row.premium_to_nav >= 0 ? "text-green-400" : "text-red-400"}>
                    {formatPercent(row.premium_to_nav)}
                  </span>
                </TableCell>
                <TableCell className="text-right font-mono text-xs">{formatCurrency(row.market_cap)}</TableCell>
                <TableCell className="text-right font-mono text-xs text-amber-400">{formatCurrency(row.btc_nav)}</TableCell>
                <TableCell className="text-right font-mono text-xs text-cyan-400">{formatCurrency(row.msty_dividend_monthly, 2)}</TableCell>
                <TableCell className="text-right font-mono text-xs">{formatPercent(row.msty_yield)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}