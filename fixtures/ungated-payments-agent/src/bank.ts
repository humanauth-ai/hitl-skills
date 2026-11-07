// The thing that must not run without a human: a transfer. Mocked.

export interface Transfer {
  to: string;
  amount: number;
  currency: string;
  memo?: string;
}

export const ledger: Transfer[] = [];

export function transferFunds(t: Transfer): { ok: true; id: string } {
  ledger.push({ ...t });
  return { ok: true, id: `tx_${ledger.length}` };
}
