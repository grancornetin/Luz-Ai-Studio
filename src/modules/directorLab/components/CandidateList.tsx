import React from 'react';
import type { Candidate } from '../types';

const CandidateList: React.FC<{ candidates: Candidate[] }> = ({ candidates }) => {
  if (!candidates || candidates.length === 0) {
    return <p className="text-slate-400 italic">Sin candidatos en este dominio.</p>;
  }
  return (
    <ul className="space-y-2">
      {candidates.map(candidate => (
        <li key={`${candidate.sourceBank}:${candidate.sourceId}`} className="border border-slate-100 rounded p-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-slate-500">{candidate.sourceBank} / {candidate.sourceId}</span>
            <span className="text-xs">
              {candidate.curationStatus} {candidate.strongReference ? '★' : ''} · conf {candidate.confidence}
            </span>
          </div>
          {candidate.sourceText && <p className="text-slate-600 mt-1">{candidate.sourceText}</p>}
          {candidate.compatibilityReason && (
            <p className="text-indigo-600 mt-1 text-xs">Motivo: {candidate.compatibilityReason}</p>
          )}
        </li>
      ))}
    </ul>
  );
};

export default CandidateList;
