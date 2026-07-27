import React from 'react';
import type { DirectorRun } from '../types';

const CompareView: React.FC<{ left: DirectorRun; right: DirectorRun }> = ({ left, right }) => {
  const rows: Array<[string, (run: DirectorRun) => React.ReactNode]> = [
    ['Estado', run => run.status],
    ['Prompt positivo', run => <p className="whitespace-pre-wrap">{run.positivePrompt}</p>],
    ['Prompt negativo', run => <p className="whitespace-pre-wrap">{run.negativePrompt}</p>],
    ['Advertencias', run => run.warnings.join('; ') || '—'],
    ...['pose', 'gesture', 'expression', 'scene', 'captureMechanism'].map(domain =>
      [`Selección ${domain}`, (run: DirectorRun) => {
        const sel = (run.selections as any)[domain];
        return sel ? `${sel.sourceBank}/${sel.sourceId}` : '—';
      }] as [string, (run: DirectorRun) => React.ReactNode]
    )
  ];

  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr>
          <th className="text-left p-2 border-b">Campo</th>
          <th className="text-left p-2 border-b font-mono text-xs">{left.id}</th>
          <th className="text-left p-2 border-b font-mono text-xs">{right.id}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, getter]) => (
          <tr key={label}>
            <td className="p-2 border-b font-semibold align-top">{label}</td>
            <td className="p-2 border-b align-top">{getter(left)}</td>
            <td className="p-2 border-b align-top">{getter(right)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default CompareView;
