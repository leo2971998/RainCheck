import { useEffect, useState } from 'react';
import { household as sample, transactions as sampleTx, notice as sampleNotice } from '../data/household.sample.js';
import { parseNotice } from '../engine/changes.js';

const sampleHousehold = { ...sample, recurring: sample.recurring.map(bill => bill.id === 'internet' ? { ...bill, change: parseNotice(sampleNotice) } : bill) };

export function useHousehold() {
  const [state, set] = useState({ loading: import.meta.env.VITE_DATA_MODE === 'nessie', household: sampleHousehold, transactions: sampleTx, notice: sampleNotice, source: 'sample' });
  useEffect(() => {
    if (import.meta.env.VITE_DATA_MODE !== 'nessie') return;
    let active = true;
    fetch('/api/household').then(r => {
      if (!r.ok) throw new Error('Household unavailable');
      return r.json();
    }).then(d => {
      if (!d.household) throw new Error('Household unavailable');
      if (active) set({ loading: false, ...d });
    }).catch(() => {
      if (active) set(s => ({ ...s, loading: false, source: 'sample', notice: sampleNotice }));
    });
    return () => { active = false; };
  }, []);
  return state;
}
