/* eslint-disable */
/* Luz IA — Perfil de Marca · App root */
const { useState: useStateApp, useEffect: useEffectApp, useMemo: useMemoApp, useRef: useRefApp } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "brandColor": "#F72C5B",
  "headingStyle": "syne-italic",
  "previewPosition": "right",
  "showSidebar": true
}/*EDITMODE-END*/;

function App() {
  // Tweaks
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // Apply tweak brand color globally
  useEffectApp(() => {
    document.documentElement.style.setProperty('--brand', t.brandColor);
    const dark = adjustHex(t.brandColor, -22);
    document.documentElement.style.setProperty('--brand-2', dark);
    document.documentElement.style.setProperty('--brand-soft', adjustHex(t.brandColor, 75, true));
    document.documentElement.style.setProperty('--brand-tint', adjustHex(t.brandColor, 60, true));
    document.documentElement.style.setProperty('--grad', `linear-gradient(135deg, ${adjustHex(t.brandColor, 30, true)} 0%, ${t.brandColor} 55%, ${adjustHex(t.brandColor, -25)} 100%)`);
  }, [t.brandColor]);

  useEffectApp(() => {
    document.body.classList.toggle('heading-clean', t.headingStyle === 'clean');
  }, [t.headingStyle]);

  // Navigation state
  const [view, setView] = useStateApp('list'); // list | wizard
  const [wizStep, setWizStep] = useStateApp(0);
  const [brands, setBrands] = useStateApp(SAMPLE_BRANDS);
  const [data, setData] = useStateApp({
    name: '', category: '', country: '', business: '', description: '',
    palette: DEFAULT_PALETTE, tones: [], captionFocus: 'cercano',
  });

  const setD = (patch) => setData(prev => ({ ...prev, ...patch }));

  const startWizard = () => {
    setData({
      name: '', category: '', country: '', business: '', description: '',
      palette: DEFAULT_PALETTE, tones: [], captionFocus: 'cercano',
    });
    setWizStep(0);
    setView('wizard');
  };
  const editBrand = (id) => {
    const b = brands.find(x => x.id === id);
    setData({
      name: b?.name || 'CIGNIA',
      category: b?.category || 'Accesorios',
      country: 'Chile',
      business: 'reseller',
      description: 'Vendemos accesorios femeninos elegantes para mujeres que quieren elevar sus outfits diarios.',
      descAi: 'CIGNIA es una marca de accesorios femeninos pensada para mujeres que quieren elevar sus looks diarios con detalles elegantes, versátiles y accesibles.',
      palette: DEFAULT_PALETTE,
      tones: ['Cercana','Elegante','Femenino'],
      audience: 'Mujeres', age: '25–34',
      motivations: ['Sentirse elegante','Verse mejor'],
      fears: ['Calidad','Si llegará a tiempo'],
      tier: 'mediaalta',
      reasons: ['Diseño','Atención personalizada','Empaque'],
      formality: 'Cercano pero cuidado', emoji: 'Moderados',
      likeWords: ['nuevo ingreso','elegancia simple'],
      avoidWords: ['barato','ofertón'],
      channels: ['Instagram DM','WhatsApp','Tienda online'],
      ctas: ['Escríbenos por WhatsApp','Compra en el link'],
      stage: 'growing',
      trust: ['Testimonios','Fotos reales','Empaque cuidado'],
      doubts: ['"No sé si es de buena calidad"','"No sé si la tienda es confiable"'],
      styles: ['Elegante','Femenino','Limpio'],
      feelings: ['Confianza','Elegancia'],
      captionFocus: 'elegante',
    });
    setWizStep(0);
    setView('wizard');
  };

  const next = () => {
    if (wizStep < WIZARD_STEPS.length - 1) setWizStep(wizStep + 1);
  };
  const prev = () => {
    if (wizStep > 0) setWizStep(wizStep - 1);
    else setView('list');
  };
  const goStep = (i) => setWizStep(i);
  const saveDraft = () => {
    if (!data.name) return;
    const exists = brands.find(b => b.name.toLowerCase() === data.name.toLowerCase());
    if (exists) return;
    setBrands([{
      id: data.name.toLowerCase().replace(/\s+/g,'-'),
      name: data.name,
      category: data.category || 'Sin categoría',
      status: 'warn', updated: 'Ahora',
      color: (data.palette && data.palette[0]?.hex) || 'var(--brand)',
      palette: (data.palette || DEFAULT_PALETTE).slice(0, 7).map(p => p.hex),
    }, ...brands]);
  };
  const finishWizard = () => {
    saveDraft();
    // Replace status if exists
    setBrands(prev => prev.map(b => b.name === data.name ? { ...b, status: 'done', updated: 'Ahora' } : b));
    setView('list');
  };

  return (
    <div className="app-shell"
         style={(t.showSidebar === false) ? { gridTemplateColumns: '1fr' } : null}
         data-screen-label={view === 'list' ? 'Mis Marcas' : `Wizard - ${WIZARD_STEPS[wizStep]?.label}`}>
      {(t.showSidebar !== false) && <Sidebar active={view === 'list' ? 'brands' : 'brands'} onBrandsClick={() => setView('list')}/>}
      <div className="main-area">
        <Topbar view={view} step={wizStep} brandName={data.name} onHome={() => setView('list')}/>
        <main className="page">
          {view === 'list' && (
            <BrandsList
              brands={brands}
              onNew={startWizard}
              onEdit={editBrand}
              onContinue={editBrand}
              onClearAll={() => setBrands([])}
            />
          )}
          {view === 'wizard' && (
            <Wizard
              step={wizStep} data={data} set={setD}
              onNext={next} onPrev={prev} onGoStep={goStep}
              onSaveDraft={() => { saveDraft(); setView('list'); }}
              onFinish={finishWizard}
              onSeeAll={() => setView('list')}
              onCreateAnother={startWizard}
              onGoPlanner={() => alert('Demo: aquí iríamos al Planner con tu marca cargada.')}
            />
          )}
        </main>
      </div>

      <TweakUI t={t} setTweak={setTweak}/>
    </div>
  );
}

/* ─────────── SIDEBAR ─────────── */
function Sidebar({ active, onBrandsClick }) {
  const nav = [
    { id: 'home',     icon: 'home',         label: 'Inicio' },
    { id: 'planner',  icon: 'calendar',     label: 'Planner' },
    { id: 'campaign', icon: 'megaphone',    label: 'Campaign' },
    { id: 'product',  icon: 'shopping-bag', label: 'Product Studio' },
    { id: 'ugc',      icon: 'image',        label: 'UGC Studio' },
    { id: 'prompt',   icon: 'wand',         label: 'Prompt Studio' },
  ];
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-mark">L</div>
        <div className="logo-text">Luz IA<small>STUDIO</small></div>
      </div>

      <div className="nav-section">Workspace</div>
      {nav.map(n => (
        <button key={n.id} className="nav-item">
          <span className="nav-ico"><Icon name={n.icon} size={16}/></span>
          {n.label}
        </button>
      ))}

      <div className="nav-section">Configuración</div>
      <button className={'nav-item' + (active === 'brands' ? ' active' : '')} onClick={onBrandsClick}>
        <span className="nav-ico"><Icon name="heart" size={16}/></span>
        Mis Marcas
        <span className="nav-badge">Nuevo</span>
      </button>
      <button className="nav-item">
        <span className="nav-ico"><Icon name="settings" size={16}/></span>
        Cuenta
      </button>

      <div className="sidebar-foot">
        <div className="avatar">V</div>
        <div>
          <div style={{ color: '#fff', fontWeight: 600, fontSize: 12.5 }}>Valentina</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Plan Pro</div>
        </div>
      </div>
    </aside>
  );
}

/* ─────────── TOPBAR ─────────── */
function Topbar({ view, step, brandName, onHome }) {
  return (
    <header className="topbar">
      <div className="crumbs">
        <button className="btn-ghost" style={{ padding: '6px 8px' }} onClick={onHome}>
          <Icon name="home" size={14}/>
        </button>
        <span className="sep">/</span>
        <span style={view === 'list' ? { color: 'var(--ink)', fontWeight: 600 } : null}>Mis Marcas</span>
        {view === 'wizard' && (
          <>
            <span className="sep">/</span>
            <span className="here">{brandName || 'Nueva marca'}</span>
            <span className="sep">/</span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--brand)', fontWeight: 600 }}>
              PASO {String(step + 1).padStart(2, '0')} de {WIZARD_STEPS.length}
            </span>
          </>
        )}
      </div>
      <div className="topbar-right">
        <button className="btn-icon"><Icon name="bell" size={14}/></button>
        <button className="btn-icon"><Icon name="menu" size={14}/></button>
      </div>
    </header>
  );
}

/* ─────────── WIZARD SHELL ─────────── */
function Wizard({ step, data, set, onNext, onPrev, onGoStep, onSaveDraft, onFinish, onSeeAll, onCreateAnother, onGoPlanner }) {
  const isLast = step === WIZARD_STEPS.length - 1;
  const stepDef = WIZARD_STEPS[step];

  // Step nav clickable (gives feeling of completable):
  const stepStatus = (i) => {
    if (i === step) return 'active';
    if (i < step) return 'done';
    return 'pending';
  };

  return (
    <div className="wizard scale-in">
      <nav className="wiz-stepper" data-screen-label={`Step ${step+1} ${stepDef.label}`}>
        <div className="wiz-stepper-title">
          <span className="num">{String(step + 1).padStart(2, '0')}</span>
          <span className="of">/ {String(WIZARD_STEPS.length).padStart(2, '0')}</span>
        </div>
        {WIZARD_STEPS.map((s, i) => {
          const st = stepStatus(i);
          return (
            <button key={s.id} className={`wiz-step ${st}`} onClick={() => onGoStep(i)}>
              <span className="step-dot">{st === 'done' ? <Icon name="check" size={11} stroke={2.6}/> : (i + 1)}</span>
              <span className="step-label">{s.label}</span>
            </button>
          );
        })}
        <div style={{ marginTop: 'auto', paddingTop: 20 }}>
          <div className="draft-bar">
            <span className="pulse-dot"></span> Borrador guardado
          </div>
        </div>
      </nav>

      <div className="wiz-body">
        <div className="wiz-content" key={step}>
          {step === 0 && <WelcomeStep />}
          {step === 1 && <IdentityStep data={data} set={set} />}
          {step === 2 && <CustomerStep data={data} set={set} />}
          {step === 3 && <PerceptionStep data={data} set={set} />}
          {step === 4 && <ToneStep data={data} set={set} />}
          {step === 5 && <VisualStep data={data} set={set} />}
          {step === 6 && <RulesStep data={data} set={set} />}
          {step === 7 && <SummaryStep data={data} set={set} regenerate={() => set({ summary: null })}/>}
          {step === 8 && <DoneStep data={data} onSeeAll={onSeeAll} onCreateAnother={onCreateAnother} onGoPlanner={onGoPlanner}/>}
        </div>
        <footer className="wiz-footer">
          <div className="wizard-footer-left" style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={onPrev}>
              <Icon name="arrow-left" size={13}/> {step === 0 ? 'Volver a mis marcas' : 'Atrás'}
            </button>
            {step > 0 && step < 8 && (
              <button className="btn btn-ghost" onClick={onSaveDraft}>
                Guardar como borrador
              </button>
            )}
          </div>
          <div className="wizard-footer-right" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {step > 0 && step < 8 && (
              <span className="mono" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.08em' }}>
                {step}/{WIZARD_STEPS.length - 2}
              </span>
            )}
            {step < 8 ? (
              <button className="btn btn-primary" onClick={isLast ? onFinish : onNext}>
                {step === 7 ? <>Aceptar y finalizar <Icon name="check" size={14} stroke={2.4}/></> :
                 step === 0 ? <>Comenzar <Icon name="arrow-right" size={14} stroke={2.4}/></> :
                 <>Siguiente <Icon name="arrow-right" size={14} stroke={2.4}/></>}
              </button>
            ) : (
              <button className="btn btn-primary" onClick={onFinish}>
                Guardar marca <Icon name="check" size={14} stroke={2.4}/>
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

/* ─────────── TWEAK UI ─────────── */
function TweakUI({ t, setTweak }) {
  return (
    <TweaksPanel title="Tweaks" defaultOpen={false}>
      <TweakSection title="Color de marca">
        <TweakColor
          value={t.brandColor}
          onChange={(v) => setTweak('brandColor', v)}
          options={['#F72C5B','#7c3aed','#0EA5E9','#10B981','#F59E0B']}/>
      </TweakSection>
      <TweakSection title="Estilo de títulos">
        <TweakRadio
          value={t.headingStyle}
          onChange={(v) => setTweak('headingStyle', v)}
          options={[
            { label: 'Syne italic', value: 'syne-italic' },
            { label: 'Inter limpio', value: 'clean' },
          ]}/>
      </TweakSection>
      <TweakSection title="Sidebar">
        <TweakToggle
          value={t.showSidebar}
          onChange={(v) => setTweak('showSidebar', v)}
          label="Mostrar sidebar"/>
      </TweakSection>
    </TweaksPanel>
  );
}

/* ─────────── HEX HELPERS ─────────── */
function adjustHex(hex, amount, tinted = false) {
  if (!hex || hex[0] !== '#') return hex;
  const h = hex.replace('#','');
  const v = h.length === 3 ? h.split('').map(c=>c+c).join('') : h;
  let r = parseInt(v.slice(0,2),16), g = parseInt(v.slice(2,4),16), b = parseInt(v.slice(4,6),16);
  if (tinted) {
    r = Math.round(r + (255 - r) * (amount / 100));
    g = Math.round(g + (255 - g) * (amount / 100));
    b = Math.round(b + (255 - b) * (amount / 100));
  } else {
    r = Math.max(0, Math.min(255, r + amount));
    g = Math.max(0, Math.min(255, g + amount));
    b = Math.max(0, Math.min(255, b + amount));
  }
  return '#' + [r,g,b].map(x => x.toString(16).padStart(2,'0')).join('');
}

/* Apply heading style override */
const _styleOverride = document.createElement('style');
_styleOverride.textContent = `
.heading-clean .heading, .heading-clean .t-title, .heading-clean .bm-name, .heading-clean .sc-name,
.heading-clean .preview-title, .heading-clean .list-hero h1, .heading-clean .confirm-hero h2,
.heading-clean .logo-text {
  font-family: 'Inter', sans-serif !important;
  font-style: normal !important;
  font-weight: 800 !important;
}
`;
document.head.appendChild(_styleOverride);

/* Mount */
ReactDOM.createRoot(document.getElementById('app-root')).render(<App />);
