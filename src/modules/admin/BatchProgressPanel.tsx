import React, { useEffect, useState } from 'react';
import {
  collection, query, orderBy, limit, onSnapshot, where,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../auth/AuthContext';
import { getAuth } from 'firebase/auth';
import { Navigate } from 'react-router-dom';

// ── Tipos ─────────────────────────────────────────────────────────────────────

type BatchStatus = 'queued' | 'processing' | 'completed' | 'completed_with_errors';

interface BatchDoc {
  id: string;
  name: string;
  total: number;
  pending: number;
  completed: number;
  failed: number;
  status: BatchStatus;
  createdAt: any;
  finishedAt?: any;
}

interface BatchItem {
  id: string;
  batchId: string;
  index: number;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  category: string;
  normalizedPrompt?: string;
  publishedPromptId?: string;
  error?: string;
  attempts: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(n: number, total: number): number {
  if (!total) return 0;
  return Math.round((n / total) * 100);
}

function formatDate(val: any): string {
  if (!val) return '—';
  const d = val?.toDate ? val.toDate() : new Date(val);
  return d.toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
}

const STATUS_LABEL: Record<BatchStatus, string> = {
  queued:                 'En cola',
  processing:             'Procesando',
  completed:              'Completado',
  completed_with_errors:  'Completado con errores',
};

const STATUS_COLOR: Record<BatchStatus, string> = {
  queued:                'bg-slate-100 text-slate-500',
  processing:            'bg-blue-100 text-blue-600',
  completed:             'bg-emerald-100 text-emerald-700',
  completed_with_errors: 'bg-amber-100 text-amber-700',
};

// ── Componente principal ──────────────────────────────────────────────────────

const BatchProgressPanel: React.FC = () => {
  const { isAdmin } = useAuth();
  const [batches, setBatches]         = useState<BatchDoc[]>([]);
  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [items, setItems]             = useState<BatchItem[]>([]);
  const [itemFilter, setItemFilter]   = useState<'all' | 'failed' | 'completed'>('all');
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [circuitResetting, setCircuitResetting] = useState(false);
  const [circuitMsg, setCircuitMsg]   = useState<string | null>(null);

  // Suscripción a batches (últimos 10)
  useEffect(() => {
    if (!isAdmin) return;
    const q = query(
      collection(db, 'prompt_batches'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    const unsub = onSnapshot(q,
      snap => {
        setBatches(snap.docs.map(d => ({ id: d.id, ...d.data() } as BatchDoc)));
        setLoadingBatches(false);
      },
      err => {
        console.error('[BatchProgressPanel] Firestore error:', err);
        setLoadingBatches(false);
      }
    );
    return unsub;
  }, [isAdmin]);

  // Suscripción a items del batch seleccionado
  useEffect(() => {
    if (!selectedId) { setItems([]); return; }
    const q = query(
      collection(db, 'prompt_batch_items'),
      where('batchId', '==', selectedId),
      orderBy('index', 'asc'),
      limit(200)
    );
    const unsub = onSnapshot(q, snap => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as BatchItem)));
    });
    return unsub;
  }, [selectedId]);

  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const selected = batches.find(b => b.id === selectedId) ?? null;

  const filteredItems = items.filter(item => {
    if (itemFilter === 'failed')    return item.status === 'failed';
    if (itemFilter === 'completed') return item.status === 'completed';
    return true;
  });

  async function handleResetCircuits() {
    setCircuitResetting(true);
    setCircuitMsg(null);
    try {
      const token = await getAuth().currentUser?.getIdToken();
      const res = await fetch('/api/gemini/image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          action: 'resetCircuits',
          payload: { secret: import.meta.env.VITE_BATCH_ADMIN_SECRET },
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setCircuitMsg('Circuits reseteados. Gemini, Seedream y GPT Image 2 vuelven a estar activos.');
      } else {
        setCircuitMsg(`Error: ${data.error || res.status}`);
      }
    } catch (e: any) {
      setCircuitMsg(`Error de red: ${e.message}`);
    } finally {
      setCircuitResetting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">

      {/* Header */}
      <header className="bg-white border-b border-slate-100 px-6 md:px-12 py-10">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <div className="w-10 h-10 bg-rose-600 text-white rounded-xl flex items-center justify-center">
            <i className="fa-solid fa-layer-group text-sm" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight italic">
              Batch Import Admin
            </h1>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
              Solo visible para administradores
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 md:px-12 py-10 space-y-8">

        {/* Diagnóstico de infraestructura */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">
            Infraestructura — Circuit Breakers
          </h2>
          <p className="text-sm text-slate-500">
            Cuando Gemini o GPT Image 2 falla repetidamente, el sistema los marca como caídos por 2 horas y hace fallback al otro modelo.
            Si los errores ya se resolvieron, reseteá aquí para volver al modelo primario.
          </p>
          <button
            type="button"
            onClick={handleResetCircuits}
            disabled={circuitResetting}
            className="px-5 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-bold disabled:opacity-50 hover:bg-rose-700 transition-colors"
          >
            {circuitResetting ? 'Reseteando...' : 'Resetear todos los circuit breakers'}
          </button>
          {circuitMsg && (
            <p className={`text-sm font-medium ${circuitMsg.startsWith('Error') ? 'text-red-600' : 'text-emerald-600'}`}>
              {circuitMsg}
            </p>
          )}
        </section>

        {/* Lista de batches */}
        <section>
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">
            Batches recientes
          </h2>

          {loadingBatches ? (
            <div className="text-slate-400 text-sm">Cargando...</div>
          ) : batches.length === 0 ? (
            <div className="text-slate-400 text-sm">No hay batches todavía.</div>
          ) : (
            <div className="space-y-3">
              {batches.map(batch => {
                const done      = batch.completed + batch.failed;
                const progress  = pct(done, batch.total);
                const isActive  = selectedId === batch.id;

                return (
                  <button
                    key={batch.id}
                    onClick={() => setSelectedId(isActive ? null : batch.id)}
                    className={`w-full text-left rounded-2xl border p-5 transition-all ${
                      isActive
                        ? 'border-indigo-300 bg-indigo-50 shadow-md'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{batch.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{formatDate(batch.createdAt)}</p>
                      </div>
                      <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${STATUS_COLOR[batch.status]}`}>
                        {STATUS_LABEL[batch.status]}
                      </span>
                    </div>

                    {/* Barra de progreso */}
                    <div className="w-full bg-slate-100 rounded-full h-2 mb-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${
                          batch.failed > 0 ? 'bg-amber-400' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>

                    {/* Contadores */}
                    <div className="flex gap-4 text-xs font-bold">
                      <span className="text-slate-500">Total: <b className="text-slate-800">{batch.total}</b></span>
                      <span className="text-emerald-600">OK: <b>{batch.completed}</b></span>
                      <span className="text-amber-600">Error: <b>{batch.failed}</b></span>
                      <span className="text-blue-500">Pendiente: <b>{batch.pending}</b></span>
                      <span className="text-slate-400 ml-auto">{progress}%</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Detalle del batch seleccionado */}
        {selected && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">
                Items del batch
              </h2>
              <div className="flex gap-2">
                {(['all', 'completed', 'failed'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setItemFilter(f)}
                    className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full transition-all ${
                      itemFilter === f
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {f === 'all' ? 'Todos' : f === 'completed' ? 'OK' : 'Errores'}
                  </button>
                ))}
              </div>
            </div>

            {items.length === 0 ? (
              <div className="text-slate-400 text-sm">Cargando items...</div>
            ) : (
              <div className="space-y-2">
                {filteredItems.map(item => (
                  <div
                    key={item.id}
                    className={`rounded-xl border px-4 py-3 text-xs flex flex-wrap gap-x-4 gap-y-1 items-start ${
                      item.status === 'completed' ? 'border-emerald-100 bg-emerald-50' :
                      item.status === 'failed'    ? 'border-rose-100 bg-rose-50' :
                      item.status === 'processing'? 'border-blue-100 bg-blue-50 animate-pulse' :
                      'border-slate-100 bg-white'
                    }`}
                  >
                    <span className="font-bold text-slate-500 w-6">#{item.index + 1}</span>

                    <span className={`font-black uppercase tracking-widest px-2 py-0.5 rounded-full text-[10px] ${
                      item.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                      item.status === 'failed'    ? 'bg-rose-100 text-rose-700' :
                      item.status === 'processing'? 'bg-blue-100 text-blue-700' :
                      'bg-slate-100 text-slate-500'
                    }`}>
                      {item.status}
                    </span>

                    <span className="text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                      {item.category}
                    </span>

                    <span className="text-slate-600 flex-1 min-w-0 truncate">
                      {item.normalizedPrompt?.slice(0, 100) || '—'}
                    </span>

                    {item.publishedPromptId && (
                      <a
                        href={`/#/prompt-gallery`}
                        className="text-indigo-500 hover:underline font-bold"
                        title={`promptId: ${item.publishedPromptId}`}
                      >
                        Ver →
                      </a>
                    )}

                    {item.error && (
                      <span className="text-rose-600 w-full mt-1 font-mono text-[10px]">
                        {item.error}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

      </main>
    </div>
  );
};

export default BatchProgressPanel;
