import React, { useState, useEffect, useCallback } from "react";
import { Save, Camera, Trash2, Upload, GitCompare, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const KEY_PARAMS = [
  { key: "btc_price", label: "BTC Price", format: v => v != null ? `$${Math.round(v).toLocaleString()}` : "—" },
  { key: "btc_cagr", label: "BTC CAGR", format: v => v != null ? `${v}%` : "—" },
  { key: "mstr_btc_holdings", label: "MSTR BTC", format: v => v != null ? `${Math.round(v).toLocaleString()}` : "—" },
  { key: "amplification_ratio", label: "Amp Ratio", format: v => v != null ? `${v}x` : "—" },
  { key: "premium_multiple", label: "Premium", format: v => v != null ? `${v}x` : "—" },
  { key: "btc_accumulation_per_quarter", label: "Accum/Qtr", format: v => v != null ? `${Math.round(v).toLocaleString()}` : "—" },
  { key: "dilution_rate_per_quarter", label: "Dilution/Qtr", format: v => v != null ? `${v}%` : "—" },
  { key: "mstr_iv", label: "MSTR IV", format: v => v != null ? `${v}%` : "—" },
  { key: "projection_years", label: "Horizon", format: v => v != null ? `${v}y` : "—" },
];

export default function ParamSnapshotPanel({ params, onLoad }) {
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [compareMode, setCompareMode] = useState(false);

  const loadSnapshots = useCallback(async () => {
    setLoading(true);
    try {
      const list = await base44.entities.ParamSnapshot.list("-updated_date", 50);
      setSnapshots(list);
    } catch (e) {
      console.error("Failed to load snapshots", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSnapshots();
  }, [loadSnapshots]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Please enter a name for this snapshot");
      return;
    }
    setSaving(true);
    try {
      const tag =
        params.btc_cagr >= 25 ? "bull" :
        params.btc_cagr >= 10 ? "base" : "bear";

      await base44.entities.ParamSnapshot.create({
        snapshot_name: name.trim(),
        description: description.trim() || null,
        serialized_params: JSON.stringify(params),
        active_scenario: params.active_scenario || null,
        btc_price: params.btc_price ?? null,
        btc_cagr: params.btc_cagr ?? null,
        amplification_ratio: params.amplification_ratio ?? null,
        tags: [tag],
      });
      toast.success(`Snapshot "${name.trim()}" saved`);
      setName("");
      setDescription("");
      await loadSnapshots();
    } catch (e) {
      toast.error("Failed to save snapshot");
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleLoad = async (snapshot) => {
    try {
      const parsed = JSON.parse(snapshot.serialized_params);
      onLoad(parsed);
      toast.success(`Loaded "${snapshot.snapshot_name}"`);
    } catch (e) {
      toast.error("Failed to load snapshot");
      console.error(e);
    }
  };

  const handleDelete = async (id, snapshotName) => {
    try {
      await base44.entities.ParamSnapshot.delete(id);
      toast.success(`Deleted "${snapshotName}"`);
      await loadSnapshots();
    } catch (e) {
      toast.error("Failed to delete snapshot");
      console.error(e);
    }
  };

  const parseParams = (s) => {
    try { return JSON.parse(s.serialized_params); } catch { return {}; }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Strategy Snapshots</h3>
          <span className="text-[9px] bg-secondary text-muted-foreground border border-border rounded-full px-2 py-0.5 font-mono">
            {snapshots.length} saved
          </span>
        </div>
        <div className="flex gap-2">
          {snapshots.length >= 2 && (
            <button
              onClick={() => setCompareMode(v => !v)}
              className={`flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg border transition-colors font-semibold ${
                compareMode
                  ? "border-accent text-accent bg-accent/10"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              {compareMode ? <X className="w-3 h-3" /> : <GitCompare className="w-3 h-3" />}
              {compareMode ? "Exit Compare" : "Compare"}
            </button>
          )}
          <button
            onClick={loadSnapshots}
            disabled={loading}
            className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
          >
            <Save className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Save new snapshot */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4 p-3 bg-secondary/30 rounded-lg border border-border">
        <input
          type="text"
          placeholder="Snapshot name (e.g. Bull Case Q3)"
          value={name}
          onChange={e => setName(e.target.value)}
          className="flex-1 h-8 rounded-md border border-input bg-transparent px-3 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          onKeyDown={e => e.key === "Enter" && !saving && handleSave()}
        />
        <input
          type="text"
          placeholder="Notes (optional)"
          value={description}
          onChange={e => setDescription(e.target.value)}
          className="flex-1 h-8 rounded-md border border-input bg-transparent px-3 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          onKeyDown={e => e.key === "Enter" && !saving && handleSave()}
        />
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="flex items-center justify-center gap-1.5 text-[10px] px-3 py-1.5 rounded-lg border border-accent text-accent hover:bg-accent/10 transition-colors disabled:opacity-50 font-semibold whitespace-nowrap"
        >
          <Save className="w-3 h-3" /> {saving ? "Saving…" : "Save Snapshot"}
        </button>
      </div>

      {/* Snapshots list or comparison table */}
      {snapshots.length === 0 ? (
        <p className="text-[10px] text-muted-foreground text-center py-6">
          No snapshots saved yet. Name your current configuration above and click "Save Snapshot" to compare strategies over time.
        </p>
      ) : compareMode ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-2 pr-3 font-medium whitespace-nowrap">Parameter</th>
                {snapshots.map(s => (
                  <th key={s.id} className="text-right py-2 px-2 font-semibold text-foreground whitespace-nowrap min-w-[100px]">
                    {s.snapshot_name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {KEY_PARAMS.map(({ key, label, format }) => (
                <tr key={key} className="border-b border-border/30">
                  <td className="py-1.5 pr-3 text-muted-foreground">{label}</td>
                  {snapshots.map(s => {
                    const p = parseParams(s);
                    const values = snapshots.map(sp => parseParams(sp)[key]);
                    const allSame = values.every(v => v === values[0]);
                    return (
                      <td key={s.id} className={`text-right py-1.5 px-2 font-mono ${allSame ? "text-muted-foreground" : "text-foreground font-semibold"}`}>
                        {format(p[key])}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="border-b border-border/30">
                <td className="py-1.5 pr-3 text-muted-foreground">Scenario</td>
                {snapshots.map(s => (
                  <td key={s.id} className="text-right py-1.5 px-2 text-[10px] text-muted-foreground">{s.active_scenario || "—"}</td>
                ))}
              </tr>
              <tr>
                <td className="py-1.5 pr-3 text-muted-foreground">Saved</td>
                {snapshots.map(s => (
                  <td key={s.id} className="text-right py-1.5 px-2 text-[9px] text-muted-foreground/60">
                    {new Date(s.created_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-1.5">
          {snapshots.map(s => {
            const p = parseParams(s);
            return (
              <div key={s.id} className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-secondary/20 hover:bg-secondary/40 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground truncate">{s.snapshot_name}</span>
                    {s.tags?.map(t => (
                      <span key={t} className={`text-[8px] px-1.5 py-0.5 rounded-full font-mono ${
                        t === "bull" ? "bg-green-500/15 text-green-400" :
                        t === "bear" ? "bg-red-500/15 text-red-400" :
                        "bg-amber-500/15 text-amber-400"
                      }`}>{t}</span>
                    ))}
                  </div>
                  {s.description && <p className="text-[10px] text-muted-foreground truncate mt-0.5">{s.description}</p>}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[9px] text-muted-foreground/70 font-mono">
                    {KEY_PARAMS.slice(0, 5).map(({ key, label, format }) => (
                      <span key={key}>{label}: {format(p[key])}</span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleLoad(s)}
                    className="flex items-center gap-1 text-[9px] px-2 py-1 rounded-md border border-primary text-primary hover:bg-primary/10 transition-colors font-semibold"
                  >
                    <Upload className="w-3 h-3" /> Load
                  </button>
                  <button
                    onClick={() => handleDelete(s.id, s.snapshot_name)}
                    className="flex items-center gap-1 text-[9px] px-2 py-1 rounded-md border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[9px] text-muted-foreground/50 mt-3">
        Snapshots capture your current parameter configuration so you can recall and compare different BTC treasury strategies over time.
      </p>
    </div>
  );
}