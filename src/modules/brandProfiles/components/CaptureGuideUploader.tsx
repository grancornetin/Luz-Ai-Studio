import React, { useState } from 'react';
import { Camera, CheckCircle2, Loader2 } from 'lucide-react';
import type { CaptureGuide } from '../../../services/captureGuides';

export function CaptureGuideUploader({ guide, actionLabel, loading, onAnalyze }: {
  guide: CaptureGuide;
  actionLabel: string;
  loading: boolean;
  onAnalyze: (files: File[]) => Promise<void>;
}) {
  const [files, setFiles] = useState<Array<File | null>>(() => guide.expectedShots.map(() => null));
  const count = files.filter(Boolean).length;
  return <section className="rounded-2xl border border-slate-200 p-5">
    <h3 className="text-base font-bold text-slate-800">{guide.title}</h3>
    <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-5 text-slate-600">{guide.steps.map(step => <li key={step}>{step}</li>)}</ol>
    {guide.note && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-800">{guide.note}</p>}
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {guide.expectedShots.map((shot, index) => <label key={shot.label} className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 p-4 text-center transition hover:border-[#F72C5B]">
        {files[index] ? <CheckCircle2 className="text-emerald-500" /> : <Camera className="text-slate-400" />}
        <span className="mt-2 text-[13px] font-semibold text-slate-700">{shot.label}{shot.optional ? ' (opcional)' : ''}</span>
        <span className="mt-1 text-xs leading-4 text-slate-500">{files[index]?.name || shot.hint}</span>
        <input type="file" accept="image/*" className="hidden" onChange={e => { const file=e.target.files?.[0]||null; setFiles(current => current.map((item,i)=>i===index?file:item)); }} />
      </label>)}
    </div>
    <button type="button" disabled={!count || loading} onClick={() => void onAnalyze(files.filter((f): f is File => !!f))} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-slate-900 px-4 text-sm font-bold text-white disabled:opacity-40">
      {loading && <Loader2 size={17} className="animate-spin" />}{loading ? 'Analizando capturas…' : actionLabel}
    </button>
  </section>;
}
