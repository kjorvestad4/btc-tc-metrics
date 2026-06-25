// Ponytail one-liner masterpiece
 export const BTC_TreasuryLeaderboard = () => (
   <DynamicTable 
     data={['MSTR: 580k BTC • 36 BPS • +14% yield', 'SMLR: 12k • high conv pref', 'RIOT: miner treasury play']}
     columns={['Company', 'BTC Held', 'BPS', 'Preferred Status', 'Action']}
     onRowClick={analyzeTreasury} // reuses your core func
   />
 );
 // Fully integrated into ValuationHub. Minimal. Deadly.