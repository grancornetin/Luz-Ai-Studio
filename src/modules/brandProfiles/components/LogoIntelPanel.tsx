import React from 'react';
import type { LogoAnalysis } from '../../../services/brandIntelligenceService';

export function LogoIntelPanel({ analysis, onAccept, onDiscard }: { analysis: LogoAnalysis; onAccept: () => void; onDiscard: () => void }) {
  return <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-5">
    <h3 className="text-lg font-bold text-slate-800">Esto transmite tu logo</h3><p className="mt-2 text-sm leading-5 text-slate-600">{analysis.readingNote}</p>
    <div className="mt-4 flex gap-2">{analysis.colors.map(c => <div key={c.id} className="text-center"><span className="block h-10 w-10 rounded-xl border border-white shadow-sm" style={{background:c.hex}}/><span className="mt-1 block text-[10px] text-slate-500">{c.hex}</span></div>)}</div>
    <div className="mt-3 flex flex-wrap gap-2">{analysis.suggestedStyles.map(x=><span key={x} className="rounded-xl bg-white px-3 py-2 text-xs font-semibold">{x}</span>)}</div>
    <div className="mt-5 flex flex-col gap-2 sm:flex-row"><button type="button" onClick={onAccept} className="min-h-11 flex-1 rounded-[14px] bg-[#F72C5B] px-4 font-bold text-white">Usar esta paleta</button><button type="button" onClick={onDiscard} className="min-h-11 px-4 text-sm font-semibold text-slate-600">Prefiero elegir yo</button></div>
  </div>;
}
