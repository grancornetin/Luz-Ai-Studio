import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { ACCOUNT_GUIDES } from '../../../services/captureGuides';
import {
  analyzeAccountInsightsShots,
  analyzeProfileShots,
  assembleSocialInsights,
  buildNetworkInsights,
  type AccountInsightsAnalysis,
  type ProfileShotAnalysis,
} from '../../../services/brandIntelligenceService';
import {
  EMPTY_NETWORK_INSIGHTS,
  SOCIAL_NETWORK_LABELS,
  type BrandSocialInsights,
  type NetworkInsights,
  type SocialNetworkKey,
} from '../types';
import { CaptureGuideUploader } from './CaptureGuideUploader';

const networks: SocialNetworkKey[] = ['instagram','tiktok','facebook'];
const toData = (file: File) => new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=reject;r.readAsDataURL(file);});

export function SocialInsightsArea({ current, onSave }: { current?: BrandSocialInsights; onSave: (v: BrandSocialInsights) => Promise<void> }) {
  const [network,setNetwork]=useState<SocialNetworkKey>('instagram');
  const [values,setValues]=useState<Partial<Record<SocialNetworkKey,NetworkInsights>>>(current?.networks || legacyNetworks(current));
  const [profile,setProfile]=useState<ProfileShotAnalysis|null>(null);
  const [insights,setInsights]=useState<AccountInsightsAnalysis|null>(null);
  const [loading,setLoading]=useState<'profile'|'insights'|''>('');
  const [error,setError]=useState('');
  const [saved,setSaved]=useState('');
  const guide=ACCOUNT_GUIDES[network];
  const value=values[network] || {...EMPTY_NETWORK_INSIGHTS,updatedAt:0};
  const analyze = async(files:File[],kind:'profile'|'insights')=>{setLoading(kind);setError('');try{const images=await Promise.all(files.map(toData));const types=files.map(f=>f.type);if(kind==='profile'){const result=await analyzeProfileShots(network,images,types);setProfile(result);setValues(all=>({...all,[network]:{...EMPTY_NETWORK_INSIGHTS,...all[network],handle:result.handle,followers:result.followers,updatedAt:all[network]?.updatedAt||0}}));}else{const result=await analyzeAccountInsightsShots(network,images,types);setInsights(result);setValues(all=>({...all,[network]:{...EMPTY_NETWORK_INSIGHTS,...all[network],reachDiagnosis:result.reachDiagnosis,bestTime:result.bestTime,videoInsight:result.videoInsight,postInsight:result.postInsight,updatedAt:all[network]?.updatedAt||0}}));if(result.unreadable)setError('No pude leer estas capturas. Puedes completar los datos manualmente.');}}catch{setError('No pude analizar las capturas. Prueba con imágenes más cercanas o completa los datos a mano.');}finally{setLoading('');}};
  const update=(key:keyof NetworkInsights,next:string)=>setValues(all=>({...all,[network]:{...EMPTY_NETWORK_INSIGHTS,...all[network],[key]:next,updatedAt:all[network]?.updatedAt||0}}));
  const save=async()=>{const combined=buildNetworkInsights({handle:value.handle,followers:value.followers},{reachDiagnosis:value.reachDiagnosis,bestTime:value.bestTime,videoInsight:value.videoInsight,postInsight:value.postInsight,unreadable:false},value.notes);const next={...values,[network]:combined};setValues(next);await onSave(assembleSocialInsights(next));setSaved(network);};
  const outdated=value.updatedAt>0&&Date.now()-value.updatedAt>30*86400000;
  return <div className="space-y-5">
    <div><h2 className="text-lg font-bold text-slate-800">Tus redes</h2><p className="mt-1 text-sm leading-5 text-slate-600">Tus datos ayudan a crear recomendaciones de contenido y horarios basadas en tus resultados reales.</p></div>
    <div className="grid grid-cols-3 gap-2">{networks.map(key=><button key={key} onClick={()=>{setNetwork(key);setProfile(null);setInsights(null);setError('');}} className={`min-h-11 rounded-xl border px-2 text-[13px] font-semibold ${network===key?'border-[#F72C5B] bg-rose-50 text-[#F72C5B]':'border-slate-200 text-slate-600'}`}>{SOCIAL_NETWORK_LABELS[key]}{values[key]?.updatedAt ? ' ✓' : ''}</button>)}</div>
    {value.updatedAt>0&&<div className={`rounded-xl p-4 ${outdated?'bg-amber-50':'bg-emerald-50'}`}><p className="flex items-center gap-2 text-sm font-semibold">{outdated?<AlertTriangle size={17}/>:<CheckCircle2 size={17}/>} {outdated?'Datos con más de 30 días':'Datos guardados para esta red'}</p><div className="mt-2 grid grid-cols-3 gap-2 text-xs"><span>{value.followers||'—'} seguidores</span><span>{value.bestTime||'—'} mejor hora</span><span>{value.reachDiagnosis||'Sin datos de alcance'}</span></div></div>}
    <CaptureGuideUploader guide={guide.profile} actionLabel="Analizar mi perfil" loading={loading==='profile'} onAnalyze={files=>analyze(files,'profile')}/>
    <CaptureGuideUploader guide={guide.insights} actionLabel="Revisar mis estadísticas" loading={loading==='insights'} onAnalyze={files=>analyze(files,'insights')}/>
    {error&&<p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    <div className="grid gap-3 sm:grid-cols-2">{([['handle','Nombre de la cuenta'],['followers','Seguidores'],['bestTime','Mejor horario'],['reachDiagnosis','Alcance'],['videoInsight','Rendimiento de videos'],['postInsight','Rendimiento de publicaciones']] as const).map(([key,label])=><label key={key} className="text-[13px] font-semibold text-slate-700">{label}<input value={value[key]} onChange={e=>update(key,e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal"/></label>)}</div>
    <button onClick={()=>void save()} className="min-h-11 w-full rounded-[14px] bg-[#F72C5B] px-4 font-bold text-white">{saved===network?`${SOCIAL_NETWORK_LABELS[network]} guardado`:`Guardar ${SOCIAL_NETWORK_LABELS[network]}`}</button>
  </div>;
}

function legacyNetworks(current?: BrandSocialInsights): Partial<Record<SocialNetworkKey,NetworkInsights>> {
  if(!current || !(current.instagramHandle||current.followers||current.bestTime)) return {};
  return {instagram:{handle:current.instagramHandle,followers:current.followers,reachDiagnosis:current.reachDiagnosis,videoInsight:current.reelsInsight,postInsight:current.carouselInsight,bestTime:current.bestTime,notes:current.notes,updatedAt:current.updatedAt}};
}
