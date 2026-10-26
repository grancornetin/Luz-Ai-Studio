// Pantalla 2 del piloto: "Mi catálogo".
// Cada pieza es un grupo de 1 a 4 fotos de la MISMA joya desde distintos
// ángulos. Se suben los originales (nunca se sobrescriben), se ficha la pieza
// automáticamente y ella ajusta lo que quiera con un toque.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Camera, Check, Lightbulb, Loader2, Plus, Star, Trash2, X } from 'lucide-react';
import { FlowShell } from '../../../components/shared/flow/FlowShell';
import {
  ActionCaption, FieldLabel, Footnote, GroupedList, GroupedRow, InlineBanner, LargeTitle,
  PrimaryButton, ProgressBar, TextButton, TextField,
} from '../../../components/shared/flow/primitives';
import { useAuth } from '../../auth/AuthContext';
import type { PilotCategory, PilotPriceRange } from '../types';
import {
  MAX_PHOTOS_PER_PIECE, analyzePiece, catalogService, type CatalogItemExt, type PieceAnalysis, type PieceDraft,
} from '../services/catalogService';
import { CATEGORY_LABEL, identityService } from '../services/identityService';

export interface MiCatalogoScreenProps {
  onDone?: () => void;
}

type View = 'list' | 'add' | 'review' | 'edit';
const RECOMMENDED_PIECES = 5;
const CATS = Object.keys(CATEGORY_LABEL) as PilotCategory[];

const clp = (n?: number | null) => (n ? `$${new Intl.NumberFormat('es-CL').format(n)}` : '');
const digits = (s: string) => s.replace(/\D/g, '');

// ── Vista previa de archivos locales ────────────────────────────

function useObjectUrls(files: File[]): string[] {
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  return urls;
}

// ── Formulario de ficha (compartido entre "nueva" y "editar") ───

interface FormState { name: string; category: PilotCategory; material: string; color: string; price: string; star: boolean }

const PieceForm: React.FC<{
  value: FormState;
  onChange: (p: Partial<FormState>) => void;
  suggestedPrice?: number;
  disabled?: boolean;
}> = ({ value, onChange, suggestedPrice, disabled }) => (
  <div className="space-y-5">
    <div>
      <FieldLabel htmlFor="pc-name">Nombre</FieldLabel>
      <TextField id="pc-name" value={value.name} maxLength={48} disabled={disabled} onChange={(e) => onChange({ name: e.target.value })} />
    </div>
    <div>
      <FieldLabel>Tipo de joya</FieldLabel>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tipo de joya">
        {CATS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={value.category === c}
            disabled={disabled}
            onClick={() => onChange({ category: c })}
            className={`min-h-[44px] rounded-full px-4 text-[15px] font-semibold transition-colors ${value.category === c ? 'bg-[color:var(--action)] text-white' : 'bg-[color:var(--fill)] text-[color:var(--text)]'}`}
          >
            {CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <div>
        <FieldLabel htmlFor="pc-material" optional>Material</FieldLabel>
        <TextField id="pc-material" value={value.material} maxLength={40} placeholder="Ej: plata" disabled={disabled} onChange={(e) => onChange({ material: e.target.value })} />
      </div>
      <div>
        <FieldLabel htmlFor="pc-color" optional>Color</FieldLabel>
        <TextField id="pc-color" value={value.color} maxLength={30} placeholder="Ej: dorado" disabled={disabled} onChange={(e) => onChange({ color: e.target.value })} />
      </div>
    </div>
    <div>
      <FieldLabel htmlFor="pc-price" optional>Precio (pesos chilenos)</FieldLabel>
      <TextField
        id="pc-price"
        inputMode="numeric"
        value={value.price ? clp(Number(value.price)) : ''}
        placeholder={suggestedPrice ? `Sugerido ${clp(suggestedPrice)}` : '$0'}
        disabled={disabled}
        onChange={(e) => onChange({ price: digits(e.target.value).slice(0, 8) })}
      />
      {suggestedPrice ? (
        <button
          type="button"
          onClick={() => onChange({ price: String(suggestedPrice) })}
          className="mt-1 min-h-[44px] text-[15px] font-semibold text-[color:var(--action)]"
        >
          Usar el precio sugerido ({clp(suggestedPrice)})
        </button>
      ) : null}
    </div>
    <GroupedList>
      <GroupedRow
        title="Pieza estrella"
        subtitle="Es la que más te gustaría vender; aparecerá más seguido en tu plan."
        onPress={disabled ? undefined : () => onChange({ star: !value.star })}
        ariaPressed={value.star}
        last
        trailing={value.star ? <Star size={22} className="shrink-0 fill-[color:var(--brand)] text-[color:var(--brand)]" /> : <Star size={22} className="shrink-0 text-[color:var(--placeholder)]" />}
      />
    </GroupedList>
  </div>
);

const Tips: React.FC<{ tips: string[] }> = ({ tips }) =>
  tips.length === 0 ? null : (
    <div className="rounded-[12px] bg-[color:var(--fill)] p-3" role="status">
      <p className="mb-1.5 flex items-center gap-2 text-[15px] font-semibold"><Lightbulb size={18} className="text-[color:var(--brand)]" aria-hidden /> Para que tus fotos salgan mejor</p>
      <ul className="space-y-1 text-[15px] leading-5 text-[color:var(--text-2)]">
        {tips.map((t) => <li key={t}>{t}</li>)}
      </ul>
    </div>
  );

// ── Pantalla ────────────────────────────────────────────────────

export default function MiCatalogoScreen({ onDone }: MiCatalogoScreenProps) {
  const { user } = useAuth();
  const uid = user?.uid;

  const [items, setItems] = useState<CatalogItemExt[]>([]);
  const [load, setLoad] = useState<'loading' | 'error' | 'ready'>('loading');
  const [view, setView] = useState<View>('list');
  const [priceRange, setPriceRange] = useState<PilotPriceRange | undefined>();

  // pieza nueva
  const [files, setFiles] = useState<File[]>([]);
  const previews = useObjectUrls(files);
  const [analysis, setAnalysis] = useState<PieceAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [form, setForm] = useState<FormState>({ name: '', category: 'aros', material: '', color: '', price: '', star: false });
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [fileNote, setFileNote] = useState<string | null>(null);

  // pieza abierta para editar
  const [editId, setEditId] = useState<string | null>(null);
  const [addingAngle, setAddingAngle] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);
  const editing = items.find((i) => i.id === editId) ?? null;

  const reload = useCallback(async () => {
    if (!uid) { setLoad('ready'); return; }
    setLoad('loading');
    try { setItems(await catalogService.list(uid)); setLoad('ready'); } catch { setLoad('error'); }
  }, [uid]);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    if (!uid) return;
    identityService.getPilotBrand(uid).then((b) => setPriceRange(b?.pilotSeed?.priceRange)).catch(() => undefined);
  }, [uid]);

  // ── selección de fotos ──
  const openPicker = () => fileInput.current?.click();

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!picked.length) return;
    const imgs = picked.filter((f) => f.type.startsWith('image/'));
    setFileNote(imgs.length < picked.length ? 'Algunos archivos no eran fotos y los dejé fuera.' : null);
    if (view === 'edit' && editing) { addAngleToEditing(imgs[0]); return; }
    setFiles((cur) => {
      const room = MAX_PHOTOS_PER_PIECE - cur.length;
      if (imgs.length > room) setFileNote(`Cada pieza admite hasta ${MAX_PHOTOS_PER_PIECE} fotos; dejé las primeras.`);
      return [...cur, ...imgs.slice(0, room)];
    });
  };

  const addAngleToEditing = async (file?: File) => {
    if (!uid || !editing || !file) return;
    setAddingAngle(true); setError(null);
    try {
      const updated = await catalogService.addAngle(uid, editing, file);
      setItems((cur) => cur.map((i) => (i.id === updated.id ? updated : i)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo subir la foto. Inténtalo de nuevo.');
    } finally { setAddingAngle(false); }
  };

  const startAdd = () => { setFiles([]); setAnalysis(null); setError(null); setFileNote(null); setView('add'); };

  const goReview = async () => {
    setView('review'); setAnalysis(null); setAnalyzing(true); setError(null);
    const a = await analyzePiece(files, { priceRange }); // nunca lanza
    setAnalysis(a);
    setForm({
      name: a.name, category: a.category, material: a.material, color: a.color,
      price: a.suggestedPriceCLP ? String(a.suggestedPriceCLP) : '', star: items.length === 0,
    });
    setAnalyzing(false);
  };

  const savePiece = async () => {
    if (!uid) { setError('Necesitas iniciar sesión para guardar tu catálogo.'); return; }
    setSaving(true); setError(null); setProgress({ done: 0, total: files.length });
    const draft: PieceDraft = {
      name: form.name, category: form.category, material: form.material, color: form.color,
      priceCLP: form.price ? Number(form.price) : undefined,
      tags: analysis?.tags ?? [], quality: analysis?.quality,
      role: form.star ? 'ancla' : 'nuevo', source: analysis?.source ?? 'fallback',
      suggestedPriceCLP: analysis?.suggestedPriceCLP,
    };
    try {
      const created = await catalogService.create(uid, draft, files, (done, total) => setProgress({ done, total }));
      setItems((cur) => [created, ...cur.map((i) => (form.star && i.role === 'ancla' ? { ...i, role: 'normal' as const } : i))]);
      setFiles([]); setView('list');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la pieza. Inténtalo de nuevo.');
    } finally { setSaving(false); }
  };

  const openEdit = (i: CatalogItemExt) => {
    setEditId(i.id); setError(null); setConfirmDelete(false);
    setForm({ name: i.name, category: i.category, material: i.material ?? '', color: i.color ?? '', price: i.priceCLP ? String(i.priceCLP) : '', star: i.role === 'ancla' });
    setView('edit');
  };

  const saveEdit = async () => {
    if (!uid || !editing) return;
    setSaving(true); setError(null);
    try {
      const updated = await catalogService.update(uid, editing, {
        name: form.name.trim() || editing.name, category: form.category, material: form.material.trim(), color: form.color.trim(),
        priceCLP: form.price ? Number(form.price) : undefined, role: form.star ? 'ancla' : editing.role === 'ancla' ? 'normal' : editing.role,
      });
      setItems((cur) => cur.map((i) => (i.id === updated.id ? updated : i)));
      setView('list');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el cambio.');
    } finally { setSaving(false); }
  };

  const removeEditing = async () => {
    if (!uid || !editing) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setSaving(true);
    try { await catalogService.remove(uid, editing); setItems((cur) => cur.filter((i) => i.id !== editing.id)); setView('list'); }
    catch { setError('No se pudo borrar la pieza. Inténtalo de nuevo.'); }
    finally { setSaving(false); setConfirmDelete(false); }
  };

  const hiddenInput = (
    <input ref={fileInput} type="file" accept="image/*" multiple={view === 'add'} className="hidden" onChange={onPick} aria-hidden tabIndex={-1} />
  );

  // ── Agregar: elegir fotos ──
  if (view === 'add') {
    return (
      <FlowShell
        title="Nueva pieza"
        leading={{ kind: 'back', onPress: () => setView('list') }}
        actions={
          <>
            <PrimaryButton onClick={goReview} disabled={files.length === 0}>
              {files.length === 1 ? 'Seguir con 1 foto' : 'Revisar mi pieza'}
            </PrimaryButton>
            <ActionCaption>{files.length} de {MAX_PHOTOS_PER_PIECE} fotos</ActionCaption>
          </>
        }
      >
        {hiddenInput}
        <LargeTitle subtitle="Sube 2 a 4 fotos de la misma joya: de frente, de lado y de cerca. Así las fotos nuevas salen más fieles.">
          Fotos de tu pieza
        </LargeTitle>
        {fileNote && <p className="mt-2 text-[15px] text-[color:var(--text-2)]" role="status">{fileNote}</p>}
        <div className="mt-4 grid grid-cols-2 gap-3 pb-4">
          {previews.map((src, i) => (
            <div key={src} className="relative aspect-[3/4] overflow-hidden rounded-[16px] bg-[color:var(--fill)]">
              <img src={src} alt={`Foto ${i + 1} de tu pieza`} className="h-full w-full object-cover" />
              <button
                type="button"
                aria-label={`Quitar foto ${i + 1}`}
                onClick={() => setFiles((cur) => cur.filter((_, k) => k !== i))}
                className="absolute right-1.5 top-1.5 flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white"
              >
                <X size={20} />
              </button>
              <span className="absolute bottom-2 left-2 rounded-full bg-black/55 px-2.5 py-1 text-[13px] font-semibold text-white">Ángulo {i + 1}</span>
            </div>
          ))}
          {files.length < MAX_PHOTOS_PER_PIECE && (
            <button
              type="button"
              onClick={openPicker}
              className="flex aspect-[3/4] min-h-[44px] flex-col items-center justify-center gap-2 rounded-[16px] border-2 border-dashed border-[color:var(--brand)]/50 bg-[color:var(--tint)] text-[color:var(--action)]"
            >
              {files.length === 0 ? <Camera size={30} /> : <Plus size={30} />}
              <span className="px-2 text-center text-[16px] font-semibold leading-5">{files.length === 0 ? 'Tomar o elegir fotos' : 'Añadir otro ángulo'}</span>
            </button>
          )}
        </div>
        {files.length === 1 && (
          <InlineBanner tone="warn" icon={<Lightbulb size={20} />}>
            Con un solo ángulo funciona, pero con 2 o más las fotos nuevas se parecen más a tu joya real.
          </InlineBanner>
        )}
      </FlowShell>
    );
  }

  // ── Agregar: revisar ficha ──
  if (view === 'review') {
    return (
      <FlowShell
        title="Tu pieza"
        leading={saving ? undefined : { kind: 'back', onPress: () => setView('add') }}
        actions={
          analyzing ? undefined : (
            <>
              <PrimaryButton onClick={savePiece} loading={saving} disabled={saving || !form.name.trim()}>
                {saving ? 'Subiendo…' : error ? 'Reintentar' : 'Guardar pieza'}
              </PrimaryButton>
              {saving && <ProgressBar value={progress.total ? progress.done / progress.total : 0} label={`Subiendo foto ${Math.min(progress.done + 1, progress.total)} de ${progress.total}`} />}
            </>
          )
        }
      >
        {analyzing ? (
          <div className="flex min-h-[55dvh] flex-col items-center justify-center gap-4 text-center">
            <Loader2 size={36} className="animate-spin text-[color:var(--brand)]" aria-hidden />
            <p className="text-[20px] font-semibold leading-7" role="status">Mirando tu pieza…</p>
            <p className="max-w-[280px] text-[15px] leading-5 text-[color:var(--text-2)]">Estoy anotando el tipo, el color y un precio de referencia.</p>
          </div>
        ) : (
          <>
            <LargeTitle subtitle={analysis?.source === 'fallback' ? 'No pude leer la foto, completa los datos tú. Son solo 4 toques.' : 'Revisa los datos. Cámbialos si algo no calza.'}>
              Así quedó tu pieza
            </LargeTitle>
            <div className="mt-3 flex gap-2 overflow-hidden" aria-label="Tus fotos">
              {previews.map((src, i) => (
                <img key={src} src={src} alt={`Foto ${i + 1}`} className="aspect-[3/4] w-[calc((100%-1.5rem)/4)] rounded-[12px] object-cover" />
              ))}
            </div>
            {error && (
              <div className="mt-3">
                <InlineBanner tone="danger" icon={<AlertTriangle size={20} />} action={{ label: 'Reintentar', onPress: savePiece, loading: saving }}>{error}</InlineBanner>
              </div>
            )}
            <div className="mt-4"><Tips tips={analysis?.quality.tips ?? []} /></div>
            <div className="mt-5 pb-4">
              <PieceForm value={form} onChange={(p) => setForm((f) => ({ ...f, ...p }))} suggestedPrice={analysis?.suggestedPriceCLP} disabled={saving} />
            </div>
          </>
        )}
      </FlowShell>
    );
  }

  // ── Editar pieza existente ──
  if (view === 'edit' && editing) {
    return (
      <FlowShell
        title="Editar pieza"
        leading={saving ? undefined : { kind: 'back', onPress: () => setView('list') }}
        actions={
          <>
            <PrimaryButton onClick={saveEdit} loading={saving} disabled={saving || !form.name.trim()}>Guardar cambios</PrimaryButton>
            <TextButton onClick={removeEditing} disabled={saving} className="!text-[color:var(--danger-fg)]">
              {confirmDelete ? 'Toca otra vez para borrar la pieza' : 'Borrar esta pieza'}
            </TextButton>
          </>
        }
      >
        {hiddenInput}
        <LargeTitle>{editing.name}</LargeTitle>
        {error && (
          <div className="mt-3"><InlineBanner tone="danger" icon={<AlertTriangle size={20} />}>{error}</InlineBanner></div>
        )}
        <div className="mt-3 grid grid-cols-2 gap-3">
          {editing.originalPhotos.map((p, i) => (
            <div key={p.path} className="relative aspect-[3/4] overflow-hidden rounded-[16px] bg-[color:var(--fill)]">
              <img src={p.url} alt={`Ángulo ${i + 1} de ${editing.name}`} className="h-full w-full object-cover" loading="lazy" />
              <span className="absolute bottom-2 left-2 rounded-full bg-black/55 px-2.5 py-1 text-[13px] font-semibold text-white">Ángulo {i + 1}</span>
            </div>
          ))}
          {editing.originalPhotos.length < MAX_PHOTOS_PER_PIECE && (
            <button
              type="button"
              onClick={openPicker}
              disabled={addingAngle}
              className="flex aspect-[3/4] min-h-[44px] flex-col items-center justify-center gap-2 rounded-[16px] border-2 border-dashed border-[color:var(--brand)]/50 bg-[color:var(--tint)] text-[color:var(--action)] disabled:opacity-60"
            >
              {addingAngle ? <Loader2 size={28} className="animate-spin" /> : <Plus size={30} />}
              <span className="text-[16px] font-semibold">{addingAngle ? 'Subiendo…' : 'Añadir otro ángulo'}</span>
            </button>
          )}
        </div>
        <div className="mt-4"><Tips tips={editing.photoQuality?.tips ?? []} /></div>
        <div className="mt-5 pb-4">
          <PieceForm value={form} onChange={(p) => setForm((f) => ({ ...f, ...p }))} suggestedPrice={editing.suggestedPriceCLP} disabled={saving} />
        </div>
      </FlowShell>
    );
  }

  // ── Lista ──
  const enough = items.length >= RECOMMENDED_PIECES;
  return (
    <FlowShell
      title="Mi catálogo"
      actions={
        <>
          <PrimaryButton onClick={startAdd} icon={<Plus size={20} />} disabled={load === 'loading'}>Añadir una pieza</PrimaryButton>
          {items.length > 0 && onDone && <TextButton onClick={onDone}>{enough ? 'Listo, seguir' : 'Seguir sin más piezas'}</TextButton>}
          <ActionCaption>{items.length} {items.length === 1 ? 'pieza' : 'piezas'} · lo ideal son {RECOMMENDED_PIECES} o más</ActionCaption>
        </>
      }
    >
      {hiddenInput}
      <LargeTitle subtitle="Cada pieza con sus fotos desde varios ángulos. Con eso armo tus publicaciones.">Mis piezas</LargeTitle>

      {load === 'loading' && (
        <div className="flex min-h-[40dvh] items-center justify-center"><Loader2 size={28} className="animate-spin text-[color:var(--text-2)]" aria-label="Cargando tu catálogo" /></div>
      )}

      {load === 'error' && (
        <div className="mt-4">
          <InlineBanner tone="danger" icon={<AlertTriangle size={20} />} action={{ label: 'Reintentar', onPress: reload }}>
            No pude cargar tu catálogo. Revisa tu conexión.
          </InlineBanner>
        </div>
      )}

      {load === 'ready' && items.length === 0 && (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-[16px] bg-[color:var(--fill)] px-6 py-10 text-center">
          <Camera size={34} className="text-[color:var(--brand)]" aria-hidden />
          <p className="text-[18px] font-semibold leading-6">Aún no tienes piezas</p>
          <p className="text-[15px] leading-5 text-[color:var(--text-2)]">Toma 2 a 4 fotos de una joya y la dejo lista para tu plan. Parte con la que más quieras vender.</p>
        </div>
      )}

      {items.length > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-4 pb-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((i) => {
            const tips = i.photoQuality?.tips?.length ?? 0;
            return (
              <button
                key={i.id}
                type="button"
                onClick={() => openEdit(i)}
                className="group overflow-hidden rounded-[16px] bg-[color:var(--fill)] text-left active:opacity-80"
                aria-label={`Editar ${i.name}`}
              >
                <div className="relative aspect-[4/5] bg-black/5">
                  {i.originalPhotos[0] && <img src={i.originalPhotos[0].url} alt={i.name} className="h-full w-full object-cover" loading="lazy" />}
                  <span className="absolute left-2.5 top-2.5 rounded-full bg-black/60 px-3 py-1 text-[13px] font-semibold text-white">
                    {i.originalPhotos.length} {i.originalPhotos.length === 1 ? 'foto' : 'fotos'}
                  </span>
                  {i.role === 'ancla' && (
                    <span className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-full bg-[color:var(--brand)] px-3 py-1 text-[13px] font-semibold text-white">
                      <Star size={13} className="fill-white" /> Estrella
                    </span>
                  )}
                </div>
                <div className="p-3.5">
                  <p className="text-[18px] font-bold leading-6">{i.name}</p>
                  <p className="mt-0.5 text-[15px] leading-5 text-[color:var(--text-2)]">
                    {[CATEGORY_LABEL[i.category], i.material, clp(i.priceCLP)].filter(Boolean).join(' · ')}
                  </p>
                  {i.originalPhotos.length > 1 && (
                    <div className="mt-2.5 flex gap-1.5">
                      {i.originalPhotos.slice(1).map((p) => (
                        <img key={p.path} src={p.url} alt="" className="h-11 w-9 rounded-[8px] object-cover" loading="lazy" />
                      ))}
                    </div>
                  )}
                  {tips > 0 && (
                    <p className="mt-2.5 flex items-center gap-1.5 text-[14px] font-medium text-[color:var(--warn-fg)]">
                      <Lightbulb size={16} aria-hidden /> {i.photoQuality!.tips[0]}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
      {items.length > 0 && !enough && <Footnote icon={<Check size={14} />} className="pb-2">Con {RECOMMENDED_PIECES} piezas o más tu plan sale más variado.</Footnote>}
    </FlowShell>
  );
}
