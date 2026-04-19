import React, { useState } from "react";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/calculations";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ProjectionsTable({ projections, params }) {
  const [view, setView] = useState("quarterly");

  const data = view === "annual" ?
  projections.filter((p) => p.quarter % 4 === 0) :
  projections;

  return (
    <div className="space-y-4">
      
















      

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/50">
              
              
              
              
              
              
              
              
              
              
              
              
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, i) =>
            <TableRow
              key={row.quarter}
              className={`${i === 0 ? "bg-primary/5" : "hover:bg-secondary/30"} transition-colors`}>
              
                
                
                
                
                
                
                



              
                
                
                
                
                
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>);

}