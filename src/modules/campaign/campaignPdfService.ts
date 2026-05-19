import html2canvasLib from 'html2canvas';
import { jsPDF as jsPDFLib } from 'jspdf';
import { CampaignSet, CampaignPiece, ImageSlotRole, IMAGE_SLOT_META, CAMPAIGN_CHANNEL_META } from './types';

// ─── SVG del logo (rayo doble) ────────────────────────────────
const LOGO_SVG = `<svg viewBox="0 0 375 375" xmlns="http://www.w3.org/2000/svg">
  <path fill="#f72c5b" d="M 122.25 237.644531 C 122.199219 237.644531 122.148438 237.628906 122.105469 237.601562 C 122.058594 237.578125 122.023438 237.539062 122 237.496094 C 121.972656 237.449219 121.960938 237.398438 121.957031 237.34375 C 121.957031 237.292969 121.96875 237.242188 121.996094 237.195312 L 173.234375 144.984375 C 173.273438 144.914062 173.273438 144.847656 173.234375 144.78125 C 173.195312 144.710938 173.136719 144.675781 173.054688 144.675781 L 124.335938 144.675781 C 124.164062 144.675781 124.039062 144.601562 123.953125 144.453125 C 123.871094 144.308594 123.871094 144.160156 123.960938 144.015625 L 152.363281 96.300781 C 152.585938 95.917969 152.921875 95.730469 153.359375 95.730469 L 252.277344 95.730469 C 252.300781 95.730469 252.328125 95.734375 252.351562 95.746094 C 252.949219 96.128906 252.9375 96.226562 252.878906 96.316406 C 222.839844 142.988281 192.269531 193.289062 165.96875 237.089844 C 165.746094 237.460938 165.421875 237.644531 164.992188 237.644531 Z"/>
  <path fill="#f72c5b" d="M 171.398438 237.335938 L 204.773438 183.78125 C 204.921875 183.539062 205.140625 183.421875 205.425781 183.421875 L 260.40625 183.421875 C 260.515625 183.417969 260.59375 183.464844 260.640625 183.558594 C 260.691406 183.652344 260.6875 183.746094 260.625 183.832031 C 245.023438 205.738281 224.308594 235.1875 198.480469 272.183594 C 184.175781 292.664062 168.128906 315.570312 151.492188 338.300781 C 151.425781 338.390625 151.339844 338.410156 151.242188 338.355469 C 151.144531 338.300781 151.113281 338.21875 151.15625 338.113281 C 163.5 305.546875 176.523438 272.203125 190.222656 238.085938 C 190.261719 237.988281 190.25 237.890625 190.191406 237.800781 C 190.128906 237.710938 190.046875 237.667969 189.9375 237.667969 L 171.578125 237.667969 C 171.496094 237.664062 171.433594 237.628906 171.394531 237.554688 C 171.351562 237.480469 171.355469 237.410156 171.398438 237.335938 Z"/>
</svg>`;

const LOGO_FOOTER = `<svg width="18" height="18" viewBox="0 0 375 375" xmlns="http://www.w3.org/2000/svg">
  <path fill="#f72c5b" d="M 122.25 237.644531 C 122.199219 237.644531 122.148438 237.628906 122.105469 237.601562 C 122.058594 237.578125 122.023438 237.539062 122 237.496094 C 121.972656 237.449219 121.960938 237.398438 121.957031 237.34375 C 121.957031 237.292969 121.96875 237.242188 121.996094 237.195312 L 173.234375 144.984375 C 173.273438 144.914062 173.273438 144.847656 173.234375 144.78125 C 173.195312 144.710938 173.136719 144.675781 173.054688 144.675781 L 124.335938 144.675781 C 124.164062 144.675781 124.039062 144.601562 123.953125 144.453125 C 123.871094 144.308594 123.871094 144.160156 123.960938 144.015625 L 152.363281 96.300781 C 152.585938 95.917969 152.921875 95.730469 153.359375 95.730469 L 252.277344 95.730469 C 252.300781 95.730469 252.328125 95.734375 252.351562 95.746094 C 252.949219 96.128906 252.9375 96.226562 252.878906 96.316406 C 222.839844 142.988281 192.269531 193.289062 165.96875 237.089844 C 165.746094 237.460938 165.421875 237.644531 164.992188 237.644531 Z"/>
  <path fill="#f72c5b" d="M 171.398438 237.335938 L 204.773438 183.78125 C 204.921875 183.539062 205.140625 183.421875 205.425781 183.421875 L 260.40625 183.421875 C 260.515625 183.417969 260.59375 183.464844 260.640625 183.558594 C 260.691406 183.652344 260.6875 183.746094 260.625 183.832031 C 245.023438 205.738281 224.308594 235.1875 198.480469 272.183594 C 184.175781 292.664062 168.128906 315.570312 151.492188 338.300781 C 151.425781 338.390625 151.339844 338.410156 151.242188 338.355469 C 151.144531 338.300781 151.113281 338.21875 151.15625 338.113281 C 163.5 305.546875 176.523438 272.203125 190.222656 238.085938 C 190.261719 237.988281 190.25 237.890625 190.191406 237.800781 C 190.128906 237.710938 190.046875 237.667969 189.9375 237.667969 L 171.578125 237.667969 C 171.496094 237.664062 171.433594 237.628906 171.394531 237.554688 C 171.351562 237.480469 171.355469 237.410156 171.398438 237.335938 Z"/>
</svg>`;

// ─── Helpers ──────────────────────────────────────────────────

function esc(s: string): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(): string {
  return new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' });
}

// Convierte una URL de imagen a base64 para que html2canvas pueda renderizarla
async function urlToBase64(url: string): Promise<string> {
  if (!url) return '';
  if (url.startsWith('data:')) return url;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
}

// Badge de rol con color
function roleBadge(rol: string): string {
  const rolColors: Record<string, string> = {
    'Teaser': 'badge-fucsia', 'Lanzamiento': 'badge-fucsia',
    'Beneficio': 'badge-lime', 'Confianza': 'badge-lime', 'Producto': 'badge-lime',
    'Conversión': 'badge-violet', 'Urgencia': 'badge-violet', 'Cierre': 'badge-violet',
  };
  const cls = rolColors[rol] ?? 'badge-fucsia';
  return `<span class="badge ${cls}">${esc(rol)}</span>`;
}

// Footer común de página
function pageFooter(pageNum: number | string): string {
  return `
    <div class="page-footer">
      <div style="display:flex;align-items:center;gap:8px">
        ${LOGO_FOOTER}
        <span style="font-family:var(--font-body);font-size:11px;font-weight:600;color:#64748b">Luz IA Studio</span>
      </div>
      <span class="footer-page">${pageNum.toString().padStart(2, '0')}</span>
    </div>
    <div class="accent-band"></div>`;
}

// ─── CSS completo (extraído del HTML aprobado) ────────────────
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
.toolbar-actions{display:flex;gap:10px;}
.btn-pdf{display:flex;align-items:center;gap:7px;background:var(--fucsia);color:var(--white);border:none;border-radius:8px;padding:8px 18px;font-family:var(--font-body);font-size:13px;font-weight:600;cursor:pointer;letter-spacing:0.03em;transition:background 0.18s;}
.btn-pdf:hover{background:var(--fucsia-hover);}
.btn-pdf svg{width:15px;height:15px;}
.btn-preview{background:transparent;color:rgba(255,255,255,0.6);border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:8px 16px;font-family:var(--font-body);font-size:13px;cursor:pointer;transition:all 0.18s;}
.btn-preview:hover{color:white;border-color:rgba(255,255,255,0.35);}
.canvas-wrap{padding:80px 24px 48px;display:flex;flex-direction:column;align-items:center;gap:20px;}
.page{width:794px;min-height:1122px;position:relative;overflow:hidden;box-shadow:0 8px 48px rgba(0,0,0,0.45);background:var(--white);page-break-after:always;flex-shrink:0;}
.page-label{position:absolute;top:-26px;left:0;font-family:var(--font-body);font-size:11px;font-weight:500;color:rgba(255,255,255,0.4);letter-spacing:0.08em;text-transform:uppercase;}
.section-header{background:var(--black);padding:22px 36px;display:flex;align-items:center;justify-content:space-between;}
.section-header-title{font-family:var(--font-title);font-size:13px;font-weight:700;letter-spacing:0.14em;color:var(--white);text-transform:uppercase;}
.section-header-badge{font-family:var(--font-body);font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:var(--fucsia);background:var(--fucsia-soft);border:1px solid rgba(247,44,91,0.3);padding:4px 10px;border-radius:100px;}
.page-body{padding:32px 36px 36px;}
.badge{display:inline-flex;align-items:center;gap:5px;font-family:var(--font-body);font-size:10px;font-weight:600;letter-spacing:0.10em;text-transform:uppercase;padding:5px 12px;border-radius:100px;}
.badge-fucsia{color:var(--fucsia);background:var(--fucsia-soft);border:1px solid rgba(247,44,91,0.25);}
.badge-lime{color:#4a6f06;background:var(--lime-soft);border:1px solid rgba(155,194,30,0.35);}
.badge-violet{color:var(--violet);background:var(--violet-soft);border:1px solid rgba(124,58,237,0.25);}
.badge-dark{color:var(--white);background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);}
.divider{height:1px;background:var(--border);margin:24px 0;}
.divider-fucsia{height:3px;background:var(--fucsia);margin:0;}
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
.cover-headline{font-family:var(--font-title);font-size:64px;font-weight:800;font-style:italic;text-transform:uppercase;line-height:0.95;letter-spacing:-0.02em;color:var(--white);margin-bottom:28px;}
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
/* STRATEGY */
.strategy-section{margin-bottom:28px;}
.strategy-label{font-family:var(--font-body);font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:var(--fucsia);margin-bottom:8px;}
.strategy-title{font-family:var(--font-title);font-size:22px;font-weight:800;color:var(--dark-text);margin-bottom:10px;line-height:1.2;}
.strategy-text{font-family:var(--font-body);font-size:14px;line-height:1.7;color:#475569;}
.channels-row{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;}
.channel-chip{display:flex;align-items:center;gap:7px;background:var(--slate);border:1px solid var(--border);border-radius:var(--r-sm);padding:9px 14px;font-family:var(--font-body);font-size:12px;font-weight:500;color:var(--dark-text);}
.channel-icon{font-size:15px;}
.exec-box{background:var(--black);border-radius:var(--r-lg);padding:26px 28px;display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:8px;}
.exec-item-label{font-family:var(--font-body);font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.4);margin-bottom:6px;}
.exec-item-value{font-family:var(--font-title);font-size:15px;font-weight:700;color:var(--white);line-height:1.3;}
.exec-item-value.accent{color:var(--fucsia);}
.exec-item-value.lime{color:var(--lime);}
/* CALENDAR */
.cal-check{flex-shrink:0;width:22px;height:22px;border:2px solid var(--border);border-radius:6px;background:var(--white);cursor:pointer;position:relative;transition:border-color 0.18s,background 0.18s;display:flex;align-items:center;justify-content:center;}
.cal-check:hover{border-color:var(--fucsia);}
.cal-check.done{background:var(--fucsia);border-color:var(--fucsia);}
.cal-check.done::after{content:'';display:block;width:5px;height:9px;border:2.5px solid white;border-top:none;border-left:none;transform:rotate(45deg) translate(-1px,-1px);}
.cal-row{display:flex;align-items:center;gap:14px;padding:14px 0;border-bottom:1px solid var(--border);}
.cal-row:last-child{border-bottom:none;}
.cal-row.featured{background:linear-gradient(to right,rgba(247,44,91,0.06),transparent);border-radius:var(--r-sm);padding:14px 12px;border:1px solid rgba(247,44,91,0.2);margin:-2px -2px 0;}
.cal-row.featured .cal-day-badge{background:var(--fucsia);color:var(--white);}
.cal-day-badge{min-width:48px;height:48px;background:var(--slate);border:1px solid var(--border);border-radius:var(--r-sm);display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0;}
.cal-day-num{font-family:var(--font-title);font-size:18px;font-weight:800;line-height:1;color:inherit;}
.cal-day-label{font-size:9px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:rgba(15,23,42,0.4);font-family:var(--font-body);}
.cal-row.featured .cal-day-num{color:var(--white);}
.cal-row.featured .cal-day-label{color:rgba(255,255,255,0.7);}
.cal-content{flex:1;}
.cal-canal{font-family:var(--font-body);font-size:10px;font-weight:600;letter-spacing:0.10em;text-transform:uppercase;color:#64748b;margin-bottom:3px;}
.cal-title{font-family:var(--font-title);font-size:14px;font-weight:700;color:var(--dark-text);line-height:1.3;}
.cal-right{display:flex;flex-direction:column;align-items:flex-end;gap:6px;}
.cal-time{font-family:var(--font-body);font-size:12px;font-weight:600;color:var(--fucsia);}
.cal-rest{font-family:var(--font-body);font-size:12px;font-style:italic;color:rgba(15,23,42,0.25);flex:1;}
/* PIECES */
.piece-layout{display:grid;grid-template-columns:45% 55%;gap:0;height:370px;margin-bottom:24px;border-radius:var(--r-lg);overflow:hidden;border:1px solid var(--border);}
.piece-img{background:linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#0f172a 100%);position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;}
.piece-img img{width:100%;height:100%;object-fit:cover;}
.piece-img-label{position:absolute;bottom:14px;left:14px;font-family:var(--font-body);font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.5);background:rgba(0,0,0,0.5);border-radius:100px;padding:4px 10px;}
.piece-info{padding:28px 26px;display:flex;flex-direction:column;justify-content:space-between;background:var(--white);}
.piece-meta{display:flex;align-items:center;gap:8px;margin-bottom:12px;}
.piece-headline{font-family:var(--font-title);font-size:20px;font-weight:800;color:var(--dark-text);line-height:1.2;margin-bottom:14px;}
.piece-cta{display:inline-flex;align-items:center;gap:7px;background:var(--fucsia);color:var(--white);font-family:var(--font-body);font-size:12px;font-weight:700;letter-spacing:0.05em;padding:10px 18px;border-radius:8px;text-decoration:none;width:fit-content;}
.piece-time{font-family:var(--font-body);font-size:13px;font-weight:600;color:rgba(15,23,42,0.4);}
.piece-caption-box{background:var(--slate);border:1px solid var(--border);border-radius:var(--r-md);padding:18px 20px;margin-bottom:20px;}
.piece-caption-label{font-family:var(--font-body);font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#64748b;margin-bottom:8px;}
.piece-caption-text{font-family:var(--font-body);font-size:13px;line-height:1.65;color:var(--dark-text);}
.hashtags-row{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:20px;}
.htag{font-family:var(--font-body);font-size:11px;font-weight:600;padding:5px 11px;border-radius:100px;cursor:pointer;transition:opacity 0.15s;}
.htag:hover{opacity:0.75;}
.htag-fucsia{background:var(--fucsia-soft);color:var(--fucsia);border:1px solid rgba(247,44,91,0.25);}
.htag-violet{background:var(--violet-soft);color:var(--violet);border:1px solid rgba(124,58,237,0.25);}
.htag-lime{background:var(--lime-soft);color:#4a6f06;border:1px solid rgba(155,194,30,0.35);}
.piece-qhbox{background:var(--yellow);border:1px solid #fde68a;border-radius:var(--r-md);padding:16px 20px;}
.piece-qhbox-title{font-family:var(--font-body);font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#92400e;margin-bottom:7px;}
.piece-qhbox-text{font-family:var(--font-body);font-size:13px;line-height:1.6;color:#78350f;}
/* HASHTAGS PAGE */
.htag-group{margin-bottom:28px;}
.htag-group-header{display:flex;align-items:center;gap:12px;margin-bottom:12px;}
.htag-group-icon{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;}
.htag-group-title{font-family:var(--font-title);font-size:16px;font-weight:800;color:var(--dark-text);}
.htag-group-desc{font-family:var(--font-body);font-size:12px;color:#64748b;line-height:1.5;margin-bottom:12px;}
.htag-group-bg{border-radius:var(--r-md);padding:16px 18px;display:flex;flex-wrap:wrap;gap:8px;}
.htag-group-bg.fucsia-bg{background:rgba(247,44,91,0.07);border:1px solid rgba(247,44,91,0.18);}
.htag-group-bg.violet-bg{background:rgba(124,58,237,0.07);border:1px solid rgba(124,58,237,0.18);}
.htag-group-bg.lime-bg{background:rgba(228,241,172,0.5);border:1px solid rgba(155,194,30,0.35);}
@media print{body{background:white;}.toolbar{display:none;}.canvas-wrap{padding:0;gap:0;}.page{box-shadow:none;page-break-after:always;}.page-label{display:none;}}
</style>`;

// ─── Generadores de páginas HTML ──────────────────────────────

function buildCoverPage(set: CampaignSet): string {
  const { plan } = set;
  const canalesLabels = set.canales.map(c => CAMPAIGN_CHANNEL_META[c].label).join(' · ');
  const taglineWords = plan.tagline.split(' ');
  const mid = Math.ceil(taglineWords.length / 2);
  const line1 = taglineWords.slice(0, mid).join(' ');
  const line2 = taglineWords.slice(mid).join(' ');

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
        <div class="cover-kit-badge">Kit de Campaña</div>
      </div>
      <div class="cover-main">
        <div class="cover-eyebrow">Campaña Generativa · ${formatDate()}</div>
        <div class="cover-headline">
          ${esc(line1)}<br><em>${esc(line2)}</em>
        </div>
        <div class="cover-concept">${esc(plan.concepto)}</div>
        <div class="cover-line"></div>
        <div class="cover-promise">"${esc(plan.promesa)}"</div>
        <div class="cover-stats">
          <div class="stat-chip">
            <div class="stat-num">${plan.piezas.length}</div>
            <div class="stat-label">Piezas únicas</div>
          </div>
          <div class="stat-chip">
            <div class="stat-num">${set.canales.length}</div>
            <div class="stat-label">Canales activos</div>
          </div>
          <div class="stat-chip">
            <div class="stat-num">${plan.duracionDias}</div>
            <div class="stat-label">Días de campaña</div>
          </div>
        </div>
        <div class="cover-box">
          <div class="cover-box-title">¿Qué hacer con este kit?</div>
          <ul>
            <li>Seguí el calendario día a día — publicá cada pieza en el canal indicado</li>
            <li>Copiá el caption sugerido de cada pieza tal como está</li>
            <li>Leé las instrucciones "Qué hacer" antes de publicar cada día</li>
            <li>Usá los hashtags del banco de la última página, rotando entre grupos</li>
          </ul>
        </div>
      </div>
      <div class="cover-footer">
        <div class="cover-footer-inner">
          <span style="font-family:var(--font-body);font-size:11px;color:rgba(255,255,255,0.35)">
            ${set.userName ? `Creado por ${esc(set.userName)} · ` : ''}Luz IA Studio · ${formatDate()}
          </span>
          <span style="font-family:var(--font-body);font-size:11px;color:rgba(255,255,255,0.25)">${canalesLabels}</span>
        </div>
        <div class="accent-band"></div>
      </div>
    </div>
  </div>`;
}

function buildStrategyPage(set: CampaignSet): string {
  const { plan } = set;
  const canalesChips = set.canales.map(c => {
    const m = CAMPAIGN_CHANNEL_META[c];
    return `<div class="channel-chip"><span class="channel-icon">${m.icon}</span> ${esc(m.label)}</div>`;
  }).join('');

  // Ancla visual y referencias del brief en columna derecha
  const anchorSrc = set.anchorImage || '';
  const anchorBlock = anchorSrc ? `
    <div style="margin-bottom:20px">
      <div class="strategy-label" style="margin-bottom:10px">Ancla Visual de Campaña</div>
      <div style="position:relative;display:inline-block">
        <img src="${anchorSrc}" style="width:160px;height:213px;object-fit:cover;border-radius:12px;border:2px solid var(--fucsia);display:block" />
        <div style="position:absolute;top:8px;left:8px;background:var(--fucsia);color:white;font-family:var(--font-body);font-size:9px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;padding:3px 8px;border-radius:100px">Ancla elegida</div>
      </div>
      <p style="font-family:var(--font-body);font-size:11px;color:#64748b;margin-top:8px;line-height:1.5;max-width:160px">Define la luz, paleta y estética de toda la campaña</p>
    </div>` : '';

  // Miniaturas de referencia por rol
  const slotGroups = (['product','inspiration','brand','model'] as const)
    .map(role => {
      const roleSlots = set.slots.filter(s => s.role === role).slice(0,2);
      if (roleSlots.length === 0) return '';
      const labels: Record<string, string> = { product: '📦 Producto', inspiration: '🖼️ Inspiración', brand: '🎨 Marca', model: '👤 Modelo' };
      const thumbs = roleSlots.map(s =>
        `<img src="${s.base64}" style="width:44px;height:44px;object-fit:cover;border-radius:6px;border:1px solid var(--border);flex-shrink:0" />`
      ).join('');
      return `
        <div style="margin-bottom:12px">
          <div style="font-family:var(--font-body);font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#64748b;margin-bottom:5px">${labels[role]}</div>
          <div style="display:flex;gap:5px;flex-wrap:wrap">${thumbs}</div>
        </div>`;
    }).join('');

  const refsBlock = (anchorBlock || slotGroups) ? `
    <div style="width:180px;flex-shrink:0">
      ${anchorBlock}
      ${slotGroups ? `<div class="strategy-label" style="margin-bottom:10px">Imágenes de brief</div>${slotGroups}` : ''}
    </div>` : '';

  return `
  <div class="page-label">Página 2 · Estrategia</div>
  <div class="page" id="page-2">
    <div class="section-header">
      <span class="section-header-title">Estrategia de Campaña</span>
      <span class="section-header-badge">Visión general</span>
    </div>
    <div class="page-body">
      <div style="display:flex;gap:24px;align-items:flex-start">
        <div style="flex:1;min-width:0">
          <div class="strategy-section">
            <div class="strategy-label">Concepto Creativo</div>
            <div class="strategy-title">${esc(plan.tagline)}</div>
            <div class="strategy-text">${esc(plan.concepto)}</div>
          </div>
          <div class="divider"></div>
          <div class="strategy-section">
            <div class="strategy-label">Promesa de Campaña</div>
            <div class="strategy-title">"${esc(plan.promesa)}"</div>
            <div class="strategy-text">${esc(plan.resumen)}</div>
          </div>
          <div class="divider"></div>
          <div class="strategy-section">
            <div class="strategy-label">Canales Seleccionados</div>
            <div class="channels-row">${canalesChips}</div>
          </div>
          <div class="divider"></div>
          <div class="strategy-label" style="margin-bottom:12px">Resumen Ejecutivo</div>
          <div class="exec-box">
            <div class="exec-item">
              <div class="exec-item-label">Piezas generadas</div>
              <div class="exec-item-value accent">${plan.piezas.length} imágenes + copy</div>
            </div>
            <div class="exec-item">
              <div class="exec-item-label">Duración</div>
              <div class="exec-item-value">${plan.duracionDias} días de campaña</div>
            </div>
            <div class="exec-item">
              <div class="exec-item-label">Frecuencia</div>
              <div class="exec-item-value lime">1–2 piezas por día</div>
            </div>
            <div class="exec-item">
              <div class="exec-item-label">Canales</div>
              <div class="exec-item-value">${set.canales.length} canal${set.canales.length > 1 ? 'es' : ''} activo${set.canales.length > 1 ? 's' : ''}</div>
            </div>
          </div>
        </div>
        ${refsBlock}
      </div>
    </div>
    ${pageFooter(2)}
  </div>`;
}

function buildCalendarPage(set: CampaignSet): string {
  const { plan } = set;
  const dias = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

  let rows = '';
  for (let d = 1; d <= plan.duracionDias; d++) {
    const piezasDelDia = plan.piezas.filter(p => p.dia === d);
    const diaLabel = dias[d - 1] ?? `D${d}`;
    const featured = d === 1 ? 'featured' : '';

    if (piezasDelDia.length === 0) {
      rows += `
        <div class="cal-row">
          <div class="cal-check" onclick="toggleCheck(this)"></div>
          <div class="cal-day-badge" style="opacity:0.4">
            <div class="cal-day-num">${d}</div>
            <div class="cal-day-label">${diaLabel}</div>
          </div>
          <span class="cal-rest">— Descanso —</span>
          <div class="cal-right"></div>
        </div>`;
    } else {
      piezasDelDia.forEach(p => {
        const canalMeta = CAMPAIGN_CHANNEL_META[p.canal];
        rows += `
          <div class="cal-row ${featured}">
            <div class="cal-check" onclick="toggleCheck(this)"></div>
            <div class="cal-day-badge">
              <div class="cal-day-num">${d}</div>
              <div class="cal-day-label">${diaLabel}</div>
            </div>
            <div class="cal-content">
              <div class="cal-canal">${canalMeta.icon} ${esc(canalMeta.label)} · ${esc(p.rol)}</div>
              <div class="cal-title">${esc(p.titular)}</div>
            </div>
            <div class="cal-right">
              ${roleBadge(p.rol)}
              <span class="cal-time">${esc(p.horaRecomendada)}</span>
            </div>
          </div>`;
      });
    }
  }

  return `
  <div class="page-label">Página 3 · Calendario</div>
  <div class="page" id="page-3">
    <div class="section-header">
      <span class="section-header-title">Calendario de Publicación — ${plan.duracionDias} Días</span>
      <span class="section-header-badge">Semana 1</span>
    </div>
    <div class="page-body">${rows}</div>
    ${pageFooter(3)}
  </div>`;
}

function buildPiecePage(pieza: CampaignPiece, index: number, total: number, imageBase64: string): string {
  const canalMeta = CAMPAIGN_CHANNEL_META[pieza.canal];
  const pageNum = index + 4;
  const hashtagsHtml = pieza.hashtags.map((h, i) => {
    const cls = i % 3 === 0 ? 'htag-fucsia' : i % 3 === 1 ? 'htag-violet' : 'htag-lime';
    return `<span class="htag ${cls}" onclick="copyTag(this)">${esc(h.startsWith('#') ? h : '#' + h)}</span>`;
  }).join('');

  const imgContent = imageBase64
    ? `<img src="${imageBase64}" alt="${esc(pieza.rol)}" />`
    : `<svg style="width:80px;height:80px;opacity:0.15" viewBox="0 0 375 375" xmlns="http://www.w3.org/2000/svg">
        <path fill="rgba(247,44,91,0.6)" d="M 122.25 237.644531 L 173.234375 144.984375 C 173.273438 144.914062 173.234375 144.78125 173.054688 144.675781 L 124.335938 144.675781 C 123.871094 144.308594 123.871094 144.160156 123.960938 144.015625 L 152.363281 96.300781 C 152.585938 95.917969 153.359375 95.730469 L 252.277344 95.730469 C 252.878906 96.316406 C 222.839844 142.988281 165.96875 237.089844 C 165.746094 237.460938 164.992188 237.644531 Z"/>
      </svg>
      <div class="piece-img-label">Imagen generada por IA</div>`;

  return `
  <div class="page-label">Página ${pageNum} · Pieza ${index + 1} — Día ${pieza.dia} · ${canalMeta.label}</div>
  <div class="page" id="page-${pageNum}">
    <div class="section-header">
      <span class="section-header-title">Pieza ${index + 1} · Día ${pieza.dia} · ${esc(canalMeta.label)}</span>
      <span class="section-header-badge">${esc(pieza.rol)}</span>
    </div>
    <div class="page-body">
      <div class="piece-layout">
        <div class="piece-img">${imgContent}</div>
        <div class="piece-info">
          <div>
            <div class="piece-meta">
              ${roleBadge(pieza.rol)}
              <span class="badge" style="background:rgba(15,23,42,0.06);color:#64748b;border:1px solid var(--border)">Día ${pieza.dia}</span>
              <span class="badge" style="background:rgba(15,23,42,0.06);color:#64748b;border:1px solid var(--border)">${index + 1}/${total}</span>
            </div>
            <div class="piece-headline">${esc(pieza.titular)}</div>
            <div class="piece-cta">${esc(pieza.cta)} →</div>
          </div>
          <div class="piece-time">🕐 ${esc(pieza.horaRecomendada)}</div>
        </div>
      </div>
      <div class="piece-caption-box">
        <div class="piece-caption-label">Caption sugerido · ${esc(canalMeta.label)}</div>
        <div class="piece-caption-text">${esc(pieza.caption)}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-family:var(--font-body);font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#64748b">Hashtags</span>
      </div>
      <div class="hashtags-row">${hashtagsHtml}</div>
      <div class="piece-qhbox">
        <div class="piece-qhbox-title">📌 Qué hacer hoy</div>
        <div class="piece-qhbox-text">${esc(pieza.instruccion)}</div>
      </div>

      <details style="margin-top:16px">
        <summary style="font-family:var(--font-body);font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#94a3b8;cursor:pointer;list-style:none;display:flex;align-items:center;gap:6px;user-select:none">
          <span style="font-size:9px">▶</span> Ver prompt de imagen (para usar en Prompt Studio)
        </summary>
        <div style="margin-top:8px;background:#f1f5f9;border:1px solid var(--border);border-radius:var(--r-sm);padding:14px 16px;position:relative">
          <div style="font-family:monospace;font-size:11px;line-height:1.6;color:#475569;white-space:pre-wrap;word-break:break-word">${esc(pieza.imagePrompt)}</div>
          <button onclick="copyPrompt(this)" data-prompt="${esc(pieza.imagePrompt)}"
            style="position:absolute;top:10px;right:10px;background:var(--fucsia);color:white;border:none;border-radius:6px;padding:4px 10px;font-family:var(--font-body);font-size:10px;font-weight:600;cursor:pointer;letter-spacing:0.05em">
            Copiar
          </button>
        </div>
      </details>
    </div>
    ${pageFooter(pageNum)}
  </div>`;
}

function buildHashtagsPage(set: CampaignSet, pageNum: number): string {
  const { plan } = set;

  const buildTags = (tags: string[], cls: string) =>
    tags.map(t => `<span class="htag ${cls}" onclick="copyTag(this)">${esc(t.startsWith('#') ? t : '#' + t)}</span>`).join('');

  return `
  <div class="page-label">Última página · Banco de Hashtags</div>
  <div class="page" id="page-last">
    <div class="section-header">
      <span class="section-header-title">Banco de Hashtags</span>
      <span class="section-header-badge">Estrategia de alcance</span>
    </div>
    <div class="page-body">
      <p style="font-family:var(--font-body);font-size:13px;color:#64748b;line-height:1.65;margin-bottom:24px">
        Usá los hashtags en 3 grupos distintos. <strong>Nunca uses los 3 grupos juntos</strong> en una sola publicación.
        Rotá entre grupos según el canal y el objetivo de cada pieza. Hacé clic en cualquier hashtag para copiarlo.
      </p>
      <div class="htag-group">
        <div class="htag-group-header">
          <div class="htag-group-icon" style="background:var(--fucsia-soft)">🔥</div>
          <div class="htag-group-title">Comunidad</div>
        </div>
        <div class="htag-group-desc">Alta visibilidad. Usá 2–3 en cada post para construir presencia a largo plazo.</div>
        <div class="htag-group-bg fucsia-bg">${buildTags(plan.hashtagsComunidad, 'htag-fucsia')}</div>
      </div>
      <div class="htag-group">
        <div class="htag-group-header">
          <div class="htag-group-icon" style="background:var(--violet-soft)">⚡</div>
          <div class="htag-group-title">Nicho</div>
        </div>
        <div class="htag-group-desc">Conectan con personas que ya buscan lo que vendés. Incluí todos en cada post.</div>
        <div class="htag-group-bg violet-bg">${buildTags(plan.hashtagsNicho, 'htag-violet')}</div>
      </div>
      <div class="htag-group">
        <div class="htag-group-header">
          <div class="htag-group-icon" style="background:var(--lime-soft)">🌱</div>
          <div class="htag-group-title">Cola larga</div>
        </div>
        <div class="htag-group-desc">Menor competencia, mayor intención de compra. Tus mejores aliados para vender.</div>
        <div class="htag-group-bg lime-bg">${buildTags(plan.hashtagsColarga, 'htag-lime')}</div>
      </div>
    </div>
    <div class="page-footer">
      <div style="display:flex;align-items:center;gap:8px">
        ${LOGO_FOOTER}
        <span style="font-family:var(--font-body);font-size:11px;font-weight:600;color:#64748b">Luz IA Studio</span>
      </div>
      <span style="font-family:var(--font-body);font-size:11px;color:#94a3b8">Hacé clic en cualquier hashtag para copiarlo al portapapeles</span>
    </div>
    <div class="accent-band"></div>
  </div>`;
}

// ─── Página de configuración / brief / prompts ───────────────

const SLOT_LABEL: Record<ImageSlotRole, string> = {
  product:     '📦 Producto',
  inspiration: '🖼️ Inspiración',
  brand:       '🎨 Marca',
  model:       '👤 Modelo',
};

const SLOT_ORDER: ImageSlotRole[] = ['product', 'inspiration', 'brand', 'model'];

function buildConfigPage(set: CampaignSet, pageNum: number): string {
  const { plan } = set;
  const canalesLabels = set.canales.map(c => CAMPAIGN_CHANNEL_META[c].label).join(', ');

  const piezasRows = plan.piezas.map((p, i) => `
    <tr style="border-bottom:1px solid var(--border)">
      <td style="padding:10px 12px;font-family:var(--font-body);font-size:11px;font-weight:700;color:var(--dark-text);white-space:nowrap">Pieza ${i + 1} · Día ${p.dia}</td>
      <td style="padding:10px 12px;font-family:var(--font-body);font-size:11px;color:#64748b">${esc(p.rol)} · ${esc(CAMPAIGN_CHANNEL_META[p.canal]?.label ?? p.canal)}</td>
      <td style="padding:10px 12px;font-family:monospace;font-size:10px;color:#475569;line-height:1.5">${esc(p.imagePrompt)}</td>
    </tr>`).join('');

  // ── Referencias visuales por slot ──────────────────────────
  const slotsByRole = SLOT_ORDER.reduce<Record<ImageSlotRole, string[]>>((acc, role) => {
    acc[role] = set.slots.filter(s => s.role === role).map(s => s.base64);
    return acc;
  }, { product: [], inspiration: [], brand: [], model: [] });

  const refThumb = (src: string) =>
    `<img src="${src}" style="width:72px;height:72px;object-fit:cover;border-radius:8px;border:1px solid var(--border);flex-shrink:0" />`;

  const refGroups = SLOT_ORDER
    .filter(role => slotsByRole[role].length > 0)
    .map(role => {
      const thumbs = slotsByRole[role].map(refThumb).join('');
      return `
        <div style="margin-bottom:16px">
          <div style="font-family:var(--font-body);font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#64748b;margin-bottom:8px">${SLOT_LABEL[role]} · ${slotsByRole[role].length} imagen${slotsByRole[role].length > 1 ? 'es' : ''}</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px">${thumbs}</div>
        </div>`;
    }).join('');

  // ── Ancla elegida ──────────────────────────────────────────
  const anchorSrc = set.anchorImage || '';
  const anchorHtml = anchorSrc ? `
    <div style="margin-bottom:24px">
      <div class="strategy-label">Ancla visual elegida</div>
      <div style="display:flex;align-items:flex-start;gap:16px;background:var(--slate);border:1px solid var(--border);border-radius:var(--r-md);padding:16px">
        <img src="${anchorSrc}" style="width:120px;height:160px;object-fit:cover;border-radius:10px;border:2px solid var(--fucsia);flex-shrink:0" />
        <div>
          <div style="font-family:var(--font-body);font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--fucsia);margin-bottom:6px">REF0 · Estilo de sesión</div>
          <p style="font-family:var(--font-body);font-size:12px;color:#475569;line-height:1.6;margin:0">Esta imagen define la luz, la paleta de colores y la estética de toda la campaña. Todas las piezas se generaron tomándola como referencia de sesión.</p>
          ${set.plan.textoEnImagenes && set.plan.textoEnImagenes !== 'none' ? `
          <div style="margin-top:10px;background:white;border:1px solid var(--border);border-radius:8px;padding:10px 12px">
            <div style="font-family:var(--font-body);font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#64748b;margin-bottom:4px">Texto en imágenes</div>
            <div style="font-family:var(--font-body);font-size:12px;font-weight:600;color:var(--dark-text)">${esc(set.plan.textoEnImagenes)}</div>
            ${set.plan.estiloTexto ? `<div style="font-family:monospace;font-size:10px;color:#64748b;margin-top:2px">${esc(set.plan.estiloTexto)}</div>` : ''}
          </div>` : ''}
        </div>
      </div>
    </div>` : '';

  // ── También mostrar las 2 opciones de ancla si están disponibles ──
  const anchorOptionsHtml = (set.anchorOptions?.length ?? 0) > 0 ? `
    <div style="margin-bottom:24px">
      <div class="strategy-label">Opciones de ancla generadas</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        ${set.anchorOptions.map((src, idx) => `
          <div style="position:relative">
            <img src="${src}" style="width:110px;height:146px;object-fit:cover;border-radius:10px;border:${src === anchorSrc ? '2px solid var(--fucsia)' : '1px solid var(--border)'}" />
            ${src === anchorSrc
              ? `<div style="position:absolute;top:6px;left:6px;background:var(--fucsia);color:white;font-family:var(--font-body);font-size:9px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;padding:3px 7px;border-radius:100px">Elegida</div>`
              : `<div style="position:absolute;top:6px;left:6px;background:rgba(0,0,0,0.55);color:rgba(255,255,255,0.7);font-family:var(--font-body);font-size:9px;font-weight:600;letter-spacing:0.06em;padding:3px 7px;border-radius:100px">Opción ${idx + 1}</div>`}
          </div>`).join('')}
      </div>
    </div>` : '';

  return `
  <div class="page-label">Última página · Configuración y Brief</div>
  <div class="page" id="page-config">
    <div class="section-header">
      <span class="section-header-title">Configuración de Campaña</span>
      <span class="section-header-badge">Registro completo</span>
    </div>
    <div class="page-body" style="padding-bottom:80px">

      <!-- Brief original -->
      <div style="margin-bottom:24px">
        <div class="strategy-label">Brief original</div>
        <div style="background:var(--slate);border:1px solid var(--border);border-radius:var(--r-md);padding:16px 18px">
          <p style="font-family:var(--font-body);font-size:13px;line-height:1.7;color:var(--dark-text)">${esc(set.idea)}</p>
        </div>
      </div>

      <!-- Configuración -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
        <div style="background:var(--black);border-radius:var(--r-md);padding:16px 18px">
          <div style="font-family:var(--font-body);font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.4);margin-bottom:6px">Canales</div>
          <div style="font-family:var(--font-title);font-size:13px;font-weight:700;color:var(--white)">${esc(canalesLabels)}</div>
        </div>
        <div style="background:var(--black);border-radius:var(--r-md);padding:16px 18px">
          <div style="font-family:var(--font-body);font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.4);margin-bottom:6px">Imágenes generadas</div>
          <div style="font-family:var(--font-title);font-size:13px;font-weight:700;color:var(--fucsia)">${plan.piezas.length} piezas de campaña</div>
        </div>
        <div style="background:var(--black);border-radius:var(--r-md);padding:16px 18px">
          <div style="font-family:var(--font-body);font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.4);margin-bottom:6px">Concepto creativo</div>
          <div style="font-family:var(--font-title);font-size:13px;font-weight:700;color:var(--white)">${esc(plan.concepto)}</div>
        </div>
        <div style="background:var(--black);border-radius:var(--r-md);padding:16px 18px">
          <div style="font-family:var(--font-body);font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.4);margin-bottom:6px">Referencias subidas</div>
          <div style="font-family:var(--font-title);font-size:13px;font-weight:700;color:var(--lime)">${set.slots.length} imágenes (${[...new Set(set.slots.map(s => s.role))].join(', ')})</div>
        </div>
      </div>

      <!-- Referencias visuales por slot -->
      ${refGroups ? `
      <div style="margin-bottom:24px">
        <div class="strategy-label">Imágenes de referencia por categoría</div>
        <div style="background:var(--slate);border:1px solid var(--border);border-radius:var(--r-md);padding:16px 18px">
          ${refGroups}
        </div>
      </div>` : ''}

      <!-- Ancla elegida + opciones -->
      ${anchorHtml}
      ${anchorOptionsHtml}

      <!-- Tabla de prompts -->
      <div style="margin-bottom:24px">
        <div class="strategy-label">Prompts usados por pieza</div>
        <div style="background:var(--white);border:1px solid var(--border);border-radius:var(--r-md);overflow:hidden">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="background:var(--slate);border-bottom:2px solid var(--border)">
                <th style="padding:10px 12px;font-family:var(--font-body);font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;text-align:left;white-space:nowrap">Pieza</th>
                <th style="padding:10px 12px;font-family:var(--font-body);font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;text-align:left">Rol · Canal</th>
                <th style="padding:10px 12px;font-family:var(--font-body);font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;text-align:left">Prompt de imagen</th>
              </tr>
            </thead>
            <tbody>${piezasRows}</tbody>
          </table>
        </div>
      </div>

      ${set.userName ? `<p style="font-family:var(--font-body);font-size:11px;color:#94a3b8">Creado por ${esc(set.userName)} · ${formatDate()}</p>` : ''}
    </div>
    ${pageFooter(pageNum)}
  </div>`;
}

// ─── Construye el HTML completo ───────────────────────────────

// Comprime un data URL a un tamaño máximo para el HTML (evita archivos >50MB)
async function compressForHtml(src: string, maxPx = 600, quality = 0.72): Promise<string> {
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

async function buildHtml(set: CampaignSet): Promise<string> {
  // Comprimir imágenes de piezas para el HTML (calidad suficiente para pantalla)
  const base64Images = await Promise.all(
    set.plan.piezas.map(p => compressForHtml(p.imageUrl, 800, 0.80))
  );

  // Comprimir imágenes de referencia (solo para la página de config)
  const compressedSlots = await Promise.all(
    set.slots.map(async s => ({ ...s, base64: await compressForHtml(s.base64, 200, 0.70) }))
  );
  const compressedAnchor        = await compressForHtml(set.anchorImage, 300, 0.75);
  const compressedAnchorOptions = await Promise.all(
    (set.anchorOptions ?? []).map(a => compressForHtml(a, 300, 0.75))
  );
  const setForConfig: typeof set = {
    ...set,
    slots:         compressedSlots,
    anchorImage:   compressedAnchor,
    anchorOptions: compressedAnchorOptions,
  };

  const lastPageNum = set.plan.piezas.length + 5;
  const pages = [
    buildCoverPage(set),
    buildStrategyPage(setForConfig),
    buildCalendarPage(set),
    ...set.plan.piezas.map((p, i) =>
      buildPiecePage(p, i, set.plan.piezas.length, base64Images[i])
    ),
    buildHashtagsPage(set, set.plan.piezas.length + 4),
    buildConfigPage(setForConfig, lastPageNum),
  ].join('\n');

  const campaignTitle = esc(set.plan.tagline || 'Kit de Campaña');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${campaignTitle} — Luz IA Studio</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
<script src="https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
<script src="https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js"></script>
${CSS}
</head>
<body>

<div class="toolbar">
  <div class="toolbar-logo">
    ${LOGO_SVG.replace('viewBox', 'width="28" height="28" viewBox')}
    <span class="toolbar-brand">Luz <span>IA</span> Studio</span>
  </div>
  <div class="toolbar-actions">
    <button class="btn-preview" onclick="window.print()">🖨 Imprimir</button>
    <button class="btn-pdf" onclick="exportPDF()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M12 16V8m0 8-3-3m3 3 3-3M20 20H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2Z"/>
      </svg>
      Exportar PDF
    </button>
  </div>
</div>

<div class="canvas-wrap" id="kit-canvas">
${pages}
</div>

<div id="toast" style="position:fixed;bottom:28px;left:50%;transform:translateX(-50%) translateY(20px);background:var(--black);color:white;padding:10px 20px;border-radius:100px;font-family:var(--font-body);font-size:13px;font-weight:500;border:1px solid rgba(247,44,91,0.4);opacity:0;transition:all 0.25s;pointer-events:none;z-index:9999;">✓ Copiado al portapapeles</div>

<script>
// ── Persistencia de checkboxes con localStorage ──────────────
const STORAGE_KEY = 'luzIA_campaign_checks_${set.id}';

function saveChecks() {
  const checks = {};
  document.querySelectorAll('.cal-check').forEach((el, i) => {
    checks[i] = el.classList.contains('done');
  });
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(checks)); } catch(e) {}
}

function loadChecks() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    const checks = JSON.parse(saved);
    document.querySelectorAll('.cal-check').forEach((el, i) => {
      if (checks[i]) {
        el.classList.add('done');
        const row = el.closest('.cal-row');
        if (row) row.style.opacity = '0.55';
      }
    });
  } catch(e) {}
}

function toggleCheck(el) {
  el.classList.toggle('done');
  const row = el.closest('.cal-row');
  if (el.classList.contains('done')) row.style.opacity = '0.55';
  else row.style.opacity = '';
  saveChecks();
}

// Cargar estado guardado al abrir el archivo
document.addEventListener('DOMContentLoaded', loadChecks);

// ── Copiar hashtag ────────────────────────────────────────────
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = '✓ ' + msg;
  toast.style.opacity = '1';
  toast.style.transform = 'translateX(-50%) translateY(0)';
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(20px)';
  }, 2000);
}

function copyTag(el) {
  const text = el.textContent.trim();
  navigator.clipboard.writeText(text).then(() => showToast(text + ' copiado'));
}

function copyPrompt(el) {
  const text = el.dataset.prompt || '';
  navigator.clipboard.writeText(text).then(() => {
    showToast('Prompt copiado — pegalo en Prompt Studio');
    el.textContent = '✓ Copiado';
    setTimeout(() => { el.textContent = 'Copiar'; }, 2000);
  });
}

// ── Exportar PDF ──────────────────────────────────────────────
async function exportPDF() {
  const btn = document.querySelector('.btn-pdf');
  btn.textContent = '⏳ Generando PDF...';
  btn.disabled = true;
  try {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pages = document.querySelectorAll('.page');
    for (let i = 0; i < pages.length; i++) {
      const canvas = await html2canvas(pages[i], {
        scale: 2, useCORS: true, backgroundColor: null,
        logging: false, width: 794, height: pages[i].offsetHeight
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const ratio = pages[i].offsetHeight / 794;
      if (i > 0) pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, 0, 210, 210 * ratio);
    }
    pdf.save('${campaignTitle.replace(/[^a-zA-Z0-9]/g, '-')}.pdf');
  } catch(e) {
    console.error(e);
    alert('Error al generar PDF. Usá el botón Imprimir como alternativa.');
  }
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:15px;height:15px"><path d="M12 16V8m0 8-3-3m3 3 3-3M20 20H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2Z"/></svg> Exportar PDF';
  btn.disabled = false;
}
</script>
</body>
</html>`;
}

// ─── Exports públicos ─────────────────────────────────────────

export async function downloadCampaignHtml(set: CampaignSet, filename?: string): Promise<void> {
  const html = await buildHtml(set);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename ?? `kit-campaña-${set.id.slice(-6)}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

async function ensurePdfLibs(): Promise<{ jsPDF: any; html2canvas: any }> {
  return { jsPDF: jsPDFLib, html2canvas: html2canvasLib };
}

export async function downloadCampaignPdf(set: CampaignSet, filename?: string): Promise<void> {
  const { jsPDF, html2canvas } = await ensurePdfLibs();

  // Renderizar en un iframe oculto para que el CSS y las fuentes se apliquen correctamente
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;height:1122px;border:none;visibility:hidden;';
  document.body.appendChild(iframe);

  try {
    const html = await buildHtml(set);

    // Escribir el HTML completo en el iframe — así <style> y Google Fonts se cargan bien
    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(html);
    doc.close();

    // Esperar a que el iframe termine de renderizar (fuentes + layout)
    await new Promise(r => setTimeout(r, 2000));

    const pages = doc.querySelectorAll('.page');
    if (!pages.length) throw new Error('No se encontraron páginas en el HTML generado');

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i] as HTMLElement;
      const pageHeight = page.scrollHeight || page.offsetHeight || 1122;

      const canvas = await html2canvas(page, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: 794,
        height: pageHeight,
        windowWidth: 794,
        scrollX: 0,
        scrollY: 0,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      const ratio   = pageHeight / 794;
      if (i > 0) pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, 0, 210, 210 * ratio);
    }

    const safeName = (set.plan.tagline || 'campaña').replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s]/g, '').trim();
    pdf.save(filename ?? `Kit-${safeName}.pdf`);
  } finally {
    document.body.removeChild(iframe);
  }
}
