import type { BrandAsset, BrandProfile } from '../modules/brandProfiles/types';

const LOGO_SVG = `<svg viewBox="0 0 375 375" xmlns="http://www.w3.org/2000/svg">
  <path fill="#f72c5b" d="M 122.25 237.644531 C 122.199219 237.644531 122.148438 237.628906 122.105469 237.601562 C 122.058594 237.578125 122.023438 237.539062 122 237.496094 C 121.972656 237.449219 121.960938 237.398438 121.957031 237.34375 C 121.957031 237.292969 121.96875 237.242188 121.996094 237.195312 L 173.234375 144.984375 C 173.273438 144.914062 173.273438 144.847656 173.234375 144.78125 C 173.195312 144.710938 173.136719 144.675781 173.054688 144.675781 L 124.335938 144.675781 C 124.164062 144.675781 124.039062 144.601562 123.953125 144.453125 C 123.871094 144.308594 123.871094 144.160156 123.960938 144.015625 L 152.363281 96.300781 C 152.585938 95.917969 152.921875 95.730469 153.359375 95.730469 L 252.277344 95.730469 C 252.300781 95.730469 252.328125 95.734375 252.351562 95.746094 C 252.949219 96.128906 252.9375 96.226562 252.878906 96.316406 C 222.839844 142.988281 192.269531 193.289062 165.96875 237.089844 C 165.746094 237.460938 165.421875 237.644531 164.992188 237.644531 Z"/>
  <path fill="#f72c5b" d="M 171.398438 237.335938 L 204.773438 183.78125 C 204.921875 183.539062 205.140625 183.421875 205.425781 183.421875 L 260.40625 183.421875 C 260.515625 183.417969 260.59375 183.464844 260.640625 183.558594 C 260.691406 183.652344 260.6875 183.746094 260.625 183.832031 C 245.023438 205.738281 224.308594 235.1875 198.480469 272.183594 C 184.175781 292.664062 168.128906 315.570312 151.492188 338.300781 C 151.425781 338.390625 151.339844 338.410156 151.242188 338.355469 C 151.144531 338.300781 151.113281 338.21875 151.15625 338.113281 C 163.5 305.546875 176.523438 272.203125 190.222656 238.085938 C 190.261719 237.988281 190.25 237.890625 190.191406 237.800781 C 190.128906 237.710938 190.046875 237.667969 189.9375 237.667969 L 171.578125 237.667969 C 171.496094 237.664062 171.433594 237.628906 171.394531 237.554688 C 171.351562 237.480469 171.355469 237.410156 171.398438 237.335938 Z"/>
</svg>`;

const LOGO_FOOTER = `<svg width="18" height="18" viewBox="0 0 375 375" xmlns="http://www.w3.org/2000/svg">
  <path fill="#f72c5b" d="M 122.25 237.644531 C 122.199219 237.644531 122.148438 237.628906 122.105469 237.601562 C 122.058594 237.578125 122.023438 237.539062 122 237.496094 C 121.972656 237.449219 121.960938 237.398438 121.957031 237.34375 C 121.957031 237.292969 121.96875 237.242188 121.996094 237.195312 L 173.234375 144.984375 C 173.273438 144.914062 173.273438 144.847656 173.234375 144.78125 C 173.195312 144.710938 173.136719 144.675781 173.054688 144.675781 L 124.335938 144.675781 C 124.164062 144.675781 124.039062 144.601562 123.953125 144.453125 C 123.871094 144.308594 123.871094 144.160156 123.960938 144.015625 L 152.363281 96.300781 C 152.585938 95.917969 152.921875 95.730469 153.359375 95.730469 L 252.277344 95.730469 C 252.300781 95.730469 252.328125 95.734375 252.351562 95.746094 C 252.949219 96.128906 252.9375 96.226562 252.878906 96.316406 C 222.839844 142.988281 192.269531 193.289062 165.96875 237.089844 C 165.746094 237.460938 165.421875 237.644531 164.992188 237.644531 Z"/>
  <path fill="#f72c5b" d="M 171.398438 237.335938 L 204.773438 183.78125 C 204.921875 183.539062 205.140625 183.421875 205.425781 183.421875 L 260.40625 183.421875 C 260.515625 183.417969 260.59375 183.464844 260.640625 183.558594 C 260.691406 183.652344 260.6875 183.746094 260.625 183.832031 C 245.023438 205.738281 224.308594 235.1875 198.480469 272.183594 C 184.175781 292.664062 168.128906 315.570312 151.492188 338.300781 C 151.425781 338.390625 151.339844 338.410156 151.242188 338.355469 C 151.144531 338.300781 151.113281 338.21875 151.15625 338.113281 C 163.5 305.546875 176.523438 272.203125 190.222656 238.085938 C 190.261719 237.988281 190.25 237.890625 190.191406 237.800781 C 190.128906 237.710938 190.046875 237.667969 189.9375 237.667969 L 171.578125 237.667969 C 171.496094 237.664062 171.433594 237.628906 171.394531 237.554688 C 171.351562 237.480469 171.355469 237.410156 171.398438 237.335938 Z"/>
</svg>`;

function esc(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function slug(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'marca';
}

function formatDate(ts?: number): string {
  const d = ts ? new Date(ts) : new Date();
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
}

function pageFooter(pageNum: number | string): string {
  return `
    <div class="page-footer">
      <div style="display:flex;align-items:center;gap:8px">
        ${LOGO_FOOTER}
        <span style="font-family:var(--font-body);font-size:11px;font-weight:600;color:#64748b">Luz IA Studio</span>
      </div>
      <span class="footer-page">${String(pageNum).padStart(2, '0')}</span>
    </div>
    <div class="accent-band"></div>`;
}

function pills(items?: string[]): string {
  const clean = (items || []).filter(Boolean);
  if (!clean.length) return '<span class="muted">—</span>';
  return clean.map(i => `<span class="pill">${esc(i)}</span>`).join('');
}

function val(v?: string): string {
  return v?.trim() ? esc(v) : '<span class="muted">—</span>';
}

function field(label: string, value?: string): string {
  return `<div class="field"><div class="field-label">${esc(label)}</div><div class="field-value">${val(value)}</div></div>`;
}

function chipField(label: string, items?: string[]): string {
  return `<div class="field"><div class="field-label">${esc(label)}</div><div class="chip-row">${pills(items)}</div></div>`;
}

function summaryBlock(title: string, body?: string): string {
  return `<div class="sum-block"><div class="strategy-label">${esc(title)}</div><p>${val(body)}</p></div>`;
}

const BUSINESS_MODEL_LABELS: Record<string, string> = {
  self_made_products: 'Productos hechos por la marca',
  supplier_products: 'Productos comprados a proveedores',
  own_brand_third_party_manufacturing: 'Marca propia, fabricación externa',
  services: 'Servicios',
  client_content_creator: 'Contenido para marcas o clientes',
  starting: 'Marca en etapa inicial',
  other: 'Otro',
};

async function assetToBase64(asset?: BrandAsset): Promise<string> {
  if (!asset?.url) return '';
  if (asset.url.startsWith('data:')) return asset.url;
  try {
    const res = await fetch(asset.url);
    const blob = await res.blob();
    return await new Promise<string>(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(asset.url);
      reader.readAsDataURL(blob);
    });
  } catch {
    return asset.url;
  }
}

async function compressImage(src: string, maxPx = 600, quality = 0.78): Promise<string> {
  if (!src) return '';
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve('');
    img.src = src;
  });
}

// ─── CSS ──────────────────────────────────────────────────────
const CSS = `
<style>
:root {
  --fucsia:#F72C5B;--fucsia-hover:#C4224A;--black:#06060D;--dark-text:#0f172a;
  --white:#FFFFFF;--lime:#E4F1AC;--violet:#7C3AED;--slate:#f8fafc;
  --yellow:#fef9c3;--border:#e2e8f0;
  --fucsia-soft:rgba(247,44,91,0.10);--violet-soft:rgba(124,58,237,0.10);
  --lime-soft:rgba(228,241,172,0.50);
  --r-sm:12px;--r-md:16px;--r-lg:24px;
  --font-title:'Syne',sans-serif;--font-body:'Inter',sans-serif;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html{font-size:16px;}
body{font-family:var(--font-body);background:#1a1a2e;color:var(--dark-text);-webkit-font-smoothing:antialiased;}
.toolbar{position:fixed;top:0;left:0;right:0;z-index:1000;background:rgba(6,6,13,0.96);backdrop-filter:blur(12px);border-bottom:1px solid rgba(247,44,91,0.25);display:flex;align-items:center;justify-content:space-between;padding:12px 32px;height:60px;}
.toolbar-logo{display:flex;align-items:center;gap:10px;}
.toolbar-logo svg{width:28px;height:28px;}
.toolbar-brand{font-family:var(--font-title);font-size:14px;font-weight:700;letter-spacing:0.06em;color:var(--white);text-transform:uppercase;}
.toolbar-brand span{color:var(--fucsia);}
.btn-pdf{display:flex;align-items:center;gap:7px;background:var(--fucsia);color:var(--white);border:none;border-radius:8px;padding:8px 18px;font-family:var(--font-body);font-size:13px;font-weight:600;cursor:pointer;letter-spacing:0.03em;transition:background 0.18s;}
.btn-pdf:hover{background:var(--fucsia-hover);}
.canvas-wrap{padding:80px 24px 48px;display:flex;flex-direction:column;align-items:center;gap:20px;}
.page{width:794px;min-height:1122px;position:relative;overflow:hidden;box-shadow:0 8px 48px rgba(0,0,0,0.45);background:var(--white);page-break-after:always;flex-shrink:0;}
.page-label{position:absolute;top:-26px;left:0;font-family:var(--font-body);font-size:11px;font-weight:500;color:rgba(255,255,255,0.4);letter-spacing:0.08em;text-transform:uppercase;}
.section-header{background:var(--black);padding:22px 36px;display:flex;align-items:center;justify-content:space-between;}
.section-header-title{font-family:var(--font-title);font-size:13px;font-weight:700;letter-spacing:0.14em;color:var(--white);text-transform:uppercase;}
.section-header-badge{font-family:var(--font-body);font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:var(--fucsia);background:var(--fucsia-soft);border:1px solid rgba(247,44,91,0.3);padding:4px 10px;border-radius:100px;}
.page-body{padding:32px 36px 88px;}
.page-footer{position:absolute;bottom:36px;left:0;right:0;padding:14px 36px;display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--border);}
.footer-page{font-size:11px;font-weight:600;letter-spacing:0.08em;color:rgba(15,23,42,0.3);font-family:var(--font-body);}
.accent-band{height:4px;background:var(--fucsia);position:absolute;bottom:0;left:0;right:0;}
/* COVER */
.cover{background:var(--black);min-height:1122px;display:flex;flex-direction:column;position:relative;}
.cover-noise{position:absolute;inset:0;pointer-events:none;opacity:0.03;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");}
.cover-glow{position:absolute;width:600px;height:600px;top:-200px;right:-150px;background:radial-gradient(circle,rgba(247,44,91,0.12) 0%,transparent 65%);pointer-events:none;}
.cover-glow-2{position:absolute;width:400px;height:400px;bottom:100px;left:-100px;background:radial-gradient(circle,rgba(124,58,237,0.08) 0%,transparent 65%);pointer-events:none;}
.cover-top{padding:44px 48px 0;display:flex;align-items:center;justify-content:space-between;position:relative;z-index:1;}
.cover-logo{display:flex;align-items:center;gap:14px;}
.cover-logo-icon{width:42px;height:42px;}
.cover-logo-text{font-family:var(--font-title);font-size:12px;font-weight:700;letter-spacing:0.16em;color:rgba(255,255,255,0.7);text-transform:uppercase;}
.cover-kit-badge{font-family:var(--font-title);font-size:10px;font-weight:700;letter-spacing:0.18em;color:var(--fucsia);text-transform:uppercase;border:1px solid rgba(247,44,91,0.4);padding:6px 14px;border-radius:100px;}
.cover-main{flex:1;padding:60px 48px 0;position:relative;z-index:1;display:flex;flex-direction:column;}
.cover-eyebrow{font-family:var(--font-title);font-size:10px;font-weight:700;letter-spacing:0.22em;color:var(--fucsia);text-transform:uppercase;margin-bottom:20px;}
.cover-headline{font-family:var(--font-title);font-size:60px;font-weight:800;font-style:italic;text-transform:uppercase;line-height:0.95;letter-spacing:-0.02em;color:var(--white);margin-bottom:28px;overflow-wrap:anywhere;}
.cover-headline em{font-style:italic;background:linear-gradient(135deg,var(--fucsia) 0%,#ff7eb3 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.cover-concept{font-family:var(--font-body);font-size:15px;font-weight:400;line-height:1.65;color:rgba(255,255,255,0.55);max-width:480px;margin-bottom:36px;}
.cover-line{width:100%;height:1px;background:linear-gradient(to right,var(--fucsia),transparent);margin-bottom:32px;}
.cover-promise{font-family:var(--font-title);font-size:18px;font-weight:700;color:var(--white);letter-spacing:0.01em;margin-bottom:32px;font-style:italic;padding-left:20px;border-left:3px solid var(--fucsia);}
.cover-stats{display:flex;gap:12px;margin-bottom:40px;}
.stat-chip{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:var(--r-md);padding:16px 22px;display:flex;flex-direction:column;gap:4px;flex:1;}
.stat-chip:first-child{border-color:rgba(247,44,91,0.35);background:rgba(247,44,91,0.07);}
.stat-num{font-family:var(--font-title);font-size:28px;font-weight:800;color:var(--white);}
.stat-chip:first-child .stat-num{color:var(--fucsia);}
.stat-label{font-family:var(--font-body);font-size:10px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.35);}
.cover-box{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-left:3px solid var(--fucsia);border-radius:var(--r-md);padding:20px 24px;margin-bottom:48px;}
.cover-box-title{font-family:var(--font-body);font-size:10px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:var(--fucsia);margin-bottom:10px;}
.cover-box ul{list-style:none;display:flex;flex-direction:column;gap:6px;}
.cover-box li{font-family:var(--font-body);font-size:13px;color:rgba(255,255,255,0.6);line-height:1.5;padding-left:16px;position:relative;}
.cover-box li::before{content:'→';position:absolute;left:0;color:var(--fucsia);font-size:11px;}
.cover-footer{padding:0 48px;position:relative;z-index:1;}
.cover-footer-inner{display:flex;align-items:center;justify-content:space-between;padding:16px 0;border-top:1px solid rgba(255,255,255,0.08);}
/* LOGO SHOWCASE */
.logo-showcase{background:var(--black);border-radius:var(--r-lg);padding:48px;display:flex;align-items:center;justify-content:center;margin-bottom:24px;min-height:220px;position:relative;overflow:hidden;}
.logo-showcase::before{content:'';position:absolute;inset:0;background:radial-gradient(circle at center,rgba(247,44,91,0.08) 0%,transparent 65%);}
.logo-showcase img{max-width:280px;max-height:160px;object-fit:contain;position:relative;z-index:1;}
.logo-placeholder{font-family:var(--font-title);font-size:52px;font-weight:800;color:rgba(255,255,255,0.15);text-transform:uppercase;letter-spacing:-0.02em;}
/* FIELDS */
.strategy-label{font-family:var(--font-body);font-size:10px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:var(--fucsia);margin-bottom:8px;}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:18px;}
.panel{border:1px solid var(--border);border-radius:var(--r-lg);padding:20px 22px;background:white;}
.panel.dark{background:var(--black);}
.panel.soft{background:var(--slate);}
.field{padding:11px 0;border-bottom:1px solid var(--border);}
.field:last-child{border-bottom:none;}
.field-label{font-size:10px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;margin-bottom:5px;}
.field-value{font-size:13px;font-weight:600;line-height:1.55;color:var(--dark-text);}
.muted{color:#94a3b8;font-weight:500;}
.chip-row{display:flex;flex-wrap:wrap;gap:6px;}
.pill{display:inline-flex;align-items:center;border:1px solid rgba(247,44,91,0.22);background:rgba(247,44,91,0.08);color:var(--fucsia);border-radius:100px;padding:4px 10px;font-size:11px;font-weight:700;line-height:1.2;}
.section-title{font-family:var(--font-title);font-size:18px;font-weight:800;color:var(--dark-text);margin-bottom:14px;}
.divider{height:1px;background:var(--border);margin:22px 0;}
.quote-box{background:var(--black);border-radius:var(--r-lg);padding:24px 26px;border-left:4px solid var(--fucsia);color:white;margin-bottom:18px;}
.quote-box .strategy-label{color:var(--lime);}
.quote-box p{font-family:var(--font-title);font-size:17px;font-weight:700;line-height:1.45;color:white;}
/* METRICS */
.metric-row{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:20px 0;}
.metric{background:var(--black);border-radius:var(--r-md);padding:16px 18px;}
.metric-label{font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.42);margin-bottom:6px;}
.metric-value{font-family:var(--font-title);font-size:16px;font-weight:800;color:white;line-height:1.25;}
.metric.accent .metric-value{color:var(--fucsia);}
.metric.lime .metric-value{color:var(--lime);}
/* COLORS */
.color-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;}
.color-card{display:flex;align-items:center;gap:12px;background:var(--slate);border:1px solid var(--border);border-radius:var(--r-md);padding:10px 12px;}
.swatch{width:44px;height:44px;border-radius:10px;border:1px solid rgba(0,0,0,0.08);box-shadow:0 4px 12px rgba(15,23,42,0.08);flex-shrink:0;}
.color-name{font-size:12px;font-weight:800;color:var(--dark-text);}
.color-meta{font-family:monospace;font-size:10px;color:#64748b;margin-top:3px;}
/* ASSETS */
.asset-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;}
.asset-card{border:1px solid var(--border);border-radius:var(--r-md);overflow:hidden;background:white;}
.asset-card img{width:100%;height:96px;object-fit:contain;background:var(--slate);}
.asset-fallback{width:100%;height:96px;background:var(--slate);display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:11px;font-weight:800;text-transform:uppercase;}
.asset-info{padding:8px 10px;}
.asset-name{font-size:10px;font-weight:800;color:var(--dark-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.asset-type{font-size:9px;color:#64748b;margin-top:2px;}
/* SUMMARY */
.sum-hero{background:var(--black);border-radius:var(--r-lg);padding:26px 28px;margin-bottom:18px;border-left:4px solid var(--fucsia);}
.sum-hero p{font-family:var(--font-title);font-size:20px;font-weight:800;color:white;line-height:1.45;}
.sum-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;}
.sum-block{border:1px solid var(--border);border-radius:var(--r-md);padding:15px;background:var(--slate);}
.sum-block p{font-size:12px;line-height:1.62;color:#475569;margin-top:6px;}
.do-dont{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.rule-box{border-radius:var(--r-md);padding:16px 18px;}
.rule-box.yes{background:var(--lime-soft);border:1px solid rgba(155,194,30,0.35);}
.rule-box.no{background:var(--fucsia-soft);border:1px solid rgba(247,44,91,0.22);}
.rule-title{font-size:10px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:9px;}
.rule-box.yes .rule-title{color:#4a6f06;}
.rule-box.no .rule-title{color:var(--fucsia);}
.rule-box ul{padding-left:18px;}
.rule-box li{font-size:12px;line-height:1.55;margin-bottom:5px;color:#334155;}
/* EMPTY */
.empty-box{border:1px dashed var(--border);background:var(--slate);border-radius:var(--r-md);padding:18px;color:#94a3b8;font-size:13px;font-weight:600;}
/* PROGRESS BAR */
.prog-track{height:8px;background:rgba(255,255,255,0.08);border-radius:100px;overflow:hidden;margin-top:10px;}
.prog-bar{height:100%;border-radius:100px;background:var(--fucsia);}
@media print{
  *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}
  html,body{background:white!important;margin:0;padding:0;}
  .toolbar,.page-label{display:none!important;}
  .canvas-wrap{padding:0!important;gap:0!important;background:white!important;display:block!important;}
  .page{box-shadow:none!important;margin:0!important;page-break-after:always!important;break-after:page!important;page-break-inside:avoid!important;width:100%!important;}
  .page:last-child{page-break-after:auto!important;break-after:auto!important;}
}
</style>`;

// ─── Páginas ──────────────────────────────────────────────────

function buildCoverPage(profile: Partial<BrandProfile>, logoSrc: string): string {
  const name = profile.brandName || 'Mi Marca';
  const category = profile.mainCategory || 'Marca';
  const score = profile.completionScore ?? 0;
  const colors = profile.visualIdentity?.colors?.length ?? 0;
  const assets = profile.visualIdentity?.assets?.length ?? 0;
  const words = name.split(' ');
  const mid = Math.ceil(words.length / 2);
  const line1 = words.slice(0, mid).join(' ');
  const line2 = words.slice(mid).join(' ') || category;

  const logoHtml = logoSrc
    ? `<img src="${logoSrc}" alt="${esc(name)}" />`
    : `<div class="logo-placeholder">${esc(name.slice(0, 2).toUpperCase())}</div>`;

  return `
  <div class="page-label">Página 1 · Portada</div>
  <div class="page" id="page-1">
    <div class="cover">
      <div class="cover-noise"></div>
      <div class="cover-glow"></div>
      <div class="cover-glow-2"></div>
      <div class="cover-top">
        <div class="cover-logo">
          <div class="cover-logo-icon">${LOGO_SVG}</div>
          <span class="cover-logo-text">Luz IA Studio</span>
        </div>
        <div class="cover-kit-badge">Informe de Marca</div>
      </div>
      <div class="cover-main">
        <div class="cover-eyebrow">Brand Profile · ${formatDate(profile.updatedAt)}</div>
        <div class="cover-headline">
          ${esc(line1)}<br><em>${esc(line2)}</em>
        </div>
        <div class="cover-concept">${profile.shortDescription ? esc(profile.shortDescription) : esc(category)}</div>
        <div class="cover-line"></div>
        <div class="cover-promise">"${profile.positioning?.brandPromise ? esc(profile.positioning.brandPromise) : esc(profile.aiSummary?.brandEssence || 'Perfil de identidad de marca completo')}"</div>
        <div class="cover-stats">
          <div class="stat-chip">
            <div class="stat-num">${score}%</div>
            <div class="stat-label">Completitud</div>
          </div>
          <div class="stat-chip">
            <div class="stat-num">${colors}</div>
            <div class="stat-label">Colores</div>
          </div>
          <div class="stat-chip">
            <div class="stat-num">${assets}</div>
            <div class="stat-label">Assets</div>
          </div>
        </div>
        <div class="cover-box">
          <div class="cover-box-title">¿Qué contiene este informe?</div>
          <ul>
            <li>Resumen ejecutivo con datos de identidad y cliente ideal</li>
            <li>Todas las selecciones del wizard: tono, voz, reglas comerciales</li>
            <li>Paleta de colores completa e identidad visual</li>
            <li>Análisis IA: esencia, posicionamiento y guías de contenido</li>
          </ul>
        </div>
      </div>
      <div class="cover-footer">
        <div class="cover-footer-inner">
          <div style="display:flex;align-items:center;gap:12px">
            ${logoSrc ? `<img src="${logoSrc}" style="width:36px;height:36px;object-fit:contain;filter:brightness(0) invert(1);opacity:0.5" />` : ''}
            <span style="font-family:var(--font-body);font-size:11px;color:rgba(255,255,255,0.35)">Luz IA Studio · ${formatDate()}</span>
          </div>
          <span style="font-family:var(--font-body);font-size:11px;color:rgba(255,255,255,0.25)">${esc(profile.country || '')}</span>
        </div>
        <div class="accent-band"></div>
      </div>
    </div>
  </div>`;
}

function buildExecutivePage(profile: Partial<BrandProfile>, logoSrc: string): string {
  const businessModel = profile.businessModel ? (BUSINESS_MODEL_LABELS[profile.businessModel] || profile.businessModel) : undefined;
  const score = profile.completionScore ?? 0;
  const statusLabels: Record<string, string> = { incomplete: 'Incompleta', basic: 'Básica', complete: 'Completa', advanced: 'Avanzada' };
  const statusLabel = statusLabels[profile.status || 'incomplete'] || 'Incompleta';

  return `
  <div class="page-label">Página 2 · Resumen ejecutivo</div>
  <div class="page" id="page-2">
    <div class="section-header">
      <span class="section-header-title">Resumen Ejecutivo</span>
      <span class="section-header-badge">${esc(statusLabel)}</span>
    </div>
    <div class="page-body">
      <div class="logo-showcase">
        ${logoSrc ? `<img src="${logoSrc}" alt="${esc(profile.brandName || '')}" />` : `<div class="logo-placeholder">${esc((profile.brandName || 'MB').slice(0, 2).toUpperCase())}</div>`}
      </div>

      <div class="two-col" style="margin-bottom:18px">
        <div>
          <div class="quote-box">
            <div class="strategy-label">Promesa de marca</div>
            <p>${val(profile.positioning?.brandPromise)}</p>
          </div>
          <div class="panel soft">
            <div class="strategy-label">Descripción</div>
            <p style="font-size:13px;line-height:1.7;color:#475569">${val(profile.shortDescription)}</p>
          </div>
        </div>
        <div class="panel">
          ${field('Nombre de marca', profile.brandName)}
          ${field('Categoría', profile.mainCategory)}
          ${field('País(es)', profile.country)}
          ${field('Modelo de negocio', businessModel)}
          ${field('Creada', profile.createdAt ? formatDate(profile.createdAt) : undefined)}
          ${field('Última actualización', profile.updatedAt ? formatDate(profile.updatedAt) : undefined)}
          <div class="field">
            <div class="field-label">Completitud</div>
            <div style="display:flex;align-items:center;gap:10px;margin-top:4px">
              <div style="flex:1;height:8px;background:#f1f5f9;border-radius:100px;overflow:hidden">
                <div style="height:100%;width:${score}%;background:${score >= 60 ? '#10B981' : '#F72C5B'};border-radius:100px"></div>
              </div>
              <span style="font-family:var(--font-title);font-size:14px;font-weight:800;color:${score >= 60 ? '#10B981' : '#F72C5B'}">${score}%</span>
            </div>
          </div>
        </div>
      </div>

      <div class="metric-row">
        <div class="metric accent">
          <div class="metric-label">Público principal</div>
          <div class="metric-value">${val(profile.targetCustomer?.genderFocus)}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Rango de edad</div>
          <div class="metric-value">${val(profile.targetCustomer?.ageRange)}</div>
        </div>
        <div class="metric lime">
          <div class="metric-label">Etapa comercial</div>
          <div class="metric-value">${val(profile.commercialRules?.businessStage?.label)}</div>
        </div>
      </div>

      ${profile.aiSummary?.brandEssence ? `
      <div class="panel soft">
        <div class="strategy-label">Esencia IA</div>
        <p style="font-size:13px;line-height:1.7;color:#334155;margin-top:6px">${esc(profile.aiSummary.brandEssence)}</p>
      </div>` : ''}
    </div>
    ${pageFooter(2)}
  </div>`;
}

function buildWizardPage(profile: Partial<BrandProfile>): string {
  return `
  <div class="page-label">Página 3 · Selecciones del wizard</div>
  <div class="page" id="page-3">
    <div class="section-header">
      <span class="section-header-title">Selecciones del Wizard</span>
      <span class="section-header-badge">Registro completo</span>
    </div>
    <div class="page-body">
      <div class="two-col" style="margin-bottom:18px">
        <div class="panel">
          <div class="section-title">Cliente ideal</div>
          ${field('Público', profile.targetCustomer?.genderFocus)}
          ${field('Edad', profile.targetCustomer?.ageRange)}
          ${chipField('Motivaciones de compra', profile.targetCustomer?.buyingMotivation)}
          ${chipField('Dudas del cliente', profile.targetCustomer?.customerDoubts)}
          ${field('Descripción libre', profile.targetCustomer?.freeDescription)}
        </div>
        <div class="panel">
          <div class="section-title">Posicionamiento</div>
          ${field('Nivel percibido', profile.positioning?.perceivedLevel)}
          ${chipField('Diferenciadores', profile.positioning?.mainDifferentiators)}
          ${field('Diferencial escrito', profile.positioning?.mainDifferentiatorText)}
          ${chipField('Alternativas / competencia', profile.positioning?.competitorAlternatives)}
          ${field('Promesa de marca', profile.positioning?.brandPromise)}
        </div>
      </div>
      <div class="divider"></div>
      <div class="two-col">
        <div class="panel soft">
          <div class="section-title">Tono y voz</div>
          ${chipField('Keywords de tono', profile.voice?.toneKeywords)}
          ${field('Formalidad', profile.voice?.formality)}
          ${field('Uso de emojis', profile.voice?.emojiLevel)}
          ${chipField('Palabras preferidas', profile.voice?.preferredWords)}
          ${chipField('Palabras prohibidas', profile.voice?.forbiddenWords)}
        </div>
        <div class="panel soft">
          <div class="section-title">Reglas comerciales</div>
          ${chipField('Canales de venta', profile.commercialRules?.mainSalesChannels)}
          ${chipField('CTAs preferidos', profile.commercialRules?.preferredCTA)}
          ${field('Etapa', profile.commercialRules?.businessStage?.label)}
          ${chipField('Constructores de confianza', profile.commercialRules?.trustBuilders)}
          ${chipField('Objeciones comerciales', profile.commercialRules?.customerDoubts)}
        </div>
      </div>
    </div>
    ${pageFooter(3)}
  </div>`;
}

function buildVisualPage(profile: Partial<BrandProfile>, preparedAssets: Array<{ asset: BrandAsset; src: string }>): string {
  const colors = profile.visualIdentity?.colors || [];

  const colorsHtml = colors.length
    ? `<div class="color-grid">${colors.map(c => `
        <div class="color-card">
          <div class="swatch" style="background:${esc(c.hex)}"></div>
          <div>
            <div class="color-name">${esc(c.label || c.role)}</div>
            <div class="color-meta">${esc(c.role)} · ${esc(c.hex)}</div>
          </div>
        </div>`).join('')}</div>`
    : '<div class="empty-box">Sin paleta cargada.</div>';

  const assetsHtml = preparedAssets.length
    ? `<div class="asset-grid">${preparedAssets.map(({ asset, src }) => `
        <div class="asset-card">
          ${src ? `<img src="${esc(src)}" alt="${esc(asset.name || asset.fileName || '')}" />` : `<div class="asset-fallback">${esc(asset.type || 'Archivo')}</div>`}
          <div class="asset-info">
            <div class="asset-name">${esc(asset.name || asset.fileName || 'Asset')}</div>
            <div class="asset-type">${esc(asset.type)}${asset.notes ? ` · ${esc(asset.notes)}` : ''}</div>
          </div>
        </div>`).join('')}</div>`
    : '<div class="empty-box">Sin logos, referencias o manuales cargados.</div>';

  return `
  <div class="page-label">Página 4 · Identidad visual</div>
  <div class="page" id="page-4">
    <div class="section-header">
      <span class="section-header-title">Identidad Visual</span>
      <span class="section-header-badge">${colors.length} colores · ${profile.visualIdentity?.assets?.length || 0} assets</span>
    </div>
    <div class="page-body">
      <div class="two-col" style="margin-bottom:18px">
        <div class="panel">
          <div class="section-title">Dirección visual</div>
          ${chipField('Estilo visual', profile.visualIdentity?.visualStyle)}
          ${chipField('Mood de contenido', profile.visualIdentity?.contentMood)}
          ${chipField('Evitar visualmente', profile.visualIdentity?.avoidVisuals)}
        </div>
        <div class="panel soft">
          <div class="section-title">Paleta de colores</div>
          ${colorsHtml}
        </div>
      </div>
      <div class="divider"></div>
      <div class="panel">
        <div class="section-title">Assets y referencias</div>
        ${assetsHtml}
      </div>
    </div>
    ${pageFooter(4)}
  </div>`;
}

function buildSummaryPage(profile: Partial<BrandProfile>): string {
  const s = profile.aiSummary;

  if (!s?.brandEssence) {
    return `
    <div class="page-label">Página 5 · Resumen IA</div>
    <div class="page" id="page-5">
      <div class="section-header">
        <span class="section-header-title">Resumen IA</span>
        <span class="section-header-badge">Pendiente</span>
      </div>
      <div class="page-body">
        <div class="empty-box" style="text-align:center;padding:64px 48px">
          <p style="font-size:16px;font-weight:800;color:#475569;margin-bottom:8px">Resumen IA no generado</p>
          <p style="font-size:13px;color:#94a3b8">Volvé al wizard, completá el paso de Resumen IA y descargá el informe de nuevo.</p>
        </div>
      </div>
      ${pageFooter(5)}
    </div>`;
  }

  return `
  <div class="page-label">Página 5 · Resumen IA</div>
  <div class="page" id="page-5">
    <div class="section-header">
      <span class="section-header-title">Resumen IA</span>
      <span class="section-header-badge">Guía estratégica</span>
    </div>
    <div class="page-body">
      <div class="sum-hero" style="margin-bottom:18px">
        <div class="strategy-label" style="color:var(--lime);margin-bottom:8px">Esencia de marca</div>
        <p>${esc(s.brandEssence)}</p>
      </div>
      <div class="sum-grid">
        ${summaryBlock('Cliente ideal', s.targetCustomerSummary)}
        ${summaryBlock('Posicionamiento', s.positioningSummary)}
        ${summaryBlock('Tono y voz', s.voiceGuidelines)}
        ${summaryBlock('Guía visual', s.visualGuidelines)}
        ${summaryBlock('Guía comercial', s.salesGuidelines)}
        ${summaryBlock('Esencia resumida', s.brandEssence)}
      </div>
      <div class="do-dont" style="margin-top:14px">
        <div class="rule-box yes">
          <div class="rule-title">Sí hacer en contenido</div>
          <ul>${(s.contentDo || []).map(item => `<li>${esc(item)}</li>`).join('') || '<li>Sin recomendaciones aún.</li>'}</ul>
        </div>
        <div class="rule-box no">
          <div class="rule-title">Evitar en contenido</div>
          <ul>${(s.contentDont || []).map(item => `<li>${esc(item)}</li>`).join('') || '<li>Sin restricciones aún.</li>'}</ul>
        </div>
      </div>
    </div>
    ${pageFooter(5)}
  </div>`;
}

// ─── Builder principal ────────────────────────────────────────

async function buildHtml(profile: Partial<BrandProfile>): Promise<string> {
  const logoAsset = profile.visualIdentity?.assets?.find(a => a.type === 'logo');
  const logoRaw = await assetToBase64(logoAsset);
  const logoSrc = logoRaw ? await compressImage(logoRaw, 400, 0.85) : '';

  const assets = profile.visualIdentity?.assets || [];
  const preparedAssets = await Promise.all(
    assets.slice(0, 12).map(async asset => {
      const isImage = asset.mimeType?.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(asset.fileName || asset.url || '');
      if (!isImage) return { asset, src: '' };
      const raw = await assetToBase64(asset);
      const src = raw ? await compressImage(raw, 220, 0.72) : '';
      return { asset, src };
    })
  );

  const name = esc(profile.brandName || 'Informe de Marca');

  const pages = [
    buildCoverPage(profile, logoSrc),
    buildExecutivePage(profile, logoSrc),
    buildWizardPage(profile),
    buildVisualPage(profile, preparedAssets),
    buildSummaryPage(profile),
  ].join('\n');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${name} — Informe de Marca · Luz IA Studio</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
${CSS}
</head>
<body>

<div class="toolbar">
  <div class="toolbar-logo">
    ${LOGO_SVG.replace('viewBox', 'width="28" height="28" viewBox')}
    <span class="toolbar-brand">Luz <span>IA</span> Studio</span>
  </div>
  <button class="btn-pdf" onclick="window.print()">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="15" height="15">
      <path d="M12 16V8m0 8-3-3m3 3 3-3M20 20H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2Z"/>
    </svg>
    Exportar PDF
  </button>
</div>

<div class="canvas-wrap">
${pages}
</div>

</body>
</html>`;
}

// ─── Export público ───────────────────────────────────────────

export async function downloadBrandReport(data: Partial<BrandProfile>): Promise<void> {
  const html = await buildHtml(data);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const win = window.open(url, '_blank');
  if (!win) {
    const a = document.createElement('a');
    a.href = url;
    a.download = `informe-marca-${slug(data.brandName || 'marca')}.html`;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  win.onload = () => {
    win.focus();
    win.print();
    win.onafterprint = () => {
      win.close();
      URL.revokeObjectURL(url);
    };
  };
}
