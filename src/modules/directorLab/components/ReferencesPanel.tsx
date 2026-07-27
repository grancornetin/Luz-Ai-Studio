import React, { useState } from 'react';
import type { DirectorReference, ReferenceRole } from '../types';

const ROLES: ReferenceRole[] = ['identity', 'body', 'outfit', 'product', 'scene', 'accessory', 'auxiliary'];

const ReferencesPanel: React.FC<{
  references: DirectorReference[];
  onAdd: (data: { role: ReferenceRole; alias: string; notes: string; assetDataUrl?: string }) => Promise<void>;
}> = ({ references, onAdd }) => {
  const [role, setRole] = useState<ReferenceRole>('identity');
  const [alias, setAlias] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const handleAdd = async () => {
    setBusy(true);
    try {
      let assetDataUrl: string | undefined;
      if (file) {
        assetDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }
      await onAdd({ role, alias, notes, assetDataUrl });
      setAlias(''); setNotes(''); setFile(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <ul className="space-y-1">
        {references.map(ref => (
          <li key={ref.id} className="text-sm flex justify-between border border-slate-100 rounded px-2 py-1">
            <span><strong>{ref.alias}</strong> ({ref.role})</span>
            <span className="text-xs text-slate-400">{ref.hasAsset ? 'con archivo' : 'sin archivo'}</span>
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-2 gap-2 items-end">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Rol</label>
          <select className="w-full border border-slate-200 rounded px-2 py-1 text-sm" value={role} onChange={e => setRole(e.target.value as ReferenceRole)}>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Alias (ej. @pia)</label>
          <input className="w-full border border-slate-200 rounded px-2 py-1 text-sm" value={alias} onChange={e => setAlias(e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-slate-500 mb-1">Notas</label>
          <input className="w-full border border-slate-200 rounded px-2 py-1 text-sm" value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
        <div className="col-span-2">
          <input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)} />
        </div>
        <button
          disabled={busy || !alias}
          onClick={handleAdd}
          className="col-span-2 text-sm px-3 py-1.5 bg-slate-900 text-white rounded disabled:opacity-40"
        >
          Agregar referencia
        </button>
      </div>
    </div>
  );
};

export default ReferencesPanel;
