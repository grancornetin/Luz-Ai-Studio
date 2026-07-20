import React, { useState } from 'react';
import { Loader2, Pencil } from 'lucide-react';
import { POST_GUIDES } from '../../../../services/captureGuides';
import { CaptureGuideUploader } from '../../../brandProfiles/components/CaptureGuideUploader';
import { analyzeInsightsScreenshots } from '../plannerV3AiService';
import { EMPTY_METRICS, type PlanTask, type PostMetrics } from '../plannerV3Types';

const fields = [['reach','Alcance'],['views','Reproducciones'],['likes','Me gusta'],['comments','Comentarios'],['saves','Guardados'],['shares','Compartidos'],['follows','Nuevos seguidores'],['profileVisits','Visitas al perfil']] as const;
type Values = Omit<PostMetrics, 'source' | 'capturedAt'>;

export default function MetricsCapture({ task, onSave }: { task: PlanTask; onSave: (metrics: PostMetrics) => Promise<void> }) {
  const [mode, setMode] = useState<'choose'|'manual'|'screenshot'>(task.metrics ? task.metrics.source : 'choose');
  const [values, setValues] = useState<Values>(task.metrics ? { ...EMPTY_METRICS, ...task.metrics } : { ...EMPTY_METRICS });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const guide = POST_GUIDES[task.platform];
  const upload = async (files: File[]) => {
    if (!files.length) return;
    setLoading(true); setError('');
    try {
      const images = await Promise.all(files.map(file => new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result).split(',')[1]); r.onerror = reject; r.readAsDataURL(file); })));
      const parsed = await analyzeInsightsScreenshots(images, files.map(file => file.type));
      if (Object.values(parsed).every(v => v === null)) { setMode('manual'); setError('No pude leer los números 😅. Prueba otra captura o escríbelos a mano.'); }
      else { setValues(parsed); setMode('screenshot'); }
    } catch { setMode('manual'); setError('No pude leer esta captura. Puedes escribir los números a mano.'); } finally { setLoading(false); }
  };
  return <div className="rounded-2xl border border-slate-200 p-4">
    <h4 className="font-black text-slate-900">{task.title}</h4>
    {mode === 'choose' && <div className="mt-3 space-y-3">
      {guide && <CaptureGuideUploader guide={guide} actionLabel="Analizar capturas de esta publicación" loading={loading} onAnalyze={upload}/>}
      <button onClick={() => setMode('manual')} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border p-3 font-bold text-slate-700"><Pencil size={16}/> Escribir a mano</button>
    </div>}
    {loading && !guide && <p className="mt-3 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="animate-spin" size={16}/> Leyendo las capturas…</p>}
    {error && <p className="mt-3 text-sm text-amber-700">{error}</p>}
    {mode !== 'choose' && !loading && <><p className="mt-3 text-xs text-slate-500">{mode === 'screenshot' ? 'Revisa que los números estén bien antes de guardar.' : 'Completa solo los datos que tengas.'}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">{fields.map(([key,label]) => <label key={key} className="text-xs font-bold text-slate-500">{label}<input type="number" min="0" value={values[key] ?? ''} onChange={e => setValues(v => ({...v,[key]: e.target.value === '' ? null : Number(e.target.value)}))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900"/></label>)}</div>
      <div className="mt-3 flex gap-2"><button disabled={saving} onClick={async () => { setSaving(true); await onSave({...values, source: mode, capturedAt: Date.now()}); setSaving(false); }} className="flex-1 rounded-xl bg-slate-900 p-3 font-black text-white">{saving ? 'Guardando…' : 'Guardar resultados'}</button><button onClick={() => setMode('choose')} className="px-3 text-xs font-bold text-slate-400">Cambiar</button></div>
    </>}
  </div>;
}
