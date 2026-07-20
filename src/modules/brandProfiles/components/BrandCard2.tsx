import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { BrandProfile } from '../types';

export function BrandCard2({ profile, compact = false }: { profile: Partial<BrandProfile>; compact?: boolean }) {
  const [open, setOpen] = useState(!compact);
  const colors = profile.visualIdentity?.colors || [];
  const logo = profile.visualIdentity?.assets?.find(a => a.type === 'logo');
  const primary = colors[0]?.hex || '#F72C5B';
  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all">
    <button type="button" onClick={() => compact && setOpen(v => !v)} className="flex min-h-14 w-full items-center gap-3 p-3 text-left">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl font-bold text-white" style={{ background: primary }}>
        {logo ? <img src={logo.url} alt="" className="h-full w-full object-contain" /> : (profile.brandName || 'M')[0].toUpperCase()}
      </div>
      <div className="min-w-0 flex-1"><h2 className="truncate text-base font-bold text-slate-800">{profile.brandName || 'Tu marca'}</h2><div className="mt-1 flex h-2 overflow-hidden rounded-full">{colors.slice(0,6).map(c => <span key={c.id} className="flex-1" style={{background:c.hex}} />)}</div></div>
      {compact && <ChevronDown size={18} className={`transition-transform ${open ? 'rotate-180' : ''}`} />}
    </button>
    {open && <div className="border-t border-slate-100 p-5">
      <p className="text-sm leading-5 text-slate-600">{profile.shortDescription || 'Cuando completes tu historia, aquí aparecerá la esencia de tu marca.'}</p>
      <div className="mt-4 flex flex-wrap gap-2">{profile.voice?.toneKeywords?.map(t => <span key={t} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">{t}</span>)}</div>
      {profile.targetCustomer?.ageRange && <p className="mt-3 text-xs font-semibold text-slate-500">Tu clienta: {profile.targetCustomer.ageRange} años</p>}
      <div className="mt-4 rounded-xl p-4 text-sm italic text-slate-700" style={{background:`${primary}12`}}>
        {profile.voice?.toneKeywords?.length ? `“Así podría sonar ${profile.brandName}: cercana, clara y fiel a lo que quieres transmitir.”` : 'Tu ejemplo de voz aparecerá aquí.'}
      </div>
    </div>}
  </section>;
}
