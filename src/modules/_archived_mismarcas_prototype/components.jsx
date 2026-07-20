/* eslint-disable */
/* Luz IA — shared components */
const { useState, useEffect, useRef, useMemo } = React;

/* ── ICON ── */
function Icon({ name, size = 16, stroke = 1.7, ...rest }) {
  const s = size;
  const common = {
    width: s, height: s, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: stroke,
    strokeLinecap: 'round', strokeLinejoin: 'round',
    ...rest
  };
  switch (name) {
    case 'sparkle': return (
      <svg {...common}><path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3z"/><path d="M19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z"/></svg>
    );
    case 'wand': return (
      <svg {...common}><path d="M15 4l3 3M4 20l9-9m6-1l1-1m-3-3l-1 1m-1 3l-1-1m4 8l-1-1M9 4l-1 1M5 9l-1-1"/></svg>
    );
    case 'check': return (
      <svg {...common}><path d="M4 12.5l5 5L20 6.5"/></svg>
    );
    case 'plus': return (
      <svg {...common}><path d="M12 5v14M5 12h14"/></svg>
    );
    case 'minus': return (
      <svg {...common}><path d="M5 12h14"/></svg>
    );
    case 'x': return (
      <svg {...common}><path d="M6 6l12 12M18 6L6 18"/></svg>
    );
    case 'arrow-right': return (
      <svg {...common}><path d="M5 12h14M13 5l7 7-7 7"/></svg>
    );
    case 'arrow-left': return (
      <svg {...common}><path d="M19 12H5M11 5l-7 7 7 7"/></svg>
    );
    case 'upload': return (
      <svg {...common}><path d="M12 16V4M6 10l6-6 6 6M4 20h16"/></svg>
    );
    case 'image': return (
      <svg {...common}><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5L4 19"/></svg>
    );
    case 'palette': return (
      <svg {...common}><path d="M12 22c5.5 0 10-4 10-9 0-4-3.5-7-8-7-5.5 0-10 4-10 9 0 3.3 2.5 6 6 6h2v-3a1 1 0 011-1h.5"/><circle cx="7" cy="11" r="1.2"/><circle cx="11" cy="7" r="1.2"/><circle cx="16" cy="9" r="1.2"/></svg>
    );
    case 'copy': return (
      <svg {...common}><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/></svg>
    );
    case 'trash': return (
      <svg {...common}><path d="M4 7h16M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M6 7l1 13a2 2 0 002 2h6a2 2 0 002-2l1-13"/></svg>
    );
    case 'edit': return (
      <svg {...common}><path d="M16 4l4 4-12 12H4v-4z"/><path d="M14 6l4 4"/></svg>
    );
    case 'heart': return (
      <svg {...common}><path d="M12 21s-7-5-7-11a4 4 0 017-2 4 4 0 017 2c0 6-7 11-7 11z"/></svg>
    );
    case 'user': return (
      <svg {...common}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/></svg>
    );
    case 'tag': return (
      <svg {...common}><path d="M20 12l-8 8-8-8V4h8z"/><circle cx="8" cy="8" r="1.5"/></svg>
    );
    case 'megaphone': return (
      <svg {...common}><path d="M3 11v2a2 2 0 002 2h2l9 5V4l-9 5H5a2 2 0 00-2 2z"/></svg>
    );
    case 'store': return (
      <svg {...common}><path d="M4 9h16l-1-4H5L4 9z"/><path d="M5 9v10h14V9"/><path d="M9 19v-6h6v6"/></svg>
    );
    case 'home': return (
      <svg {...common}><path d="M4 11l8-7 8 7v9a1 1 0 01-1 1h-4v-6h-6v6H5a1 1 0 01-1-1v-9z"/></svg>
    );
    case 'calendar': return (
      <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>
    );
    case 'mail': return (
      <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 7 9-7"/></svg>
    );
    case 'rocket': return (
      <svg {...common}><path d="M5 19l3-3m1 3l-4-4 7-7a5 5 0 015 5l-7 7-1-1"/><circle cx="14" cy="10" r="1.5"/></svg>
    );
    case 'target': return (
      <svg {...common}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/></svg>
    );
    case 'compass': return (
      <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M15 9l-2 6-4 1 2-6z"/></svg>
    );
    case 'shopping-bag': return (
      <svg {...common}><path d="M6 8h12l-1 12H7L6 8z"/><path d="M9 8V6a3 3 0 016 0v2"/></svg>
    );
    case 'shield': return (
      <svg {...common}><path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6l8-3z"/></svg>
    );
    case 'message': return (
      <svg {...common}><path d="M21 12a8 8 0 01-12 7l-5 1 1-5a8 8 0 1116-3z"/></svg>
    );
    case 'lightning': return (
      <svg {...common}><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>
    );
    case 'eye': return (
      <svg {...common}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>
    );
    case 'grid': return (
      <svg {...common}><rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/></svg>
    );
    case 'document': return (
      <svg {...common}><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/></svg>
    );
    case 'settings': return (
      <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 00-.1-1.4l2-1.5-2-3.4-2.4.8a7 7 0 00-2.4-1.4L13.5 3h-3l-.6 2.1a7 7 0 00-2.4 1.4L5 5.7l-2 3.4 2 1.5A7 7 0 005 12c0 .5 0 1 .1 1.4l-2 1.5 2 3.4 2.4-.8a7 7 0 002.4 1.4l.6 2.1h3l.6-2.1a7 7 0 002.4-1.4l2.4.8 2-3.4-2-1.5c.1-.4.1-.9.1-1.4z"/></svg>
    );
    case 'menu': return (
      <svg {...common}><path d="M4 6h16M4 12h16M4 18h16"/></svg>
    );
    case 'bell': return (
      <svg {...common}><path d="M6 9a6 6 0 1112 0c0 7 3 7 3 9H3c0-2 3-2 3-9z"/><path d="M10 19a2 2 0 004 0"/></svg>
    );
    case 'arrow-up': return (
      <svg {...common}><path d="M12 19V5M5 12l7-7 7 7"/></svg>
    );
    case 'arrow-down': return (
      <svg {...common}><path d="M12 5v14M5 12l7 7 7-7"/></svg>
    );
    case 'globe': return (
      <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/></svg>
    );
    default: return null;
  }
}

/* ── AI BUTTON ── */
function AiButton({ children, onClick, small }) {
  return (
    <button type="button" className="btn-ai" onClick={onClick} style={small ? { fontSize: 10.5, padding: '6px 10px' } : null}>
      <Icon name="sparkle" size={13}/>
      {children}
    </button>
  );
}

/* ── SEL CARD ── */
function SelCard({ icon, title, desc, active, onClick, multiselect }) {
  return (
    <button type="button" className={'sel-card' + (active ? ' active' : '')} onClick={onClick}>
      {icon && <div className="sc-icon"><Icon name={icon} size={16}/></div>}
      <div className="sc-body">
        <div className="sc-title">{title}</div>
        {desc && <div className="sc-desc">{desc}</div>}
      </div>
      <div className="sc-check">
        {active && <Icon name="check" size={12} stroke={2.5}/>}
      </div>
    </button>
  );
}

/* ── CHIP ROW ── */
function Chips({ options, value, onChange, multi = true, brand = false }) {
  const isOn = (o) => multi ? (value || []).includes(o) : value === o;
  const toggle = (o) => {
    if (multi) {
      const cur = value || [];
      onChange(cur.includes(o) ? cur.filter(x => x !== o) : [...cur, o]);
    } else onChange(o);
  };
  return (
    <div className="chips">
      {options.map((o) => (
        <button key={o} type="button"
          className={'chip' + (brand ? ' brand' : '') + (isOn(o) ? ' active' : '')}
          onClick={() => toggle(o)}>{o}</button>
      ))}
    </div>
  );
}

/* ── TAG INPUT ── */
function TagInput({ value, onChange, placeholder, suggestions, evade }) {
  const [draft, setDraft] = useState('');
  const list = value || [];
  const add = (v) => {
    const t = v.trim();
    if (!t) return;
    if (list.includes(t)) return;
    onChange([...list, t]);
    setDraft('');
  };
  const remove = (t) => onChange(list.filter(x => x !== t));
  return (
    <div>
      <div className="chip-input-wrap">
        {list.map(t => (
          <span key={t} className={'chip tag' + (evade ? ' evade' : '')} style={{ paddingRight: 6 }}>
            {t}
            <span className="rm" onClick={() => remove(t)}>×</span>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(draft); }
            else if (e.key === 'Backspace' && !draft && list.length) remove(list[list.length - 1]);
          }}
          placeholder={placeholder}
        />
      </div>
      {suggestions && suggestions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--muted)', marginRight: 4 }}>Sugerencias:</span>
          {suggestions.map(s => (
            <button key={s} type="button"
              onClick={() => add(s)}
              style={{ fontSize: 11, padding: '4px 9px', border: '1px dashed var(--border)', borderRadius: 999, background: '#fff', color: 'var(--muted)', cursor: 'pointer' }}>
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── PREVIEW PANEL HEADER ── */
function PreviewPanel({ title, subtitle, tinted = true, children, footer }) {
  return (
    <aside className={'preview-panel' + (tinted ? ' tinted' : '')}>
      <div className="preview-eyebrow">
        <span className="live"></span> Preview en tiempo real
      </div>
      <div className="preview-title" style={{ marginTop: 8 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>{subtitle}</div>}
      <div style={{ marginTop: 14 }}>{children}</div>
      {footer && <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px dashed var(--border)', fontSize: 12, color: 'var(--muted)', lineHeight: 1.55 }}>{footer}</div>}
    </aside>
  );
}

/* ── BRAND MOCK ── */
function BrandMock({ name, tagline, palette, cta = 'Ver nuevos productos', cap, brandColor }) {
  const c = brandColor || (palette && palette[0]?.hex) || '#F72C5B';
  const initial = (name || 'M').slice(0, 1).toUpperCase();
  return (
    <div className="brand-mock">
      <div className="bm-head">
        <div className="bm-logo" style={{ background: c }}>{initial}</div>
        <div>
          <div className="bm-name">{name || 'Tu marca'}</div>
          <div className="bm-tagline">{tagline || 'Descripción breve aparecerá aquí'}</div>
        </div>
      </div>
      <div className="bm-img" style={{
        background: `linear-gradient(135deg, ${c}d9, ${c}66), repeating-linear-gradient(45deg, #fff 0 8px, ${c}1a 8px 16px)`
      }}></div>
      <div className="bm-body">
        <div className="bm-cap">{cap || '✨ Captions y CTAs ajustados al tono de tu marca aparecerán aquí.'}</div>
        <button type="button" className="bm-btn" style={{ background: c }}>{cta}</button>
        {palette && palette.length > 0 && (
          <div className="bm-pal">
            {palette.slice(0, 7).map((p, i) => (
              <span key={i} style={{ background: p.hex }}></span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── COLOR BLOCK ── */
function ColorBlock({ hex, role, onChange, onRemove, dark }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(hex);
  useEffect(() => setDraft(hex), [hex]);
  const isDark = isHexDark(hex);
  return (
    <div className="color-block">
      <div className="swatch" style={{ background: hex, color: isDark ? '#fff' : '#000' }}>
        <span className="role-pill" style={{ background: isDark ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.08)', color: isDark ? '#1a1320' : '#fff' }}>{role}</span>
      </div>
      <div className="hex-row">
        {editing ? (
          <input
            autoFocus
            className="input"
            style={{ padding: '6px 8px', fontSize: 12, borderRadius: 8, width: '100%', fontFamily: 'JetBrains Mono, monospace' }}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => { onChange && onChange(draft); setEditing(false); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { onChange && onChange(draft); setEditing(false); } }}
          />
        ) : (
          <span className="hex" onClick={() => setEditing(true)} style={{ cursor: 'pointer' }}>{hex.toUpperCase()}</span>
        )}
        <div className="actions">
          <button onClick={() => setEditing(true)} title="Editar"><Icon name="edit" size={13}/></button>
          <button onClick={() => navigator.clipboard?.writeText(hex)} title="Copiar"><Icon name="copy" size={13}/></button>
          {onRemove && <button onClick={onRemove} title="Eliminar"><Icon name="trash" size={13}/></button>}
        </div>
      </div>
    </div>
  );
}

function isHexDark(hex) {
  if (!hex || hex[0] !== '#') return false;
  const h = hex.replace('#','');
  const v = h.length === 3 ? h.split('').map(c=>c+c).join('') : h;
  const r = parseInt(v.slice(0,2),16), g = parseInt(v.slice(2,4),16), b = parseInt(v.slice(4,6),16);
  const l = (0.299*r + 0.587*g + 0.114*b);
  return l < 140;
}

/* ── UPLOAD BOX ── */
function UploadBox({ label, hint, file, onUpload, onRemove }) {
  return (
    <div className={'upload-box' + (file ? ' has-file' : '')} onClick={() => !file && onUpload && onUpload()}>
      <div className="icon">
        {file ? <Icon name="check" size={18} stroke={2.4}/> : <Icon name="upload" size={18}/>}
      </div>
      <div className="title">{file ? file.name : label}</div>
      <div className="help">
        {file
          ? <span className="mono" style={{ fontSize: 10.5, color: 'var(--muted)' }}>{file.size || '128 KB'} · subido</span>
          : hint || 'PNG, JPG o SVG'}
      </div>
      {file && (
        <button type="button" className="btn-ghost" style={{ padding: '5px 10px', fontSize: 11, marginTop: 4 }} onClick={(e) => { e.stopPropagation(); onRemove && onRemove(); }}>
          Eliminar
        </button>
      )}
    </div>
  );
}

/* ── DEFAULT PALETTE ── */
const DEFAULT_PALETTE = [
  { hex: '#F72C5B', role: 'Principal' },
  { hex: '#E65D74', role: 'Secundario' },
  { hex: '#B32F46', role: 'Acento' },
  { hex: '#FFD6DF', role: 'Fondo suave' },
  { hex: '#F8FAFC', role: 'Neutral' },
  { hex: '#E4F1AC', role: 'Apoyo' },
  { hex: '#000000', role: 'Texto' },
];

/* ── WIZARD STEPS DEF ── */
const WIZARD_STEPS = [
  { id: 'welcome',   label: 'Bienvenida' },
  { id: 'identity',  label: 'Identidad básica' },
  { id: 'customer',  label: 'Cliente ideal' },
  { id: 'perception',label: 'Percepción' },
  { id: 'tone',      label: 'Tono' },
  { id: 'visual',    label: 'Estilo visual' },
  { id: 'rules',     label: 'Reglas comerciales' },
  { id: 'summary',   label: 'Resumen IA' },
  { id: 'done',      label: 'Confirmación' },
];

/* ── EXPORT TO WINDOW ── */
Object.assign(window, {
  Icon, AiButton, SelCard, Chips, TagInput, PreviewPanel,
  BrandMock, ColorBlock, UploadBox,
  DEFAULT_PALETTE, WIZARD_STEPS, isHexDark
});
