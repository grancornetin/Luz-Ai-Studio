// src/modules/piloto/budget/ledgerTypes.ts
// CONTRATO del libro de gasto en USD (W8). El orquestador lo reexporta.
// No cambiar sin avisar: lo usan servidor (api/_piloto/ledger.ts) y cliente.

export type BudgetKind = 'image' | 'video' | 'text' | 'vision';

export interface BudgetLedger {
  /** 'YYYY-MM-DD' (hora de Santiago) para el resumen diario, o 'total'. */
  period: string;
  spentUSD: number;
  dailyCapUSD: number;
  totalCapUSD: number;
  byKind: Record<BudgetKind, number>;
  updatedAt: number;
}

export interface LedgerEntry {
  id: string;
  uid: string;
  kind: BudgetKind;
  model: string;
  units: number;
  unit: 'image' | 'second' | 'token1k';
  costUSD: number;
  taskId?: string;
  createdAt: number;
}
