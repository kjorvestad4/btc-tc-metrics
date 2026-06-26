import React from "react";
import MetricCard from "../dashboard/MetricCard";
import { Activity, Cpu, Wallet, Radio, RefreshCw, Radio as RadioIcon } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/calculations";

export default function OnChainPanel({ onChainData, polling, onPoll, autoRecalibrated, liveMode, setLiveMode, countdown }) {
  const d = onChainData;

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Real-Time On-Chain Polling</h3>
          {liveMode ? (
            <span className="flex items-center gap-1 text-[9px] bg-primary/15 text-primary border border-primary/25 rounded-full px-2 py-0.5 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              LIVE
              <span className="text-primary/60 ml-0.5">{countdown}s</span>
            </span>
          ) : d?.polled ? (
            <span className="text-[9px] bg-secondary text-muted-foreground border border-border rounded-full px-2 py-0.5 font-medium">
              ● MANUAL
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {/* Live mode toggle */}
          <button
            onClick={() => setLiveMode(!liveMode)}
            className={`flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg border transition-colors ${
              liveMode
                ? "border-primary text-primary bg-primary/10"
                : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            <RadioIcon className="w-3 h-3" />
            {liveMode ? "Live (60s)" : "Live: Off"}
          </button>
          <button
            onClick={onPoll}
            disabled={polling}
            className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${polling ? "animate-spin" : ""}`} />
            {polling ? "Polling…" : "Poll Now"}
          </button>
        </div>
      </div>

      {autoRecalibrated && (
        <div className="mb-3 p-2 rounded-lg bg-primary/10 border border-primary/20 text-[10px] text-primary flex items-center gap-2">
          <Activity className="w-3 h-3" />
          Auto-recalibrated: positive on-chain signals detected → drift adjusted upward
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard
          title="BTC Price"
          value={d?.btc_price ? formatCurrency(d.btc_price) : "—"}
          subtitle={d?.btc_price ? "CoinGecko" : "No data"}
          icon={Activity}
          accentClass="text-amber-400"
        />
        <MetricCard
          title="Hash Health"
          value={d?.hash_health != null ? d.hash_health.toFixed(2) : "—"}
          subtitle={d?.hash_health > 0.9 ? "Healthy" : d?.hash_health > 0.7 ? "Stable" : "Stress"}
          icon={Cpu}
          accentClass={d?.hash_health > 0.85 ? "text-green-400" : "text-amber-400"}
        />
        <MetricCard
          title="Hash Rate"
          value={d?.hash_rate ? `${formatNumber(Math.round(d.hash_rate / 1e12))} TH/s` : "—"}
          subtitle="30-day avg"
          icon={Cpu}
          accentClass="text-cyan-400"
        />
        <MetricCard
          title="Treasury Flow"
          value={d?.treasury_flow != null ? `+${d.treasury_flow} BTC` : "—"}
          subtitle="est. daily buy"
          icon={Wallet}
          accentClass="text-primary"
        />
        <MetricCard
          title="Active Addresses"
          value={d?.active_addresses ? formatNumber(d.active_addresses) : "—"}
          subtitle="7-day avg"
          icon={Activity}
          accentClass="text-blue-400"
        />
        <MetricCard
          title="Drift Signal"
          value={d?.drift_signal != null ? d.drift_signal.toFixed(2) : "—"}
          subtitle="composite"
          icon={Radio}
          accentClass={d?.drift_signal > 0.8 ? "text-green-400" : "text-muted-foreground"}
        />
      </div>

      <p className="text-[9px] text-muted-foreground/50 mt-3">
        Sources: CoinGecko (BTC price), blockchain.info (hash rate, active addresses, tx volume).
        Treasury flow is a heuristic estimate based on known corporate ATM program cadence + ETF net flows.
      </p>
    </div>
  );
}