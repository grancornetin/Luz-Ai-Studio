// QA1: capturas y mediciones móviles de las pantallas de Mi negocio (datos de ejemplo, sin login).
// Requiere el servidor de vista previa (vite.qa.config.ts) en el puerto 5198 y playwright ya instalado en el equipo:
//   QA_PW=<ruta a node_modules/playwright> node scripts/piloto-spikes/qa1/shots.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const pw = require(process.env.QA_PW || 'C:/Users/Nico Trabajo/Downloads/Cotizador/.local/qa/node_modules/playwright');
const BASE = 'http://localhost:5198';
const OUT = path.resolve('CIERRE_MVP/informes/qa1');
fs.mkdirSync(OUT, { recursive: true });

const SIZES = [{ w: 375, h: 812 }, { w: 390, h: 844 }];
// [archivo, ruta, estado]
const SCREENS = [
  ['hoy-listo', '/mi-negocio', 'ready'],
  ['hoy-generando', '/mi-negocio', 'generating'],
  ['hoy-tope', '/mi-negocio', 'budget'],
  ['hoy-sin-marca', '/mi-negocio', 'empty-brand'],
  ['hoy-sin-catalogo', '/mi-negocio', 'empty-catalog'],
  ['hoy-sin-plan', '/mi-negocio', 'empty-plan'],
  ['hoy-error', '/mi-negocio', 'error'],
  ['hoy-texto-largo', '/mi-negocio', 'long'],
  ['hoy-semana-lista', '/mi-negocio', 'done'],
  ['catalogo-lista', '/mi-negocio/catalogo', 'ready'],
  ['catalogo-vacio', '/mi-negocio/catalogo', 'empty-catalog'],
  ['catalogo-error', '/mi-negocio/catalogo', 'error'],
  ['marca-intro', '/mi-negocio/marca', 'ready'],
];

const browser = await pw.chromium.launch();
const report = [];
for (const size of SIZES) {
  for (const [name, route, state] of SCREENS) {
    const ctx = await browser.newContext({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    // La app real llama al servidor de texto; aquí se simula que NO responde (prueba el respaldo)
    await page.route('**/api/**', r => r.fulfill({ status: 500, contentType: 'application/json', body: '{"success":false,"error":"sin servidor"}' }));
    const errors = [];
    page.on('pageerror', e => errors.push(String(e.message).slice(0, 200)));
    await page.goto(`${BASE}${route}?state=${state}`, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(state === 'generating' ? 1500 : 2500);
    const m = await page.evaluate(() => {
      const de = document.documentElement;
      const small = [];
      document.querySelectorAll('button, a[href], [role=button], input, select, textarea').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        if (r.height < 44 || r.width < 44) small.push({ t: (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 40), w: Math.round(r.width), h: Math.round(r.height) });
      });
      const over = [];
      document.querySelectorAll('body *').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.right > window.innerWidth + 1 && !el.closest('.flow-carousel, .overflow-x-auto')) over.push((el.className?.toString() || el.tagName).slice(0, 60));
      });
      return { scrollW: de.scrollWidth, clientW: de.clientWidth, small, over: over.slice(0, 5), text: document.body.innerText.slice(0, 160).replace(/\s+/g, ' ') };
    });
    await page.screenshot({ path: path.join(OUT, `${name}-${size.w}.png`), fullPage: true });
    report.push({ size: size.w, name, hOverflow: m.scrollW > m.clientW, scrollW: m.scrollW, small: m.small, over: m.over, errors, text: m.text });
    await ctx.close();
  }
}
await browser.close();
fs.writeFileSync(path.join(OUT, 'mediciones-movil.json'), JSON.stringify(report, null, 1));
for (const r of report) console.log(`${r.size} ${r.name.padEnd(18)} overflowH=${r.hOverflow} chicos=${r.small.length} errores=${r.errors.length} | ${r.text.slice(0, 70)}`);
