import { useState, useEffect } from 'react';
import { formatUSD, formatCLP } from '../services/creditConfig';

export type Currency = 'USD' | 'CLP';

const LS_KEY = 'luz_currency_pref';

export function useCurrency() {
  const [currency, setCurrency] = useState<Currency>(() => {
    try { return (localStorage.getItem(LS_KEY) as Currency) || 'USD'; }
    catch { return 'USD'; }
  });

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, currency); } catch { /* ignore */ }
  }, [currency]);

  const toggle = () => setCurrency(c => c === 'USD' ? 'CLP' : 'USD');

  const format = (usd: number): string =>
    currency === 'CLP' ? formatCLP(usd) : formatUSD(usd);

  return { currency, toggle, format };
}
