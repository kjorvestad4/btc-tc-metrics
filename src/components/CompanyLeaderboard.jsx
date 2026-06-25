// Ponytail-minimal BTC TC Leaderboard
import { Card } from '@/components/ui';
export const CompanyLeaderboard = () => {
  const companies = [{name:'MSTR', btc: '450k', yield: '2.8x', pref: 'STRC 11.5%', status:'🚨'}, ...]; // data from your api
  return <Card><table>...</table> <button onClick={() => loadPreferred('MSTR')}>Analyze Preferred Mechanics</button></Card>;
};