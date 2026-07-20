/* eslint-disable */
/* Luz IA wizard — Step 6 Tono, Step 7 Estilo visual */

/* ─────────── STEP 6 — TONO ─────────── */
function ToneStep({ data, set }) {
  const TONES = ['Cercana','Elegante','Juvenil','Divertida','Premium','Delicada','Directa','Profesional','Emocional','Inspiradora','Minimalista','Atrevida','Experta','Amigable','Sofisticada'];
  const FORMAL = ['Muy cercano','Cercano pero cuidado','Neutral','Profesional','Elegante/formal'];
  const EMOJI = ['Sin emojis','Pocos emojis','Moderados','Muchos emojis'];

  const toggleTone = (t) => {
    const cur = data.tones || [];
    if (cur.includes(t)) set({ tones: cur.filter(x => x !== t) });
    else if (cur.length < 4) set({ tones: [...cur, t] });
  };

  const captions = [
    { id: 'cercano', tag: 'Cercano',
      text: 'Llegaron estos aros y están hermosos 💖 perfectos para darle un toque especial a cualquier look.' },
    { id: 'elegante', tag: 'Elegante',
      text: 'Descubre nuestros nuevos aros dorados, diseñados para aportar delicadeza y sofisticación a tus looks.' },
    { id: 'juvenil', tag: 'Juvenil',
      text: 'Nuevo ingreso ✨ aros dorados para subirle el nivel a tus outfits sin complicarte.' },
    { id: 'premium', tag: 'Premium',
      text: 'Una pieza pensada para realzar tu estilo con elegancia sutil y detalles que marcan diferencia.' },
  ];
  const active = data.captionFocus || 'cercano';

  return (
    <div className="split fade-up">
      <div>
        <div className="eyebrow"><span className="dot"></span> Paso 5 · Tono</div>
        <h2 className="heading">¿Cómo <span className="accent">habla tu marca</span>?</h2>
        <p className="subhead">El tono define cómo sonarán tus captions, campañas y textos de venta.</p>

        <div className="field">
          <label className="field-label">
            Elige hasta 4 palabras que describan el tono de tu marca
            <span className="tag-opt">{(data.tones || []).length}/4</span>
          </label>
          <div className="chips">
            {TONES.map(t => {
              const on = (data.tones || []).includes(t);
              const max = !on && (data.tones || []).length >= 4;
              return (
                <button key={t} type="button"
                  className={'chip brand' + (on ? ' active' : '')}
                  disabled={max}
                  style={max ? { opacity: 0.35, cursor: 'not-allowed' } : null}
                  onClick={() => toggleTone(t)}>{t}</button>
              );
            })}
          </div>
        </div>

        <div className="field" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label className="field-label">Nivel de formalidad</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {FORMAL.map(f => (
                <button key={f} type="button"
                  className={'sel-card' + (data.formality === f ? ' active' : '')}
                  style={{ padding: '11px 14px', minHeight: 'auto' }}
                  onClick={() => set({ formality: f })}>
                  <div className="sc-body"><div className="sc-title" style={{ fontSize: 12.5 }}>{f}</div></div>
                  <div className="sc-check">{data.formality === f && <Icon name="check" size={12} stroke={2.5}/>}</div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="field-label">Uso de emojis</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {EMOJI.map(e => (
                <button key={e} type="button"
                  className={'sel-card' + (data.emoji === e ? ' active' : '')}
                  style={{ padding: '11px 14px', minHeight: 'auto' }}
                  onClick={() => set({ emoji: e })}>
                  <div className="sc-body"><div className="sc-title" style={{ fontSize: 12.5 }}>{e}</div></div>
                  <div className="sc-check">{data.emoji === e && <Icon name="check" size={12} stroke={2.5}/>}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="field">
          <label className="field-label">Palabras o frases que te gusta usar</label>
          <TagInput value={data.likeWords || []} onChange={(v) => set({ likeWords: v })}
            placeholder="Escribe y presiona Enter"
            suggestions={['hecho con amor','nuevo ingreso','últimas unidades','elegancia simple']}/>
        </div>

        <div className="field">
          <label className="field-label">Palabras que quieres evitar</label>
          <TagInput value={data.avoidWords || []} onChange={(v) => set({ avoidWords: v })} evade
            placeholder="Escribe y presiona Enter"
            suggestions={['barato','lujoso','exclusivo','ofertón']}/>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <AiButton>Crear tono recomendado según mi marca</AiButton>
          <AiButton>Mostrar ejemplos de captions</AiButton>
          <AiButton>Ajustar tono más elegante</AiButton>
          <AiButton>Ajustar tono más cercano</AiButton>
        </div>
      </div>

      <PreviewPanel
        title="El mismo producto, distintos tonos"
        subtitle="Producto de ejemplo: nuevos aros dorados."
        footer="El tono influirá directamente en captions, campañas, respuestas comerciales y textos del Planner."
      >
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          {captions.map(c => (
            <button key={c.id} type="button"
              className={'chip' + (active === c.id ? ' brand active' : '')}
              style={{ fontSize: 11 }}
              onClick={() => set({ captionFocus: c.id })}>{c.tag}</button>
          ))}
        </div>
        {captions.map(c => (
          <div key={c.id} className="caption-mock" style={{
            borderColor: active === c.id ? 'var(--brand)' : 'var(--border)',
            background: active === c.id ? '#fff5f8' : '#fff',
            opacity: active === c.id ? 1 : 0.62,
            transition: 'all 0.2s',
          }}>
            <span className="tag">{c.tag}</span>
            {c.text}
          </div>
        ))}
      </PreviewPanel>
    </div>
  );
}

/* ─────────── STEP 7 — ESTILO VISUAL ─────────── */
function VisualStep({ data, set }) {
  const palette = data.palette || DEFAULT_PALETTE;

  const STYLES = ['Limpio','Minimalista','Elegante','Femenino','Colorido','Natural','Cálido','Urbano','Premium','Divertido','Editorial','Artesanal','Moderno','Romántico','Atrevido'];
  const FEELINGS = ['Confianza','Deseo','Cercanía','Elegancia','Alegría','Exclusividad','Calidez','Profesionalismo','Frescura','Seguridad','Inspiración'];
  const AVOIDS = ['Fondos muy cargados','Colores oscuros','Colores pastel','Estilo infantil','Estilo demasiado lujoso','Estilo muy barato','Demasiados textos','Fotos frías o sin vida','Otro'];

  const LOGO_SLOTS = [
    { id: 'main',  label: 'Logo principal' },
    { id: 'alt',   label: 'Logo alternativo' },
    { id: 'iso',   label: 'Isotipo / ícono' },
    { id: 'light', label: 'Versión clara' },
    { id: 'dark',  label: 'Versión oscura' },
  ];

  const setLogo = (id, file) => {
    const logos = { ...(data.logos || {}) };
    if (file) logos[id] = file; else delete logos[id];
    set({ logos });
  };

  const [aiNote, setAiNote] = React.useState(false);
  const [aiPalNote, setAiPalNote] = React.useState(false);

  const addColor = () => {
    const next = [...palette, { hex: '#cccccc', role: 'Nuevo' }];
    set({ palette: next });
  };
  const updateColor = (i, patch) => {
    const next = palette.map((c, j) => j === i ? { ...c, ...patch } : c);
    set({ palette: next });
  };
  const removeColor = (i) => set({ palette: palette.filter((_, j) => j !== i) });

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
      <div>
        <div className="eyebrow"><span className="dot"></span> Paso 6 · Estilo visual</div>
        <h2 className="heading">Ahora definamos cómo <span className="accent">se ve tu marca</span></h2>
        <p className="subhead">Sube tus recursos visuales y define tus colores. Esto ayudará a mantener una identidad coherente en tus campañas y piezas.</p>
      </div>

      <div className="split split-wide" style={{ alignItems: 'stretch' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* BLOQUE A — LOGOS */}
          <Block icon="image" title="Logos y recursos principales"
            help="Si ya tienes logo, súbelo aquí. Luz IA puede usarlo como referencia para colores, estilo y personalidad visual.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
              {LOGO_SLOTS.map(s => (
                <UploadBox key={s.id}
                  label={s.label}
                  hint="PNG / SVG"
                  file={data.logos && data.logos[s.id]}
                  onUpload={() => setLogo(s.id, { name: `${s.label.toLowerCase().replace(/ /g,'-')}.png`, size: '142 KB' })}
                  onRemove={() => setLogo(s.id, null)}/>
              ))}
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <AiButton onClick={() => setAiNote(true)}>Analizar mi logo</AiButton>
            </div>
            {aiNote && (
              <div className="ai-suggest scale-in" style={{ marginTop: 12 }}>
                <div className="ai-head"><Icon name="sparkle" size={11}/> Análisis simulado</div>
                <div className="ai-body">
                  Detectamos una identidad visual <strong>femenina, moderna y vibrante</strong>. Colores sugeridos: fucsia principal, rosa suave, negro profundo y acento lima.
                </div>
              </div>
            )}
          </Block>

          {/* BLOQUE B — PALETA */}
          <Block icon="palette" title="Paleta de colores editable"
            help="Puedes agregar tus colores manualmente o usar tu logo como referencia para construir una paleta.">
            <div className="palette-grid">
              {palette.map((c, i) => (
                <ColorBlock key={i} hex={c.hex} role={c.role}
                  onChange={(hex) => updateColor(i, { hex })}
                  onRemove={() => removeColor(i)}/>
              ))}
              <div className="color-block add" onClick={addColor}>
                <Icon name="plus" size={22} stroke={1.8}/>
                <span style={{ fontSize: 11.5, fontWeight: 600 }}>Agregar color</span>
              </div>
            </div>
            <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
              <AiButton onClick={() => setAiPalNote(true)}>Sugerir paleta con IA</AiButton>
              <button className="btn-ghost" type="button" onClick={() => set({ palette: DEFAULT_PALETTE })}>Restablecer</button>
            </div>
            {aiPalNote && (
              <div className="ai-suggest scale-in" style={{ marginTop: 12 }}>
                <div className="ai-head"><Icon name="sparkle" size={11}/> Paleta generada</div>
                <div className="ai-body">
                  Creamos una paleta basada en una marca femenina, moderna y profesional. El fucsia funciona como color principal, el negro aporta contraste premium y el rosa suave permite fondos delicados.
                </div>
              </div>
            )}
          </Block>

          {/* BLOQUE C — COOLORS */}
          <Block icon="globe" title="¿No tienes una paleta todavía?"
            help="Puedes crear una gratis en Coolors. Copia los códigos HEX sugeridos por Luz IA, crea tu paleta, descárgala y súbela aquí para reutilizarla.">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'center' }}>
              <ul className="steps-list">
                <li className="step-item">Copia tus colores sugeridos</li>
                <li className="step-item">Abre Coolors</li>
                <li className="step-item">Crea tu paleta gratis</li>
                <li className="step-item">Descárgala como imagen o PDF</li>
                <li className="step-item">Súbela aquí</li>
              </ul>
              <UploadBox label="Subir paleta" hint="PNG, JPG o PDF — exportada desde Coolors u otro."/>
            </div>
          </Block>

          {/* BLOQUE D — ESTILO */}
          <Block icon="eye" title="Estilo visual de tu marca">
            <SubField label="¿Qué estilo visual representa mejor tu marca?">
              <Chips options={STYLES} value={data.styles || []} onChange={(v) => set({ styles: v })}/>
            </SubField>
            <SubField label="¿Qué sensación debería transmitir tu contenido?">
              <Chips options={FEELINGS} value={data.feelings || []} onChange={(v) => set({ feelings: v })}/>
            </SubField>
            <SubField label="¿Qué cosas visuales quieres evitar?">
              <Chips options={AVOIDS} value={data.avoidsVisual || []} onChange={(v) => set({ avoidsVisual: v })}/>
            </SubField>
          </Block>

          {/* BLOQUE E — ASSETS */}
          <Block icon="grid" title="Otros recursos visuales"
            help="Opcional. Cualquier referencia visual que ayude a Luz IA a entender mejor tu marca.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
              {['Íconos','Texturas','Referencias','Capturas IG','Packaging','Manual de marca','Tipografías'].map(l => (
                <UploadBox key={l} label={l} hint=""/>
              ))}
            </div>
          </Block>
        </div>

        <PreviewPanel
          title="Brand Card"
          subtitle="Esta es la previsualización de cómo verán tu marca los módulos."
          footer="Los módulos pueden usar este preview como referencia visual rápida."
        >
          <BrandMock
            name={data.name || 'CIGNIA'}
            tagline={data.tagline || data.descAi || data.description || 'Accesorios femeninos para elevar tus looks diarios.'}
            palette={palette}
            cta="Ver nuevos productos"
            cap={data.captionFocus === 'premium'
              ? 'Una pieza pensada para realzar tu estilo con elegancia sutil.'
              : 'Llegaron estos aros ✨ perfectos para elevar tus looks.'}
            brandColor={palette[0]?.hex}/>

          <div style={{ marginTop: 16, fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
            Tu logo sobre fondos
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
            <div style={{
              background: '#fff', border: '1px solid var(--border)', borderRadius: 12,
              height: 76, display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <div style={{
                fontFamily: "'Syne', sans-serif", fontStyle: 'italic', fontWeight: 800,
                fontSize: 20, color: palette[0]?.hex || 'var(--brand)'
              }}>{(data.name || 'CIGNIA').slice(0, 8)}</div>
            </div>
            <div style={{
              background: '#1a1320', borderRadius: 12,
              height: 76, display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <div style={{
                fontFamily: "'Syne', sans-serif", fontStyle: 'italic', fontWeight: 800,
                fontSize: 20, color: '#fff'
              }}>{(data.name || 'CIGNIA').slice(0, 8)}</div>
            </div>
          </div>

          <div style={{ marginTop: 16, fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
            Paleta aplicada en mini interfaz
          </div>
          <div style={{
            marginTop: 8, background: palette[3]?.hex || '#FFD6DF',
            borderRadius: 12, padding: 14, border: '1px solid var(--border)'
          }}>
            <div style={{ fontSize: 11, color: palette[6]?.hex || '#000', opacity: 0.6, marginBottom: 4 }}>NUEVO INGRESO</div>
            <div style={{
              fontFamily: "'Syne', sans-serif", fontStyle: 'italic', fontWeight: 700,
              fontSize: 18, color: palette[6]?.hex || '#000', marginBottom: 8
            }}>
              Aros dorados
            </div>
            <button style={{
              border: 'none', background: palette[0]?.hex, color: '#fff',
              padding: '8px 14px', borderRadius: 10, fontSize: 11.5, fontWeight: 700, cursor: 'pointer'
            }}>Comprar ahora</button>
          </div>
        </PreviewPanel>
      </div>
    </div>
  );
}

function Block({ icon, title, help, children }) {
  return (
    <section style={{
      background: '#fff', border: '1px solid var(--border)',
      borderRadius: 20, padding: '22px 24px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 9,
          background: 'var(--brand-soft)', color: 'var(--brand)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Icon name={icon} size={15}/>
        </div>
        <h3 style={{ fontFamily: "'Syne', sans-serif", fontStyle: 'italic', fontWeight: 700, fontSize: 18, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
          {title}
        </h3>
      </div>
      {help && <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.55, marginBottom: 14, maxWidth: 620 }}>{help}</p>}
      {children}
    </section>
  );
}

function SubField({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>{label}</div>
      {children}
    </div>
  );
}

Object.assign(window, { ToneStep, VisualStep, Block, SubField });
