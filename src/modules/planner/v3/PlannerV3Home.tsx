import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BarChart3, CalendarDays, Loader2, Sparkles } from 'lucide-react';
import { contentPlanService } from './contentPlanService';
import { GOAL_LABELS, type ContentPlan } from './plannerV3Types';

const shouldClose = (p: ContentPlan) => {
  const final = p.tasks.filter(t => t.status !== 'pending').length / Math.max(1, p.tasks.length);
  const last = [...p.tasks].sort((a,b) => b.date.localeCompare(a.date))[0]?.date;
  return final >= .7 || (!!last && new Date(`${last}T23:59:59`).getTime() < Date.now());
};
export default function PlannerV3Home() {
  const nav = useNavigate(); const [plans,setPlans]=useState<ContentPlan[]>([]); const [loading,setLoading]=useState(true);
  useEffect(() => { contentPlanService.listPlans().then(setPlans).finally(() => setLoading(false)); }, []);
  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="animate-spin text-[#F72C5B]"/></div>;
  const active=plans.find(p=>p.status==='active'); const closed=plans.filter(p=>p.status==='closed');
  return <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:py-10">
    {!active ? <section className="rounded-[32px] bg-slate-950 p-7 text-white sm:p-12"><Sparkles className="text-[#F72C5B]"/><h1 className="mt-5 text-3xl font-black sm:text-5xl">Tu agencia de contenido personal</h1><div className="mt-5 space-y-2 text-slate-300"><p>Te dice qué publicar y cuándo.</p><p>Te lleva a la herramienta correcta para crearlo.</p><p>Aprende de tus resultados reales cada semana.</p></div><button onClick={()=>nav('/planner/nuevo')} className="mt-8 rounded-2xl bg-[#F72C5B] px-6 py-4 font-black">Crear mi primer plan</button></section>
    : <><section className="rounded-[32px] bg-white p-6 shadow-sm sm:p-8"><p className="text-xs font-black uppercase tracking-widest text-[#F72C5B]">{active.brandName}</p><h1 className="mt-2 text-3xl font-black">Semana {active.weekNumber}</h1><p className="mt-2 text-slate-500">{GOAL_LABELS[active.monthlyFocus.goal]}</p><div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-[#F72C5B]" style={{width:`${active.tasks.filter(t=>t.status==='done').length/Math.max(1,active.tasks.length)*100}%`}}/></div><p className="mt-2 text-xs font-bold text-slate-400">{active.tasks.filter(t=>t.status==='done').length} de {active.tasks.length} publicadas</p><button onClick={()=>nav(`/planner/${active.id}`)} className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 font-black text-white">Ver mi semana <ArrowRight size={16}/></button></section>
    {shouldClose(active)&&<button onClick={()=>nav(`/planner/${active.id}/cierre`)} className="flex w-full items-center gap-3 rounded-3xl bg-rose-50 p-5 text-left text-[#F72C5B]"><BarChart3/><span className="font-black">Es hora de cerrar tu semana y ver qué funcionó 📊</span></button>}</>}
    {!!closed.length&&<section><h2 className="mb-3 text-xl font-black">Semanas anteriores</h2><div className="grid gap-3 sm:grid-cols-2">{closed.map(p=><button key={p.id} onClick={()=>nav(`/planner/${p.id}/cierre`)} className="rounded-2xl border bg-white p-4 text-left"><div className="flex items-center gap-2 text-[#F72C5B]"><CalendarDays size={16}/><b>{p.brandName} · Semana {p.weekNumber}</b></div><p className="mt-2 text-sm text-slate-500">{Math.round(p.tasks.filter(t=>t.status==='done').length/Math.max(1,p.tasks.length)*100)}% publicado · Ver informe</p></button>)}</div></section>}
  </main>;
}
