// Pantalla 1 del piloto: "Mi marca".
// Una sola vez, 6 preguntas (una por pantalla, por toque, con respuesta
// preseleccionada) -> 3 ideas de marca completas -> ella elige -> se guarda
// como BrandProfile para que el Plan funcione sin cambios.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, Loader2, Sparkles } from 'lucide-react';
import { FlowShell } from '../../../components/shared/flow/FlowShell';
import {
  ActionCaption, FieldLabel, Footnote, GroupedList, GroupedRow, InlineBanner, LargeTitle,
  PrimaryButton, TextButton, TextField, ChoiceList,
} from '../../../components/shared/flow/primitives';
import { useAuth } from '../../auth/AuthContext';
import type { PilotCategory, PilotSeed } from '../types';
import {
  AUDIENCE_LABEL, CATEGORY_LABEL, CLAIM_LABEL, MATERIAL_LABEL, PRICE_LABEL, STYLE_OPTIONS, VOICE_LABEL,
  defaultSeed, identityService, proposeIdentities, type IdentitySource, type PilotIdentity,
} from '../services/identityService';

export interface MiMarcaScreenProps {
  onDone?: () => void;
}

type Stage = 'loading' | 'exists' | 'intro' | 'q' | 'generating' | 'pick' | 'confirm' | 'saving' | 'done';

const QUESTIONS = ['categories', 'material', 'price', 'audience', 'style', 'voice'] as const;
type QKey = typeof QUESTIONS[number];

const QUESTION_TITLE: Record<QKey, { title: string; subtitle?: string }> = {
  categories: { title: '¿Qué vendes?', subtitle: 'Puedes marcar más de una.' },
  material: { title: '¿De qué material son tus joyas?' },
  price: { title: '¿En qué rango de precios están?' },
  audience: { title: '¿A quién se las imaginas?' },
  style: { title: '¿Qué estilo te gusta?', subtitle: 'Elige 3 que te representen.' },
  voice: { title: '¿Cómo quieres sonar?' },
};

const DARK_STYLES = new Set(['clasico', 'urbano']);

const Pill: React.FC<{ on: boolean }> = ({ on }) =>
  on ? <Check size={20} strokeWidth={2.6} className="shrink-0 text-[color:var(--brand)]" /> : <span className="w-5 shrink-0" />;

export default function MiMarcaScreen({ onDone }: MiMarcaScreenProps) {
  const { user } = useAuth();
  const uid = user?.uid;

  const [stage, setStage] = useState<Stage>('loading');
  const [qIndex, setQIndex] = useState(0);
  const [seed, setSeed] = useState<PilotSeed>(() => defaultSeed());
  const [identities, setIdentities] = useState<PilotIdentity[]>([]);
  const [source, setSource] = useState<IdentitySource>('ai');
  const [chosen, setChosen] = useState(0);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [existingName, setExistingName] = useState('');
  const advanceTimer = useRef<number | undefined>(undefined);

  // ¿Ya tiene marca del piloto? Entonces no se la hacemos repetir.
  useEffect(() => {
    let alive = true;
    if (!uid) { setStage('intro'); return; }
    identityService.getPilotBrand(uid)
      .then((b) => {
        if (!alive) return;
        if (b) { setExistingName(b.brandName); setStage('exists'); } else setStage('intro');
      })
      .catch(() => { if (alive) setStage('intro'); });
    return () => { alive = false; window.clearTimeout(advanceTimer.current); };
  }, [uid]);

  const patch = (p: Partial<PilotSeed>) => setSeed((s) => ({ ...s, ...p }));

  const generate = useCallback(async (s: PilotSeed) => {
    setStage('generating');
    const r = await proposeIdentities(s); // nunca lanza
    setIdentities(r.identities);
    setSource(r.source);
    setChosen(0);
    setExpanded(null);
    setName(r.identities[0]?.name ?? '');
    setStage('pick');
  }, []);

  const next = () => {
    if (qIndex < QUESTIONS.length - 1) setQIndex((i) => i + 1);
    else generate({ ...seed, createdAt: Date.now() });
  };
  const back = () => {
    if (stage === 'q') { if (qIndex > 0) setQIndex((i) => i - 1); else setStage('intro'); }
    else if (stage === 'confirm') setStage('pick');
    else if (stage === 'pick') { setQIndex(QUESTIONS.length - 1); setStage('q'); }
  };
  // Toque en una opción de respuesta única: se guarda y pasa a la siguiente.
  const pickAndAdvance = (p: Partial<PilotSeed>, stay = false) => {
    patch(p);
    if (stay) return;
    window.clearTimeout(advanceTimer.current);
    advanceTimer.current = window.setTimeout(() => nextRef.current(), 220);
  };
  // `next` lee seed al ejecutarse; para el temporizador usamos la versión más nueva.
  const nextRef = useRef(next);
  nextRef.current = next;

  const save = async () => {
    if (!uid) { setSaveError('Necesitas iniciar sesión para guardar tu marca.'); setStage('confirm'); return; }
    const idn = { ...identities[chosen], name: name.trim() || identities[chosen].name };
    setStage('saving');
    setSaveError(null);
    try {
      await identityService.saveIdentity(uid, { ...seed, brandName: idn.name }, idn);
      setStage('done');
    } catch (e) {
      setSaveError('No se pudo guardar tu marca. Revisa tu conexión e inténtalo de nuevo.');
      setStage('confirm');
    }
  };

  // ── Pantallas ──────────────────────────────────────────────────

  if (stage === 'loading') {
    return (
      <FlowShell title="Mi marca">
        <div className="flex min-h-[50dvh] items-center justify-center text-[color:var(--text-2)]">
          <Loader2 className="animate-spin" size={28} aria-label="Cargando" />
        </div>
      </FlowShell>
    );
  }

  if (stage === 'exists') {
    return (
      <FlowShell
        title="Mi marca"
        actions={
          <>
            <PrimaryButton onClick={() => onDone?.()}>Seguir con {existingName || 'mi marca'}</PrimaryButton>
            <TextButton onClick={() => setStage('intro')}>Armar otra identidad</TextButton>
          </>
        }
      >
        <LargeTitle subtitle="Tu marca ya está guardada y el plan de contenido la usa.">
          {existingName || 'Tu marca'}
        </LargeTitle>
      </FlowShell>
    );
  }

  if (stage === 'intro') {
    return (
      <FlowShell
        title="Mi marca"
        onEnter={() => { setQIndex(0); setStage('q'); }}
        actions={
          <>
            <PrimaryButton onClick={() => { setQIndex(0); setStage('q'); }}>Empezar</PrimaryButton>
            <ActionCaption>6 preguntas · menos de 5 minutos</ActionCaption>
          </>
        }
      >
        <LargeTitle display subtitle="Respondes tocando. Yo te propongo 3 ideas de marca y tú eliges una.">
          Armemos tu marca
        </LargeTitle>
        <div className="mt-5">
          <FieldLabel htmlFor="mm-name" optional>¿Ya tienes nombre para tu marca?</FieldLabel>
          <TextField
            id="mm-name"
            value={seed.brandName ?? ''}
            maxLength={40}
            placeholder="Si no tienes, te propongo varios"
            onChange={(e) => patch({ brandName: e.target.value })}
          />
        </div>
      </FlowShell>
    );
  }

  if (stage === 'q') {
    const key = QUESTIONS[qIndex];
    const head = QUESTION_TITLE[key];
    const isLast = qIndex === QUESTIONS.length - 1;
    const needsNote = key === 'material' && seed.material === 'otro';
    const styleOk = key !== 'style' || seed.referenceStyleIds.length === 3;
    const catsOk = key !== 'categories' || seed.categories.length > 0;

    const toggleCategory = (c: PilotCategory) => {
      const has = seed.categories.includes(c);
      if (has && seed.categories.length === 1) return;
      patch({ categories: has ? seed.categories.filter((x) => x !== c) : [...seed.categories, c] });
    };
    const toggleStyle = (id: string) => {
      const cur = seed.referenceStyleIds;
      if (cur.includes(id)) patch({ referenceStyleIds: cur.filter((x) => x !== id) });
      else patch({ referenceStyleIds: [...cur, id].slice(-3) });
    };

    return (
      <FlowShell
        title="Mi marca"
        leading={{ kind: 'back', onPress: back }}
        progress={(qIndex + 1) / (QUESTIONS.length + 1)}
        steps={{ labels: ['Tú', 'Tus ideas', 'Listo'], current: 0 }}
        onEnter={catsOk && styleOk ? next : undefined}
        actions={
          <>
            <PrimaryButton onClick={next} disabled={!catsOk || !styleOk || (needsNote && !(seed.materialNote ?? '').trim())}>
              {isLast ? 'Ver mis 3 ideas' : 'Seguir'}
            </PrimaryButton>
            <ActionCaption>Pregunta {qIndex + 1} de {QUESTIONS.length}</ActionCaption>
          </>
        }
      >
        <LargeTitle subtitle={head.subtitle}>{head.title}</LargeTitle>
        <div className="mt-4 pb-4">
          {key === 'categories' && (
            <GroupedList>
              {(Object.keys(CATEGORY_LABEL) as PilotCategory[]).map((c, i, arr) => (
                <GroupedRow
                  key={c}
                  title={CATEGORY_LABEL[c]}
                  onPress={() => toggleCategory(c)}
                  ariaPressed={seed.categories.includes(c)}
                  last={i === arr.length - 1}
                  trailing={<Pill on={seed.categories.includes(c)} />}
                />
              ))}
            </GroupedList>
          )}

          {key === 'material' && (
            <>
              <ChoiceList
                value={seed.material}
                onChange={(v) => pickAndAdvance({ material: v }, v === 'otro')}
                options={(Object.keys(MATERIAL_LABEL) as Array<PilotSeed['material']>).map((m) => ({
                  value: m,
                  title: MATERIAL_LABEL[m],
                  hint: m === 'no_se' ? 'No pasa nada: no lo mencionaré en tus textos.' : undefined,
                }))}
              />
              {needsNote && (
                <div className="mt-3">
                  <TextField
                    aria-label="Cuál material"
                    placeholder="Por ejemplo: resina, cobre, cristales"
                    value={seed.materialNote ?? ''}
                    maxLength={40}
                    onChange={(e) => patch({ materialNote: e.target.value })}
                  />
                </div>
              )}
            </>
          )}

          {key === 'price' && (
            <ChoiceList
              value={seed.priceRange}
              onChange={(v) => pickAndAdvance({ priceRange: v })}
              options={(Object.keys(PRICE_LABEL) as Array<PilotSeed['priceRange']>).map((p) => ({ value: p, title: PRICE_LABEL[p] }))}
            />
          )}

          {key === 'audience' && (
            <ChoiceList
              value={seed.audience}
              onChange={(v) => pickAndAdvance({ audience: v })}
              options={(Object.keys(AUDIENCE_LABEL) as Array<PilotSeed['audience']>).map((a) => ({ value: a, title: AUDIENCE_LABEL[a] }))}
            />
          )}

          {key === 'style' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                {STYLE_OPTIONS.map((s) => {
                  const on = seed.referenceStyleIds.includes(s.id);
                  const dark = DARK_STYLES.has(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleStyle(s.id)}
                      className={`relative flex aspect-[4/5] min-h-[44px] flex-col justify-end overflow-hidden rounded-[16px] p-3 text-left transition-shadow ${on ? 'ring-[3px] ring-[color:var(--brand)]' : 'ring-1 ring-black/10'}`}
                      style={{ backgroundImage: `linear-gradient(160deg, ${s.from}, ${s.to})` }}
                    >
                      {on && (
                        <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[color:var(--brand)] text-white">
                          <Check size={16} strokeWidth={3} />
                        </span>
                      )}
                      <span className={`text-[16px] font-semibold leading-5 ${dark ? 'text-white' : 'text-[#18181B]'}`}>{s.title}</span>
                      <span className={`mt-0.5 text-[13px] leading-[17px] ${dark ? 'text-white/80' : 'text-[#3F3F46]'}`}>{s.hint}</span>
                    </button>
                  );
                })}
              </div>
              <Footnote className="mt-3">{seed.referenceStyleIds.length} de 3 elegidos</Footnote>
            </>
          )}

          {key === 'voice' && (
            <ChoiceList
              value={seed.voice}
              onChange={(v) => pickAndAdvance({ voice: v })}
              options={([
                ['calida', 'Como una amiga que te recomienda algo que le encanta.'],
                ['elegante', 'Pausada y cuidada, con pocas palabras.'],
                ['juvenil', 'Cercana, con energía y buen humor.'],
              ] as const).map(([v, hint]) => ({ value: v, title: VOICE_LABEL[v], hint }))}
            />
          )}
        </div>
      </FlowShell>
    );
  }

  if (stage === 'generating') {
    return (
      <FlowShell title="Mi marca" steps={{ labels: ['Tú', 'Tus ideas', 'Listo'], current: 1 }}>
        <div className="flex min-h-[55dvh] flex-col items-center justify-center gap-4 text-center">
          <Loader2 className="animate-spin text-[color:var(--brand)]" size={36} aria-hidden />
          <p className="text-[20px] font-semibold leading-7" role="status">Armando 3 ideas para tu marca…</p>
          <p className="max-w-[280px] text-[15px] leading-5 text-[color:var(--text-2)]">Toma unos 20 segundos. No cierres esta pantalla.</p>
        </div>
      </FlowShell>
    );
  }

  if (stage === 'pick') {
    return (
      <FlowShell
        title="Tus ideas"
        leading={{ kind: 'back', onPress: back }}
        steps={{ labels: ['Tú', 'Tus ideas', 'Listo'], current: 1 }}
        onEnter={() => { setName(identities[chosen]?.name ?? ''); setStage('confirm'); }}
        actions={
          <PrimaryButton onClick={() => { setName(identities[chosen]?.name ?? ''); setStage('confirm'); }}>
            Elegir esta
          </PrimaryButton>
        }
      >
        <LargeTitle subtitle="Toca la que más se parezca a ti. Después podrás ajustar el nombre.">Elige tu marca</LargeTitle>
        {source === 'fallback' && (
          <div className="mt-3">
            <InlineBanner
              tone="warn"
              icon={<AlertTriangle size={20} />}
              action={{ label: 'Reintentar', onPress: () => generate(seed) }}
            >
              No pude conectarme, así que te muestro ideas base. Puedes elegir una o reintentar.
            </InlineBanner>
          </div>
        )}
        <div className="mt-4 flex flex-col gap-3 pb-4" role="radiogroup" aria-label="Ideas de marca">
          {identities.map((idn, i) => {
            const on = i === chosen;
            const open = expanded === i;
            return (
              <div
                key={idn.id}
                className={`rounded-[16px] bg-[color:var(--fill)] p-4 transition-shadow ${on ? 'ring-[3px] ring-[color:var(--brand)]' : 'ring-1 ring-black/5'}`}
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => { setChosen(i); setName(idn.name); }}
                  className="block min-h-[44px] w-full text-left"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="text-[22px] font-bold leading-7 tracking-[-0.01em]">{idn.name}</span>
                    <span className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${on ? 'bg-[color:var(--brand)] text-white' : 'bg-black/10 text-transparent'}`}>
                      <Check size={15} strokeWidth={3} />
                    </span>
                  </span>
                  <span className="mt-1.5 block text-[16px] leading-6 text-[color:var(--text)]">{idn.positioning}</span>
                  <span className="mt-3 flex gap-1.5" aria-label="Colores">
                    {idn.palette.map((c) => (
                      <span key={c.hex + c.label} className="h-7 w-7 rounded-full ring-1 ring-black/10" style={{ background: c.hex }} title={c.label} />
                    ))}
                  </span>
                  <span className="mt-3 block text-[15px] italic leading-5 text-[color:var(--text-2)]">“{idn.anchorPhrases[0]}”</span>
                </button>
                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : i)}
                  aria-expanded={open}
                  className="mt-2 flex min-h-[44px] items-center gap-1 text-[15px] font-semibold text-[color:var(--action)]"
                >
                  {open ? 'Ver menos' : 'Ver todo'}
                  <ChevronDown size={18} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
                {open && <IdentityDetail idn={idn} />}
              </div>
            );
          })}
        </div>
      </FlowShell>
    );
  }

  if (stage === 'confirm' || stage === 'saving') {
    const saving = stage === 'saving';
    const idn = identities[chosen];
    const toggleClaim = (c: PilotSeed['confirmedClaims'][number]) =>
      patch({ confirmedClaims: seed.confirmedClaims.includes(c) ? seed.confirmedClaims.filter((x) => x !== c) : [...seed.confirmedClaims, c] });
    // Solo se ofrecen los que corresponden al material que ella dijo.
    const claimKeys = (Object.keys(CLAIM_LABEL) as Array<keyof typeof CLAIM_LABEL>).filter((c) =>
      c === 'plata_925' ? seed.material === 'plata_925'
        : c === 'banado_oro' ? seed.material === 'banado'
        : true);
    return (
      <FlowShell
        title="Confirmar"
        leading={saving ? undefined : { kind: 'back', onPress: back }}
        steps={{ labels: ['Tú', 'Tus ideas', 'Listo'], current: 2 }}
        actions={
          <PrimaryButton onClick={save} loading={saving} disabled={saving || !name.trim()}>
            {saving ? 'Guardando…' : saveError ? 'Reintentar' : 'Guardar mi marca'}
          </PrimaryButton>
        }
      >
        <LargeTitle subtitle="Revisa el nombre y marca solo lo que sea verdad de tus joyas.">Casi lista</LargeTitle>
        {saveError && (
          <div className="mt-3">
            <InlineBanner tone="danger" icon={<AlertTriangle size={20} />} action={{ label: 'Reintentar', onPress: save }}>
              {saveError}
            </InlineBanner>
          </div>
        )}
        <div className="mt-4">
          <FieldLabel htmlFor="mm-final-name">Nombre de tu marca</FieldLabel>
          <TextField id="mm-final-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} disabled={saving} />
        </div>
        <div className="mt-6">
          <FieldLabel>Lo que puedo decir de tus joyas</FieldLabel>
          <GroupedList>
            {claimKeys.map((c, i) => (
              <GroupedRow
                key={c}
                title={CLAIM_LABEL[c]}
                onPress={saving ? undefined : () => toggleClaim(c)}
                ariaPressed={seed.confirmedClaims.includes(c)}
                last={i === claimKeys.length - 1}
                trailing={<Pill on={seed.confirmedClaims.includes(c)} />}
              />
            ))}
          </GroupedList>
          <Footnote className="mt-2">Si no marcas nada, tus textos no afirmarán nada de eso. Así evitas decir algo que no puedas respaldar.</Footnote>
        </div>
        {idn && (
          <div className="mt-6 pb-4">
            <FieldLabel>Tu bio de Instagram</FieldLabel>
            <p className="whitespace-pre-line rounded-[12px] bg-[color:var(--fill)] p-4 text-[16px] leading-6">{idn.instagramBio}</p>
          </div>
        )}
      </FlowShell>
    );
  }

  // done
  return (
    <FlowShell
      title="Listo"
      actions={<PrimaryButton onClick={() => onDone?.()} icon={<Sparkles size={20} />}>Seguir</PrimaryButton>}
    >
      <div className="flex min-h-[45dvh] flex-col items-center justify-center gap-3 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--brand)] text-white"><Check size={30} strokeWidth={3} /></span>
        <LargeTitle subtitle="Tu marca quedó guardada. El siguiente paso es subir tus joyas.">{name || 'Tu marca'} está lista</LargeTitle>
      </div>
    </FlowShell>
  );
}

const IdentityDetail: React.FC<{ idn: PilotIdentity }> = ({ idn }) => (
  <div className="mt-1 space-y-4 border-t border-black/10 pt-3 text-[15px] leading-5">
    <section>
      <h3 className="font-semibold">Cómo habla</h3>
      <p className="text-[color:var(--text-2)]">{idn.voice.summary}</p>
    </section>
    <section>
      <h3 className="font-semibold">Sobre qué vas a publicar</h3>
      <ul className="mt-1 space-y-1.5">
        {idn.pillars.map((p) => (
          <li key={p.title}><span className="font-medium">{p.title}.</span> <span className="text-[color:var(--text-2)]">{p.description}</span></li>
        ))}
      </ul>
    </section>
    <section>
      <h3 className="font-semibold">Tu bio</h3>
      <p className="whitespace-pre-line text-[color:var(--text-2)]">{idn.instagramBio}</p>
    </section>
    <section>
      <h3 className="font-semibold">Frases que te representan</h3>
      <ul className="mt-1 space-y-1 text-[color:var(--text-2)]">
        {idn.anchorPhrases.map((f) => <li key={f}>“{f}”</li>)}
      </ul>
    </section>
  </div>
);
