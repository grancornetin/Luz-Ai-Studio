import React from 'react';
import type { InterviewExtraction } from '../../../services/brandIntelligenceService';

export function InterviewReview({ value, onChange }: { value: InterviewExtraction; onChange: (v: InterviewExtraction) => void }) {
  const field = (key: keyof InterviewExtraction, label: string) => <label className="block text-[13px] font-semibold text-slate-700">{label}<textarea value={String(value[key] || '')} onChange={e => onChange({...value,[key]:e.target.value})} className="mt-1 min-h-20 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal"/></label>;
  return <div className="space-y-4 rounded-2xl border border-rose-100 bg-rose-50/40 p-5">
    <h3 className="text-lg font-bold text-slate-800">Esto entendí de tu marca</h3>
    {field('shortDescription','Tu marca en una frase')}
    {field('customerFreeDescription','Tu clienta ideal')}
    {field('mainDifferentiatorText','Lo que te hace diferente')}
    {field('brandPromise','Tu promesa')}
    {!!value.missing.length && <p className="text-sm text-slate-600">No me contaste {value.missing.join(', ')}. Puedes completarlo después.</p>}
  </div>;
}
