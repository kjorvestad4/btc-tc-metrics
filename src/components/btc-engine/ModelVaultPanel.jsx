import React, { useState, useEffect } from "react";
import { Save, Database, RefreshCw, Clock, Tag } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function ModelVaultPanel({ engineParams, scenario, onChainData, btcPrice }) {
  const [saving, setSaving] = useState(false);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("modelVault", { action: "list" });
      setRecords(res.data?.records ?? res.records ?? []);
    } catch (e) {
      console.error("Vault load failed", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await base44.functions.invoke("modelVault", {
        action: "save",
        vault_key: "apbpe_netss_v2",
        model_name: "NETSSPLSM v2.1",
        version: "v2.1",
        params: engineParams,
        scenario,
        on_chain_snapshot: onChainData,
        btc_price: btcPrice,
        tags: ["charting", "treasury", "realtime"],
      });
      const data = res.data ?? res;
      if (data.status === "created" || data.status === "updated") {
        setLastSaved(data.record);
        await loadRecords();
      }
    } catch (e) {
      console.error("Save failed", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Model Vault</h3>
          <span className="text-[9px] bg-secondary text-muted-foreground border border-border rounded-full px-2 py-0.5 font-mono">
            apbpe_netss_v2
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadRecords}
            disabled={loading}
            className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg border border-primary text-primary hover:bg-primary/10 transition-colors disabled:opacity-50 font-semibold"
          >
            <Save className="w-3 h-3" /> {saving ? "Saving…" : "Save to Vault"}
          </button>
        </div>
      </div>

      {/* Tags */}
      <div className="flex gap-1.5 mb-3">
        {["charting", "treasury", "realtime"].map(tag => (
          <span key={tag} className="flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary">
            <Tag className="w-2.5 h-2.5" /> {tag}
          </span>
        ))}
      </div>

      {/* Saved records */}
      {records.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-1.5 pr-2 font-medium">Model</th>
                <th className="text-left py-1.5 pr-2 font-medium">Scenario</th>
                <th className="text-right py-1.5 pr-2 font-medium">BTC Price</th>
                <th className="text-right py-1.5 pr-2 font-medium">p50</th>
                <th className="text-right py-1.5 pr-2 font-medium">p95</th>
                <th className="text-left py-1.5 pr-2 font-medium">Source</th>
                <th className="text-left py-1.5 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => {
                const sim = r.simulation_result ? (() => { try { return JSON.parse(r.simulation_result); } catch { return null; } })() : null;
                return (
                  <tr key={r.id} className="border-b border-border/30 hover:bg-secondary/30">
                    <td className="py-1.5 pr-2 font-bold text-primary">{r.model_name}</td>
                    <td className="py-1.5 pr-2 text-muted-foreground">{r.scenario}</td>
                    <td className="py-1.5 pr-2 text-right font-mono text-amber-400">{r.btc_price ? `$${Math.round(r.btc_price).toLocaleString()}` : "—"}</td>
                    <td className="py-1.5 pr-2 text-right font-mono text-blue-400">{sim ? `$${Math.round(sim.p50).toLocaleString()}` : "—"}</td>
                    <td className="py-1.5 pr-2 text-right font-mono text-green-400">{sim ? `$${Math.round(sim.p95).toLocaleString()}` : "—"}</td>
                    <td className="py-1.5 pr-2">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded ${r.source === "scheduled" ? "bg-amber-500/15 text-amber-400" : "bg-primary/15 text-primary"}`}>
                        {r.source}
                      </span>
                    </td>
                    <td className="py-1.5 text-[9px] text-muted-foreground">
                      <Clock className="w-2.5 h-2.5 inline mr-1" />
                      {r.updated_date ? new Date(r.updated_date).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground text-center py-4">
          No vault records yet. Click "Save to Vault" to serialize the current engine state.
        </p>
      )}

      <p className="text-[9px] text-muted-foreground/50 mt-3">
        Daily automation runs at 9:00 AM CT — polls on-chain data, runs simulation, and saves snapshot automatically.
        Manual saves upsert by vault key <code className="text-primary">apbpe_netss_v2</code>.
      </p>
    </div>
  );
}