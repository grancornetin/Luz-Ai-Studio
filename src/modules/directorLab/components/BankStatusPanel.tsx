import React from 'react';
import type { DirectorLabStatus } from '../types';

const BankStatusPanel: React.FC<{ status: DirectorLabStatus | null }> = ({ status }) => {
  if (!status) return <p className="text-slate-400 text-sm">Cargando estado de bancos…</p>;

  return (
    <div className="space-y-3">
      <div className={`text-sm px-3 py-2 rounded ${status.provider.ready ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
        Vertex AI: {status.provider.ready ? `listo (${status.provider.model})` : `no disponible — ${status.provider.error}`}
      </div>
      <ul className="space-y-2">
        {status.banks.map(bank => (
          <li key={bank.bankId} className="border border-slate-100 rounded p-2 text-sm">
            <div className="flex justify-between">
              <span className="font-semibold">{bank.label}</span>
              <span className="text-xs text-slate-400">{bank.bankId}</span>
            </div>
            <pre className="text-xs text-slate-500 mt-1 overflow-x-auto">{JSON.stringify(bank.status, null, 2)}</pre>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default BankStatusPanel;
