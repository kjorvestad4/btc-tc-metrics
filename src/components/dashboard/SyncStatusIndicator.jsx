import React, { useState, useEffect } from "react";
import { RefreshCw, Wifi, WifiOff } from "lucide-react";

function timeAgo(date) {
  if (!date) return null;
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function SyncStatusIndicator({ refreshing, lastSynced }) {
  const [, setTick] = useState(0);

  // Re-render every 5s so "Xs ago" stays current
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(interval);
  }, []);

  const isLive = lastSynced && (Date.now() - lastSynced.getTime()) < 120000; // live within 2 min
  const ago = timeAgo(lastSynced);

  if (refreshing) {
    return (
      <div className="flex items-center gap-1.5 text-[9px] text-amber-400 font-medium">
        <RefreshCw className="w-3 h-3 animate-spin" />
        <span className="hidden sm:inline">Syncing…</span>
      </div>
    );
  }

  if (!lastSynced) {
    return (
      <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground/60 font-medium">
        <WifiOff className="w-3 h-3" />
        <span className="hidden sm:inline">No data yet</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-[9px] font-medium" title={`Last synced: ${lastSynced.toLocaleTimeString("en-US")}`}>
      {isLive ? (
        <Wifi className="w-3 h-3 text-primary" />
      ) : (
        <WifiOff className="w-3 h-3 text-amber-400" />
      )}
      <span className={isLive ? "text-primary" : "text-amber-400"}>
        {isLive ? "Live" : "Stale"}
      </span>
      <span className="text-muted-foreground hidden sm:inline">· {ago}</span>
      <span className={`w-1.5 h-1.5 rounded-full ${isLive ? "bg-primary animate-pulse" : "bg-amber-400"}`} />
    </div>
  );
}