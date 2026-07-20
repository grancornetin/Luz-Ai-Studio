import React from 'react';
import type { ContentPlan, WeeklyReport } from '../plannerV3Types';

export default function WeeklyReportView({ report, plan, onNext }: { report: WeeklyReport; plan: ContentPlan; onNext: () => void }) {
  const best = report.bestTask ? plan.tasks.find(t => t.id === report.bestTask?.taskId) : null;
  return <div className="space-y-5 rounded-3xl bg-white p-5 shadow-sm sm:p-7">
    <div><p className="text-xs font-black uppercase tracking-widest text-[#F72C5B]">Tu informe</p><h2 className="mt-1 text-2xl font-black text-slate-900">Lo que aprendimos esta semana</h2><p className="mt-2 text-slate-600">{report.summary}</p></div>
    {!!report.wins.length && <section><h3 className="font-black">Lo que funcionó</h3><ul className="mt-2 space-y-2">{report.wins.map(x => <li key={x}>✅ {x}</li>)}</ul></section>}
    {!!report.learnings.length && <section><h3 className="font-black">Lo que aprendimos</h3><ul className="mt-2 space-y-2">{report.learnings.map(x => <li key={x}>💡 {x}</li>)}</ul></section>}
    {best && <section className="rounded-2xl bg-rose-50 p-4"><p className="text-xs font-black uppercase text-[#F72C5B]">Mejor publicación</p><h3 className="mt-1 font-black">{best.title}</h3><p className="mt-1 text-sm text-slate-600">{report.bestTask?.why}</p></section>}
    <section><h3 className="font-black">Para la próxima semana</h3><ul className="mt-2 list-disc space-y-2 pl-5">{report.recommendations.map(x => <li key={x}>{x}</li>)}</ul></section>
    <button onClick={onNext} className="w-full rounded-2xl bg-[#F72C5B] p-4 font-black text-white">Crear mi semana siguiente →</button>
  </div>;
}
