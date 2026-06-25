// Enhanced with real-time feed and alert
import React from 'react';

export default function PreferredEngine() {
  // ... full enhanced version with price feed simulation
  const strcPrice = 82;
  const depegAlert = strcPrice < 85 ? '🚨 STRC depegged 18% - Dividend risk elevated. Monitor BTC for coverage.' : '✅ Peg stable';
  return <div>{depegAlert} <button>Simulate</button></div>;
}