import React from 'react';
import { Sparkles, MessageCircle, ShoppingBag, Calendar, Wand2 } from 'lucide-react';
import type { BrandProfile } from '../types';

interface Props {
  step: number;
  data: Partial<BrandProfile>;
}

function PreviewShell({ eyebrow, title, children }: { eyebrow?: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-50 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
          {eyebrow || 'Preview en tiempo real'}
        </span>
      </div>
      <div className="p-4">
        <p className="text-xs font-black text-slate-600 uppercase tracking-wider mb-3">{title}</p>
        {children}
      </div>
    </div>
  );
}

// Pantalla 2 — Identidad
function IdentityPreview({ data }: { data: Partial<BrandProfile> }) {
  const primaryColor = data.visualIdentity?.colors?.[0]?.hex || '#F72C5B';
  const initial = (data.brandName || 'M').slice(0, 1).toUpperCase();
  return (
    <PreviewShell title="Tu marca al instante">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-md"
            style={{ background: primaryColor }}
          >
            {initial}
          </div>
          <div>
            <p className="font-black text-slate-800 text-sm">{data.brandName || 'Tu marca'}</p>
            <p className="text-[11px] text-slate-400">{data.mainCategory || 'Categoría'}</p>
          </div>
        </div>
        {data.shortDescription && (
          <p className="text-xs text-slate-600 leading-relaxed border-t border-slate-50 pt-3">
            {data.shortDescription}
          </p>
        )}
        <div className="flex gap-2">
          {data.country && (
            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded-lg font-bold">{data.country}</span>
          )}
        </div>
      </div>
    </PreviewShell>
  );
}

// Pantalla 3 — Cliente ideal
function CustomerPreview({ data }: { data: Partial<BrandProfile> }) {
  const tc = data.targetCustomer;
  return (
    <PreviewShell title="Así se verá en el Planner">
      <div className="space-y-2">
        <div className="bg-slate-50 rounded-xl p-3">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Cliente ideal</p>
          <p className="text-xs text-slate-700 font-semibold">
            {tc?.genderFocus || '—'} · {tc?.ageRange || '—'} años
          </p>
          {tc?.buyingMotivation?.length ? (
            <div className="flex flex-wrap gap-1 mt-2">
              {tc.buyingMotivation.slice(0, 3).map(m => (
                <span key={m} className="text-[10px] bg-white border border-slate-100 px-2 py-0.5 rounded-lg text-slate-600">{m}</span>
              ))}
            </div>
          ) : null}
        </div>
        {tc?.freeDescription && (
          <p className="text-[11px] text-slate-500 italic leading-relaxed">"{tc.freeDescription.slice(0, 100)}{tc.freeDescription.length > 100 ? '...' : ''}"</p>
        )}
        <div className="bg-rose-50 rounded-xl p-2 text-[10px] text-[#F72C5B] font-bold flex items-center gap-1.5">
          <Sparkles size={11} /> El Planner usará esto para crear mejores ideas
        </div>
      </div>
    </PreviewShell>
  );
}

// Pantalla 4 — Percepción
function PerceptionPreview({ data }: { data: Partial<BrandProfile> }) {
  const pos = data.positioning;
  const levelExamples: Record<string, { price: string; desc: string }> = {
    'Económica':   { price: '$990',  desc: 'Precio accesible para todas' },
    'Accesible':   { price: '$2.990', desc: 'Buena calidad a buen precio' },
    'Media':       { price: '$8.990', desc: 'Calidad equilibrada' },
    'Media-alta':  { price: '$18.990', desc: 'Diseño cuidado y atención' },
    'Premium':     { price: '$45.000', desc: 'Exclusivo y de lujo' },
  };
  const ex = pos?.perceivedLevel ? levelExamples[pos.perceivedLevel] : null;
  return (
    <PreviewShell title="Cómo perciben tu marca">
      <div className="space-y-3">
        {pos?.perceivedLevel && (
          <div className="rounded-xl border border-slate-100 p-3">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Nivel percibido</p>
            <p className="font-black text-slate-800 text-sm">{pos.perceivedLevel}</p>
            {ex && <p className="text-[11px] text-slate-400 mt-1">Precio referencial: {ex.price} · {ex.desc}</p>}
          </div>
        )}
        {pos?.brandPromise && (
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Tu promesa</p>
            <p className="text-xs text-slate-700 italic">"{pos.brandPromise}"</p>
          </div>
        )}
      </div>
    </PreviewShell>
  );
}

// Pantalla 5 — Tono
function TonePreview({ data }: { data: Partial<BrandProfile> }) {
  const v = data.voice;
  const primaryColor = data.visualIdentity?.colors?.[0]?.hex || '#F72C5B';
  const exampleCaptions: Record<string, string> = {
    'Cercana':         '¡Nuevo ingreso! Sabes que lo necesitabas 🙌 Escríbenos y te asesoramos.',
    'Elegante':        'Porque cada detalle cuenta. Nuevos modelos disponibles — consulta disponibilidad.',
    'Juvenil':         'OH WAIT 😱 llegaron los nuevos y son increíbles. ¡Comenta tu favorito!',
    'Premium':         'Diseño que eleva. Piezas seleccionadas para quienes aprecian lo auténtico.',
    'Profesional':     'Conocé nuestra nueva colección. Calidad garantizada y envío rápido.',
    'Inspiradora':     'Cada pieza tiene una historia. ¿Cuál será la tuya?',
  };
  const tone = v?.toneKeywords?.[0];
  const caption = tone ? exampleCaptions[tone] : 'Aquí aparecerá un caption ejemplo según el tono que elijas.';
  return (
    <PreviewShell title="Caption ejemplo">
      <div className="space-y-3">
        {v?.toneKeywords?.length ? (
          <div className="flex flex-wrap gap-1">
            {v.toneKeywords.map(t => (
              <span key={t} className="text-[10px] font-bold px-2 py-0.5 rounded-lg" style={{ background: `${primaryColor}15`, color: primaryColor }}>{t}</span>
            ))}
          </div>
        ) : null}
        <div className="bg-slate-50 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <MessageCircle size={13} className="text-slate-400" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Caption IA</span>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed">{caption}</p>
        </div>
        {v?.formality && (
          <p className="text-[10px] text-slate-400">Formalidad: <strong>{v.formality}</strong> · Emojis: <strong>{v.emojiLevel || '—'}</strong></p>
        )}
      </div>
    </PreviewShell>
  );
}

// Pantalla 6 — Visual
function VisualPreview({ data }: { data: Partial<BrandProfile> }) {
  const colors = data.visualIdentity?.colors || [];
  const primaryColor = colors[0]?.hex || '#F72C5B';
  const initial = (data.brandName || 'M').slice(0, 1).toUpperCase();
  const logo = data.visualIdentity?.assets?.find(a => a.type === 'logo');
  return (
    <PreviewShell title="Vista previa de marca">
      <div className="rounded-xl border border-slate-100 overflow-hidden">
        {/* Mock post */}
        <div className="h-28 flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${primaryColor}dd, ${primaryColor}88)` }}>
          {logo ? (
            <img src={logo.url} alt="logo" className="h-16 w-16 object-contain" />
          ) : (
            <div className="w-14 h-14 bg-white/90 rounded-xl flex items-center justify-center font-black text-2xl" style={{ color: primaryColor }}>
              {initial}
            </div>
          )}
        </div>
        <div className="p-3 bg-white space-y-2">
          <p className="text-xs font-black text-slate-800">{data.brandName || 'Tu marca'}</p>
          <p className="text-[11px] text-slate-500">{data.shortDescription?.slice(0, 60) || 'Descripción de tu marca'}</p>
          {/* Mini paleta */}
          {colors.length > 0 && (
            <div className="flex gap-1 pt-1">
              {colors.slice(0, 6).map(c => (
                <div key={c.id} className="w-5 h-5 rounded-md border border-slate-100" style={{ background: c.hex }} title={c.label} />
              ))}
            </div>
          )}
        </div>
      </div>
    </PreviewShell>
  );
}

// Pantalla 7 — Comercial
function CommercialPreview({ data }: { data: Partial<BrandProfile> }) {
  const cr = data.commercialRules;
  const primaryColor = data.visualIdentity?.colors?.[0]?.hex || '#F72C5B';
  const cta = cr?.preferredCTA?.[0] || 'Escríbenos por DM';
  return (
    <PreviewShell title="Tu llamado a la acción">
      <div className="space-y-3">
        <div
          className="rounded-xl p-4 text-center"
          style={{ background: `${primaryColor}12`, border: `1px solid ${primaryColor}30` }}
        >
          <p className="text-xs font-black uppercase tracking-wider mb-1" style={{ color: primaryColor }}>CTA recomendado</p>
          <p className="text-sm font-black text-slate-800">"{cta}"</p>
        </div>
        {cr?.mainSalesChannels?.length ? (
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Canales activos</p>
            <div className="flex flex-wrap gap-1">
              {cr.mainSalesChannels.map(ch => (
                <span key={ch} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg">{ch}</span>
              ))}
            </div>
          </div>
        ) : null}
        {cr?.businessStage?.key && cr.businessStage.key !== 'unknown' && (
          <div className="bg-slate-50 rounded-xl p-2">
            <p className="text-[10px] font-black text-slate-500">{cr.businessStage.label}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{cr.businessStage.description}</p>
          </div>
        )}
      </div>
    </PreviewShell>
  );
}

// Pantalla 8 — Resumen IA
function SummaryPreview({ data }: { data: Partial<BrandProfile> }) {
  const modules = [
    { name: 'Planner',        icon: Calendar },
    { name: 'Campaign',       icon: Sparkles },
    { name: 'Product Studio', icon: ShoppingBag },
    { name: 'Prompt Studio',  icon: Wand2 },
  ];
  return (
    <PreviewShell title="Módulos que usarán tu perfil">
      <div className="space-y-2">
        {modules.map(({ name, icon: Icon }) => (
          <div key={name} className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl">
            <div className="w-7 h-7 rounded-lg bg-white border border-slate-100 flex items-center justify-center">
              <Icon size={13} className="text-slate-500" />
            </div>
            <span className="text-xs font-bold text-slate-600">{name}</span>
            <span className="ml-auto text-[10px] text-green-600 font-bold">Listo</span>
          </div>
        ))}
        <div className="bg-rose-50 rounded-xl p-2 text-[10px] text-[#F72C5B] font-bold flex items-center gap-1.5 mt-2">
          <Sparkles size={11} /> Tu contenido será mucho más coherente
        </div>
      </div>
    </PreviewShell>
  );
}

// Pantalla 1 — Bienvenida
function WelcomePreview() {
  const benefits = [
    { title: 'Captions coherentes',   desc: 'Cada texto sonará a tu marca.' },
    { title: 'Mejores ideas',         desc: 'El Planner conocerá tu cliente.' },
    { title: 'CTAs más claros',       desc: 'Adaptados a tu canal.' },
    { title: 'Estilo consistente',    desc: 'Mismos colores en cada pieza.' },
  ];
  return (
    <PreviewShell title="Lo que lograrás">
      <div className="space-y-2">
        {benefits.map(b => (
          <div key={b.title} className="flex items-start gap-2 p-2 bg-slate-50 rounded-xl">
            <div className="w-5 h-5 rounded-lg bg-rose-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Sparkles size={10} className="text-[#F72C5B]" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-700">{b.title}</p>
              <p className="text-[10px] text-slate-400">{b.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </PreviewShell>
  );
}

export const BrandProfileLivePreview: React.FC<Props> = ({ step, data }) => {
  return (
    <div className="space-y-3">
      {step === 0 && <WelcomePreview />}
      {step === 1 && <IdentityPreview data={data} />}
      {step === 2 && <CustomerPreview data={data} />}
      {step === 3 && <PerceptionPreview data={data} />}
      {step === 4 && <TonePreview data={data} />}
      {step === 5 && <VisualPreview data={data} />}
      {step === 6 && <CommercialPreview data={data} />}
      {step === 7 && <SummaryPreview data={data} />}
      {step === 8 && <IdentityPreview data={data} />}
    </div>
  );
};
