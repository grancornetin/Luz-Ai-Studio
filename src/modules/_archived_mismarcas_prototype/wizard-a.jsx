/* eslint-disable */
/* Luz IA wizard — Step 3 Identidad básica, Step 4 Cliente ideal, Step 5 Percepción */

/* ─────────── STEP 3 — IDENTIDAD BÁSICA ─────────── */
function IdentityStep({ data, set }) {
  const [improved, setImproved] = React.useState(false);
  const [improving, setImproving] = React.useState(false);

  const BUSINESS_TYPES = [
    { id: 'maker',     icon: 'heart',         t: 'Vendo productos hechos por mí',                  d: 'Yo fabrico, armo, diseño o personalizo lo que vendo.' },
    { id: 'reseller',  icon: 'shopping-bag',  t: 'Vendo productos comprados a proveedores',         d: 'Compro productos listos y luego los vendo con mi atención y selección.' },
    { id: 'branded',   icon: 'tag',           t: 'Vendo productos de mi marca, fabricados por terceros', d: 'Yo manejo la marca y diseño, otra persona fabrica.' },
    { id: 'service',   icon: 'user',          t: 'Vendo servicios',                                  d: 'Lo que vendo es atención, experiencia o servicio.' },
    { id: 'creator',   icon: 'image',         t: 'Creo contenido para marcas o clientes',           d: 'Uso la app para producir contenido para otros negocios.' },
    { id: 'starting',  icon: 'rocket',        t: 'Estoy empezando y aún no lo tengo claro',         d: 'Todavía estoy definiendo mi producto o forma de vender.' },
    { id: 'other',     icon: 'compass',       t: 'Otro',                                             d: 'Cuéntame en pocas palabras qué haces.' },
  ];

  const COUNTRIES = ['Chile', 'Argentina', 'Colombia', 'México', 'Perú', 'Otro'];
  const CATEGORIES = ['Ropa / moda','Accesorios','Cosmética / skincare','Belleza','Hogar / decoración','Velas / aromas','Alimentos','Artesanía','Tecnología','Infantil','Mascotas','Fitness / bienestar','Otro'];

  const improveDescription = () => {
    if (!data.description) return;
    setImproving(true);
    setTimeout(() => { setImproving(false); setImproved(true); }, 900);
  };

  const aiText = `${data.name || 'Tu marca'} es una marca de ${(data.category || 'accesorios').toLowerCase()} pensada para mujeres que quieren elevar sus looks diarios con detalles elegantes, versátiles y accesibles.`;

  return (
    <div className="split fade-up">
      <div>
        <div className="eyebrow"><span className="dot"></span> Paso 2 · Identidad</div>
        <h2 className="heading">Primero, conozcamos <span className="accent">tu marca</span></h2>
        <p className="subhead">Estos son los cimientos. Pocas preguntas, lenguaje simple. Puedes saltar campos y completarlos después.</p>

        <div className="field">
          <label className="field-label">¿Cómo se llama tu marca?</label>
          <input className="input" placeholder="Ej: CIGNIA, Aurora Velas, Valentina Store"
            value={data.name || ''} onChange={(e) => set({ name: e.target.value })}/>
        </div>

        <div className="field" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label className="field-label">¿En qué país vendes principalmente? <span className="tag-opt">Opcional</span></label>
            <select className="select" value={data.country || ''} onChange={(e) => set({ country: e.target.value })}>
              <option value="">Selecciona un país</option>
              {COUNTRIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Categoría</label>
            <select className="select" value={data.category || ''} onChange={(e) => set({ category: e.target.value })}>
              <option value="">Selecciona una categoría</option>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="field">
          <label className="field-label">¿Cómo funciona tu negocio principalmente?</label>
          <div className="sel-grid cols-2">
            {BUSINESS_TYPES.map(b => (
              <SelCard key={b.id} icon={b.icon} title={b.t} desc={b.d}
                active={data.business === b.id}
                onClick={() => set({ business: b.id })}/>
            ))}
          </div>
        </div>

        <div className="field">
          <label className="field-label">Describe tu marca en una frase</label>
          <div className="field-help">No tiene que ser perfecta. Luz IA puede mejorarla por ti.</div>
          <textarea className="input textarea" placeholder="Ej: Vendemos accesorios femeninos elegantes para mujeres que quieren elevar sus outfits diarios."
            value={data.description || ''} onChange={(e) => { set({ description: e.target.value }); setImproved(false); }}/>
          <div style={{ marginTop: 10 }}>
            <AiButton onClick={improveDescription}>
              {improving ? <><span className="spinner"></span> Mejorando…</> : 'Ayúdame a mejorar esta descripción'}
            </AiButton>
          </div>
          {improved && (
            <div className="ai-suggest scale-in">
              <div className="ai-head"><Icon name="sparkle" size={11}/> Sugerencia de Luz IA</div>
              <div className="ai-body">{aiText}</div>
              <div className="ai-actions">
                <button onClick={() => { set({ description: aiText, descAi: aiText }); setImproved(false); }}>Usar esta versión</button>
                <button onClick={() => setImproved(false)}>Descartar</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <PreviewPanel
        title="Así se verá tu marca"
        subtitle="Este es el contexto base que recibirán los módulos."
        footer="Esta descripción ayudará a los módulos a entender qué tipo de contenido crear para tu marca."
      >
        <div className="preview-card">
          <div className="pc-label">Nombre</div>
          <div className="pc-text" style={{ fontFamily: "'Syne', sans-serif", fontStyle: 'italic', fontWeight: 700, fontSize: 22 }}>
            {data.name || 'Tu marca'}
          </div>
        </div>

        {data.category && (
          <div className="preview-card">
            <div className="pc-label">Categoría · {data.country || 'País'}</div>
            <div className="pc-text">{data.category}</div>
          </div>
        )}

        {data.description && (
          <div className="preview-card">
            <div className="pc-label">Descripción original</div>
            <div className="pc-text">{data.description}</div>
          </div>
        )}

        {data.descAi && (
          <div className="preview-card" style={{ background: '#fff5f8', borderColor: 'rgba(247,44,91,0.18)' }}>
            <div className="pc-label" style={{ color: 'var(--brand)' }}>Versión mejorada por IA</div>
            <div className="pc-text">{data.descAi}</div>
          </div>
        )}
      </PreviewPanel>
    </div>
  );
}

/* ─────────── STEP 4 — CLIENTE IDEAL ─────────── */
function CustomerStep({ data, set }) {
  const AUDIENCE = ['Mujeres','Hombres','Ambos','Familias','Empresas','Público amplio','Otro'];
  const AGES = ['18–24','25–34','35–44','45–54','55+','No estoy segura'];
  const MOTIV = ['Verse mejor','Ahorrar dinero','Sentirse elegante','Regalar algo especial','Resolver una necesidad práctica','Sentirse única','Cuidarse','Decorar su espacio','Probar algo nuevo','Comprar rápido y fácil','Otro'];
  const FEARS = ['Precio','Calidad','Duración','Talla','Material','Si llegará a tiempo','Si el producto se verá igual','Confianza en la tienda','Métodos de pago','Cambios o devoluciones','No sé'];

  return (
    <div className="split fade-up">
      <div>
        <div className="eyebrow"><span className="dot"></span> Paso 3 · Cliente ideal</div>
        <h2 className="heading">¿A quién le <span className="accent">habla tu marca</span>?</h2>
        <p className="subhead">No tienes que definirlo perfecto. Solo necesitamos entender quién suele comprar o interesarse por tus productos.</p>

        <div className="field">
          <label className="field-label">¿A quién le vendes principalmente?</label>
          <Chips options={AUDIENCE} value={data.audience} multi={false}
            onChange={(v) => set({ audience: v })} brand/>
        </div>

        <div className="field">
          <label className="field-label">Edad aproximada de tu clienta o cliente ideal</label>
          <Chips options={AGES} value={data.age} multi={false}
            onChange={(v) => set({ age: v })} brand/>
        </div>

        <div className="field">
          <label className="field-label">¿Qué busca esa persona cuando compra productos como los tuyos?</label>
          <div className="field-help">Selecciona todas las que apliquen.</div>
          <Chips options={MOTIV} value={data.motivations || []} onChange={(v) => set({ motivations: v })}/>
        </div>

        <div className="field">
          <label className="field-label">¿Qué le preocupa antes de comprar?</label>
          <div className="field-help">Estas son las dudas que el Planner podrá resolver con contenido.</div>
          <Chips options={FEARS} value={data.fears || []} onChange={(v) => set({ fears: v })}/>
        </div>

        <div className="field">
          <label className="field-label">Describe a tu clienta ideal con tus palabras <span className="tag-opt">Opcional</span></label>
          <textarea className="input textarea" placeholder="Ej: Mujeres jóvenes que quieren verse arregladas, pero no quieren gastar demasiado."
            value={data.customerDesc || ''} onChange={(e) => set({ customerDesc: e.target.value })}/>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            <AiButton>Mejorar descripción</AiButton>
            <AiButton>Detectar motivaciones</AiButton>
            <AiButton>Detectar dudas principales</AiButton>
          </div>
        </div>
      </div>

      <PreviewPanel
        title="Así entenderemos a tu cliente"
        subtitle="Tu marca le habla principalmente a personas con estas características:"
        footer="Esto influirá en captions, tono cercano vs sofisticado y los CTAs que recomendaremos."
      >
        <div className="preview-card">
          <div className="pc-label">Perfil sintetizado</div>
          <div className="pc-text">
            {data.audience || 'Tu audiencia'} de <strong>{data.age || 'edad por definir'}</strong>
            {(data.motivations && data.motivations.length > 0) && <> que buscan <strong>{data.motivations.slice(0,2).join(', ').toLowerCase()}</strong></>}
            {(data.fears && data.fears.length > 0) && <>. Antes de comprar suelen preocuparse por <strong>{data.fears.slice(0,2).join(', ').toLowerCase()}</strong>.</>}
          </div>
        </div>

        <div style={{ fontSize: 12, color: 'var(--muted)', margin: '14px 0 6px', fontWeight: 600 }}>
          Cómo afectará esto al contenido
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {['Captions cercanos', 'Énfasis en confianza', 'Detalle / calidad', 'CTAs menos agresivos'].map(t => (
            <span key={t} style={{
              padding: '5px 10px', borderRadius: 999,
              background: 'var(--brand-soft)', color: 'var(--brand-2)',
              fontSize: 11, fontWeight: 600
            }}>{t}</span>
          ))}
        </div>

        <div style={{ fontSize: 12, color: 'var(--muted)', margin: '16px 0 6px', fontWeight: 600 }}>
          Comparación de tono
        </div>
        <div className="compare-grid">
          <div className="compare-card">
            <div className="ct">Joven / accesible</div>
            <div className="cb">Ideal para elevar tus looks diarios sin gastar de más.</div>
          </div>
          <div className="compare-card">
            <div className="ct">Sofisticado</div>
            <div className="cb">Piezas pensadas para mujeres que valoran detalles refinados y una estética cuidada.</div>
          </div>
        </div>
      </PreviewPanel>
    </div>
  );
}

/* ─────────── STEP 5 — PERCEPCIÓN ─────────── */
function PerceptionStep({ data, set }) {
  const TIERS = [
    { id: 'economica',  t: 'Económica',  d: 'Precio como ventaja principal.', icon: '$' },
    { id: 'accesible',  t: 'Accesible',  d: 'Buena relación precio-calidad.', icon: '$' },
    { id: 'media',      t: 'Media',      d: 'Equilibrada y confiable.', icon: '$$' },
    { id: 'mediaalta',  t: 'Media-alta', d: 'Cuidada y elevada.', icon: '$$$' },
    { id: 'premium',    t: 'Premium',    d: 'Sofisticada y exclusiva.', icon: '$$$$' },
    { id: 'unsure',     t: 'No estoy segura', d: 'Luz IA puede ayudarte a definirlo.', icon: '?' },
  ];

  const REASONS = ['Precio','Calidad','Atención personalizada','Rapidez de entrega','Diseño','Variedad','Empaque','Exclusividad','Cercanía','Confianza','Hecho a mano','Otro','No sé todavía'];
  const COMPETITORS = ['Tiendas de Instagram','Grandes tiendas / retail','Shein / marketplaces','Emprendedoras similares','Tiendas físicas locales','Marcas premium','No estoy segura'];

  const tier = data.tier || 'accesible';
  const captionByTier = {
    economica: 'Accesorios bonitos sin gastar de más. Encuéntralos aquí 💕',
    accesible: 'Accesorios bonitos y versátiles para complementar tu día a día sin gastar de más.',
    media:     'Accesorios pensados para verte bien todos los días, con un toque de detalle.',
    mediaalta: 'Accesorios cuidadosamente seleccionados para elevar tus looks con estilo, calidad y presencia.',
    premium:   'Piezas sofisticadas pensadas para mujeres que valoran detalles distintivos y una estética refinada.',
    unsure:    'Cuando elijas un nivel, ajustaremos el ejemplo a tu marca.',
  };

  return (
    <div className="split fade-up">
      <div>
        <div className="eyebrow"><span className="dot"></span> Paso 4 · Percepción</div>
        <h2 className="heading">¿Cómo quieres que se <span className="accent">perciba tu marca</span>?</h2>
        <p className="subhead">No se trata de si tu marca es buena o mala. Se trata de cómo quieres que se sienta para tus clientes.</p>

        <div className="field">
          <label className="field-label">Nivel percibido</label>
          <div className="sel-grid cols-3">
            {TIERS.map(t => (
              <button key={t.id} type="button"
                className={'sel-card' + (data.tier === t.id ? ' active' : '')}
                onClick={() => set({ tier: t.id })}>
                <div className="sc-icon" style={{ fontWeight: 700, fontSize: 13 }}>{t.icon}</div>
                <div className="sc-body">
                  <div className="sc-title">{t.t}</div>
                  <div className="sc-desc">{t.d}</div>
                </div>
                <div className="sc-check">{data.tier === t.id && <Icon name="check" size={12} stroke={2.5}/>}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label className="field-label">¿Por qué alguien debería comprarte a ti?</label>
          <div className="field-help">Tu diferencial puede ser una sola cosa o varias.</div>
          <Chips options={REASONS} value={data.reasons || []} onChange={(v) => set({ reasons: v })}/>
        </div>

        <div className="field">
          <label className="field-label">¿Qué prometes entregar siempre?</label>
          <textarea className="input textarea" placeholder="Ej: productos bonitos, bien presentados y enviados con cuidado."
            value={data.promise || ''} onChange={(e) => set({ promise: e.target.value })}/>
        </div>

        <div className="field">
          <label className="field-label">¿Contra qué tipo de alternativas compites?</label>
          <Chips options={COMPETITORS} value={data.competitors || []} onChange={(v) => set({ competitors: v })}/>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <AiButton>Ayúdame a encontrar mi diferencial</AiButton>
          <AiButton>Convertir esto en promesa de marca</AiButton>
          <AiButton>Hacerlo más premium</AiButton>
          <AiButton>Hacerlo más cercano</AiButton>
        </div>
      </div>

      <PreviewPanel
        title="El mismo mensaje en distintos niveles"
        subtitle="Mira cómo cambia el tono según el nivel que elijas."
        footer="Esta decisión cambiará cómo Luz IA redacta captions, ofertas, campañas y llamados a la acción."
      >
        {[
          { id: 'accesible', t: 'Accesible' },
          { id: 'mediaalta', t: 'Media-alta' },
          { id: 'premium',   t: 'Premium' },
        ].map(t => (
          <div key={t.id} className="caption-mock" style={{
            borderColor: tier === t.id ? 'var(--brand)' : 'var(--border)',
            background: tier === t.id ? '#fff5f8' : '#fff',
            boxShadow: tier === t.id ? '0 8px 22px rgba(247,44,91,0.10)' : 'none',
            transition: 'all 0.18s',
            marginBottom: 8,
          }}>
            <span className="tag">{t.t} {tier === t.id && '· actual'}</span>
            {captionByTier[t.id]}
          </div>
        ))}
      </PreviewPanel>
    </div>
  );
}

Object.assign(window, { IdentityStep, CustomerStep, PerceptionStep });
