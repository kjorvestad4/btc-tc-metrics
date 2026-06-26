import React from "react";
import { Bitcoin } from "lucide-react";

const TREASURY_DATA = [
  { company: "MSTR", btc_held: "580k BTC", bps: "36 BPS", yield: "+14%", status: "Convertible Preferred", note: "Largest corporate BTC treasury" },
  { company: "SMLR", btc_held: "12k BTC", bps: "—", yield: "—", status: "High Conv Pref", note: "Smaller treasury, high leverage" },
  { company: "RIOT", btc_held: "Miner", bps: "—", yield: "—", status: "Miner Treasury", note: "Mining revenue + BTC reserve" },
];

export default function Leaderboard() {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Bitcoin className="w-4 h-4 text-amber-400" />
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">BTC Treasury Leaderboard</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left py-1.5 pr-2 font-medium">Company</th>
              <th className="text-left py-1.5 pr-2 font-medium">BTC Held</th>
              <th className="text-left py-1.5 pr-2 font-medium">BPS</th>
              <th className="text-left py-1.5 pr-2 font-medium">Yield</th>
              <th className="text-left py-1.5 pr-2 font-medium">Preferred Status</th>
              <th className="text-left py-1.5 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {TREASURY_DATA.map((row) => (
              <tr key={row.company} className="border-b border-border/30 hover:bg-secondary/30">
                <td className="py-1.5 pr-2 font-bold text-primary">{row.company}</td>
                <td className="py-1.5 pr-2 font-mono text-amber-400">{row.btc_held}</td>
                <td className="py-1.5 pr-2 font-mono text-cyan-400">{row.bps}</td>
                <td className="py-1.5 pr-2 font-mono text-green-400">{row.yield}</td>
                <td className="py-1.5 pr-2 text-foreground">{row.status}</td>
                <td className="py-1.5 text-muted-foreground text-[10px]">{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}