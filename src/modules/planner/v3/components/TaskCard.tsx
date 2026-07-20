import React, { useState } from 'react';
import { Check, ChevronDown, ChevronUp, Copy, ExternalLink } from 'lucide-react';
import type { PlanTask, TaskStatus } from '../plannerV3Types';
import { FUNNEL_LABELS } from '../plannerV3Types';
import { MODULE_DISPLAY_NAMES } from '../moduleCatalog';

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  return <button onClick={() => { void navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1600); }} className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-[#F72C5B]">
    {copied ? <Check size={13} /> : <Copy size={13} />}{copied ? '¡Copiado!' : 'Copiar'}
  </button>;
};

export default function TaskCard({ task, onStatus, onCreate }: {
  task: PlanTask;
  onStatus: (status: TaskStatus) => void;
  onCreate: () => void;
}) {
  const [open, setOpen] = useState(false);
  return <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
    <button onClick={() => setOpen(v => !v)} className="flex w-full items-start gap-3 p-4 text-left sm:p-5">
      <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-rose-50 text-[#F72C5B]">
        <span className="text-[9px] font-black uppercase">{task.dayLabel.split(' ')[0]}</span>
        <span className="text-xs font-black">{task.suggestedTime}</span>
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-black leading-tight text-slate-900">{task.title}</h3>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[9px] font-black uppercase tracking-wide">
          <span className="rounded-full bg-slate-100 px-2 py-1">{task.platform} · {task.format}</span>
          <span className="rounded-full bg-violet-50 px-2 py-1 text-violet-700">{FUNNEL_LABELS[task.funnelRole]}</span>
          <span className="rounded-full bg-rose-50 px-2 py-1 text-[#F72C5B]">{MODULE_DISPLAY_NAMES[task.toolModule]}</span>
          <span className={`rounded-full px-2 py-1 ${task.status === 'done' ? 'bg-emerald-50 text-emerald-700' : task.status === 'skipped' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{task.status === 'done' ? 'Publicado' : task.status === 'skipped' ? 'Saltado' : 'Pendiente'}</span>
        </div>
      </div>
      {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
    </button>
    {open && <div className="space-y-5 border-t border-slate-100 p-4 text-sm sm:p-5">
      <section><h4 className="font-black text-slate-900">💡 Por qué este contenido</h4><p className="mt-1 leading-relaxed text-slate-600">{task.whyThisContent}</p></section>
      <section><h4 className="font-black text-slate-900">🛠 Cómo crearlo</h4><p className="mt-1 text-slate-600"><b>{MODULE_DISPLAY_NAMES[task.toolModule]}:</b> {task.toolReason}</p>
        {!!task.whatToUpload.length && <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-600">{task.whatToUpload.map(x => <li key={x}>{x}</li>)}</ul>}
        {!!task.howToConfigure.length && <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-600">{task.howToConfigure.map(x => <li key={x}>{x}</li>)}</ol>}
        {task.prompt && <div className="mt-3 rounded-2xl bg-slate-50 p-3"><div className="mb-2 flex justify-end"><CopyButton text={task.prompt} /></div><p className="whitespace-pre-wrap text-xs text-slate-600">{task.prompt}</p></div>}
      </section>
      <section><h4 className="font-black text-slate-900">✍️ Listo para publicar</h4><div className="mt-2 rounded-2xl bg-slate-50 p-3"><CopyButton text={`${task.caption}\n\n${task.hashtags}`} /><p className="mt-2 whitespace-pre-wrap text-slate-700">{task.caption}</p><p className="mt-2 text-xs text-[#F72C5B]">{task.hashtags}</p></div><p className="mt-2 text-slate-600"><b>Para generar conversación:</b> {task.engagementHook}</p></section>
      <section><h4 className="font-black text-slate-900">📈 Qué esperar y cómo medirlo</h4><p className="mt-1 text-slate-600">{task.expectedResult}</p><p className="mt-2 text-slate-600"><b>Mira esto:</b> {task.howToMeasure}</p></section>
      <div className="flex flex-col gap-2 sm:flex-row">
        {task.toolModule !== 'none' && <button onClick={onCreate} className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#F72C5B] px-4 py-3 font-black text-white"><ExternalLink size={16} /> Crear ahora</button>}
        <button onClick={() => onStatus('done')} className="flex-1 rounded-2xl border border-emerald-200 px-4 py-3 font-black text-emerald-700">Ya lo publiqué</button>
        <button onClick={() => { if (confirm('¿Quieres saltar esta publicación? Puedes cambiarla después.')) onStatus('skipped'); }} className="rounded-2xl px-4 py-3 font-bold text-slate-400">Saltar</button>
      </div>
    </div>}
  </article>;
}
