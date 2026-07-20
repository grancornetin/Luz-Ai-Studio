/* eslint-disable */
/* Luz IA — Screen 1 (Mis Marcas list) + Screen 2 (Welcome wizard) */
const { useState: useStateA } = React;

const SAMPLE_BRANDS = [
  {
    id: 'cignia',
    name: 'CIGNIA',
    category: 'Accesorios',
    status: 'done',
    updated: 'Mayo 2026',
    color: '#F72C5B',
    palette: ['#F72C5B', '#E65D74', '#B32F46', '#FFD6DF', '#E4F1AC', '#1a1320'],
  },
  {
    id: 'aurora',
    name: 'Aurora Velas',
    category: 'Hogar / decoración',
    status: 'warn',
    updated: 'Hoy',
    color: '#D9914A',
    palette: ['#D9914A', '#8C5523', '#F4E4CC', '#2B1F18'],
  },
];

function BrandsList({ brands, onNew, onEdit, onContinue, onClearAll }) {
  const empty = !brands || brands.length === 0;

  return (
    <div className="fade-up">
      <div className="list-hero">
        <div>
          <div className="t-meta" style={{ marginBottom: 10 }}>Mis Marcas · v1.0</div>
          <h1>Tus marcas, <span className="accent">en un solo lugar</span></h1>
          <p>Configura la identidad de cada marca para que Luz IA pueda crear contenido más coherente para tu negocio.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {!empty && (
            <button className="btn btn-ghost" onClick={onClearAll}>Vaciar (demo)</button>
          )}
          <button className="btn btn-primary" onClick={onNew}>
            <Icon name="plus" size={14} stroke={2.4}/>
            Crear nueva marca
          </button>
        </div>
      </div>

      {empty ? (
        <EmptyState onNew={onNew}/>
      ) : (
        <div className="brand-grid">
          {brands.map(b => <BrandCard key={b.id} b={b} onEdit={onEdit} onContinue={onContinue}/>)}
          <div className="brand-card new" onClick={onNew}>
            <div className="new-card-inner">
              <div className="plus"><Icon name="plus" size={22} stroke={2}/></div>
              <h3>Crear nueva marca</h3>
              <p>Te guiamos paso a paso. Te toma unos 5 minutos.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BrandCard({ b, onEdit, onContinue }) {
  const done = b.status === 'done';
  return (
    <div className="brand-card">
      <div className="brand-head">
        <div className="brand-logo" style={{ background: b.color }}>
          {b.name.slice(0,1)}
        </div>
        <div className="brand-meta">
          <h3>{b.name}</h3>
          <div className="cat">
            <Icon name="tag" size={12}/> {b.category}
          </div>
        </div>
        <span className={'status-pill ' + (done ? 'done' : 'warn')}>
          <span className="dot"></span>
          {done ? 'Completa' : 'Incompleta'}
        </span>
      </div>
      <div className="pal">
        {(b.palette || []).map((c, i) => <span key={i} style={{ background: c }}></span>)}
      </div>
      <div className="meta-row">
        <span className="mono" style={{ fontSize: 10.5, letterSpacing: '0.1em' }}>ACTUALIZADA · {b.updated}</span>
        {!done && <span style={{ color: 'var(--brand)', fontSize: 11.5, fontWeight: 600 }}>72% completo</span>}
      </div>
      <div className="actions">
        {done ? (
          <>
            <button className="btn btn-secondary" onClick={() => onEdit(b.id)}>
              <Icon name="edit" size={13}/> Editar
            </button>
            <button className="btn btn-primary" style={{ background: b.color, boxShadow: 'none' }}>
              <Icon name="calendar" size={13}/> Usar en Planner
            </button>
          </>
        ) : (
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => onContinue(b.id)}>
            Continuar configuración <Icon name="arrow-right" size={13} stroke={2.2}/>
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyState({ onNew }) {
  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 28, padding: '64px 40px', textAlign: 'center',
      boxShadow: 'var(--shadow-sm)'
    }}>
      <div style={{
        width: 88, height: 88, borderRadius: 26, margin: '0 auto 20px',
        background: 'var(--brand-soft)', color: 'var(--brand)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 16px 32px rgba(247,44,91,0.18)'
      }}>
        <Icon name="heart" size={36}/>
      </div>
      <div className="t-title" style={{ fontSize: 30, marginBottom: 10 }}>
        Aún no tienes marcas creadas
      </div>
      <p style={{ fontSize: 14.5, color: 'var(--body)', maxWidth: 480, margin: '0 auto 24px', lineHeight: 1.6 }}>
        Crea tu primera marca para que Luz IA pueda ayudarte con mejores planes, captions, campañas y contenido visual.
      </p>
      <button className="btn btn-primary" onClick={onNew}>
        <Icon name="sparkle" size={14}/>
        Crear mi primera marca
      </button>
    </div>
  );
}

/* ── WELCOME (Wizard step 2) ── */
function WelcomeStep() {
  return (
    <div className="split fade-up">
      <div>
        <div className="welcome-hero">
          <div className="welcome-illu">
            <Icon name="sparkle" size={28} stroke={2.2}/>
          </div>
          <div className="eyebrow"><span className="dot"></span> Paso 1 de 8 · ~5 min</div>
          <h1 className="t-title" style={{ fontSize: 'clamp(28px, 4vw, 40px)', marginBottom: 14 }}>
            Construyamos el <span style={{ color: 'var(--brand)' }}>perfil de tu marca</span>
          </h1>
          <p style={{ fontSize: 15.5, color: 'var(--body)', maxWidth: 560, lineHeight: 1.65 }}>
            Te guiaremos paso a paso para entender tu marca, tu cliente ideal, tu tono de comunicación, tus colores y tu forma de vender.
            No necesitas saber marketing: cuando algo sea difícil, <strong style={{ color: 'var(--brand)' }}>Luz IA te ayudará con ejemplos</strong>.
          </p>
        </div>

        <div className="info-card" style={{ marginTop: 18 }}>
          <div className="ic-head">
            <div className="ic-ico"><Icon name="rocket" size={15}/></div>
            <h4>Este perfil se usará para mejorar:</h4>
          </div>
          <div className="module-row" style={{ marginTop: 10 }}>
            {[
              { name: 'Planner',        ico: 'calendar' },
              { name: 'Campaign',       ico: 'megaphone' },
              { name: 'Product Studio', ico: 'shopping-bag' },
              { name: 'UGC Studio',     ico: 'image' },
              { name: 'Prompt Studio',  ico: 'wand' },
            ].map(m => (
              <div key={m.name} className="module-badge">
                <div className="m-ico"><Icon name={m.ico} size={11}/></div>
                {m.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      <PreviewPanel
        title="Lo que lograremos"
        subtitle="Estos beneficios se activan cuando completas tu perfil de marca."
      >
        {[
          { ico: 'message', t: 'Captions más coherentes',     d: 'Cada texto sonará a tu marca, no genérico.' },
          { ico: 'lightning', t: 'Mejores ideas de contenido', d: 'El Planner ya conocerá tu cliente y producto.' },
          { ico: 'target',  t: 'CTAs más claros',              d: 'Llamados a la acción adaptados a tu canal.' },
          { ico: 'palette', t: 'Estilo visual consistente',    d: 'Mismos colores y tono en cada pieza.' },
        ].map((it) => (
          <div key={it.t} style={{
            display: 'flex', alignItems: 'flex-start', gap: 12,
            padding: '12px 0', borderBottom: '1px solid var(--border-soft)'
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'var(--brand-soft)', color: 'var(--brand)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0
            }}>
              <Icon name={it.ico} size={15}/>
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{it.t}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, lineHeight: 1.5 }}>{it.d}</div>
            </div>
          </div>
        ))}
      </PreviewPanel>
    </div>
  );
}

Object.assign(window, { BrandsList, SAMPLE_BRANDS, WelcomeStep });
