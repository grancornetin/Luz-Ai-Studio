import jsPDF from 'jspdf';
import { CampaignPlan, CampaignSet, CAMPAIGN_CHANNEL_META } from './types';

// ─── Colores de marca ─────────────────────────────────────────
const BRAND   = '#F72C5B';
const DARK    = '#06060D';
const SLATE   = '#0f172a';
const GRAY    = '#64748b';
const LIGHT   = '#f8fafc';
const WHITE   = '#ffffff';
const LIME    = '#E4F1AC';

// ─── Helpers ──────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function setFill(doc: jsPDF, hex: string) {
  doc.setFillColor(...hexToRgb(hex));
}

function setTextColor(doc: jsPDF, hex: string) {
  doc.setTextColor(...hexToRgb(hex));
}

function setDrawColor(doc: jsPDF, hex: string) {
  doc.setDrawColor(...hexToRgb(hex));
}

function wrapText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

// ─── Portada ──────────────────────────────────────────────────

function drawCover(doc: jsPDF, set: CampaignSet) {
  const { plan } = set;
  const W = 210, H = 297;

  // Fondo negro
  setFill(doc, DARK);
  doc.rect(0, 0, W, H, 'F');

  // Banda fucsia superior
  setFill(doc, BRAND);
  doc.rect(0, 0, W, 8, 'F');

  // Etiqueta
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  setTextColor(doc, BRAND);
  doc.text('LUZ IA STUDIO · KIT DE CAMPAÑA', 20, 35);

  // Título grande
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  setTextColor(doc, WHITE);
  const titleLines = doc.splitTextToSize(plan.tagline.toUpperCase(), 170);
  doc.text(titleLines, 20, 55);

  // Concepto
  const conceptY = 55 + titleLines.length * 12 + 8;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  setTextColor(doc, '#94a3b8');
  wrapText(doc, plan.concepto, 20, conceptY, 170, 7);

  // Separador
  setDrawColor(doc, BRAND);
  doc.setLineWidth(0.5);
  doc.line(20, conceptY + 18, 190, conceptY + 18);

  // Promesa
  const promesaY = conceptY + 30;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  setTextColor(doc, LIME);
  doc.text('PROMESA DE CAMPAÑA', 20, promesaY);
  doc.setFont('helvetica', 'normal');
  setTextColor(doc, WHITE);
  wrapText(doc, `"${plan.promesa}"`, 20, promesaY + 8, 170, 6.5);

  // Stats en fila
  const statsY = promesaY + 36;
  const stats = [
    { label: 'DURACIÓN', value: `${plan.duracionDias} días` },
    { label: 'PIEZAS', value: `${plan.piezas.length}` },
    { label: 'CANALES', value: `${new Set(plan.piezas.map(p => p.canal)).size}` },
  ];
  stats.forEach((s, i) => {
    const x = 20 + i * 60;
    setFill(doc, '#1e293b');
    doc.roundedRect(x, statsY, 52, 28, 3, 3, 'F');
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    setTextColor(doc, WHITE);
    doc.text(s.value, x + 8, statsY + 16);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    setTextColor(doc, GRAY);
    doc.text(s.label, x + 8, statsY + 24);
  });

  // Resumen
  const resumenY = statsY + 46;
  setFill(doc, '#1e293b');
  doc.roundedRect(20, resumenY, 170, 42, 4, 4, 'F');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  setTextColor(doc, LIME);
  doc.text('QUÉ HACER CON ESTE KIT', 28, resumenY + 10);
  doc.setFont('helvetica', 'normal');
  setTextColor(doc, '#cbd5e1');
  wrapText(doc, plan.resumen, 28, resumenY + 18, 154, 5.5);

  // Footer
  doc.setFontSize(7);
  setTextColor(doc, '#475569');
  doc.text(`Generado con Luz IA Studio · ${new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' })}`, 20, H - 12);

  // Banda fucsia inferior
  setFill(doc, BRAND);
  doc.rect(0, H - 4, W, 4, 'F');
}

// ─── Página de hashtags ───────────────────────────────────────

function drawHashtagPage(doc: jsPDF, plan: CampaignPlan) {
  doc.addPage();
  const W = 210;

  setFill(doc, LIGHT);
  doc.rect(0, 0, W, 297, 'F');

  // Header
  setFill(doc, DARK);
  doc.rect(0, 0, W, 18, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  setTextColor(doc, WHITE);
  doc.text('ESTRATEGIA DE HASHTAGS', 20, 12);

  let y = 32;

  const groups = [
    {
      title: 'COMUNIDAD (alta visibilidad, largo plazo)',
      color: BRAND,
      tags: plan.hashtagsComunidad,
      desc: 'Usá 2-3 de estos en cada post para construir presencia en tu comunidad.',
    },
    {
      title: 'NICHO (alcance medio, audiencia específica)',
      color: '#7C3AED',
      tags: plan.hashtagsNicho,
      desc: 'Estos conectan con personas que ya buscan lo que vendés.',
    },
    {
      title: 'COLA LARGA (baja competencia, alta intención de compra)',
      color: '#059669',
      tags: plan.hashtagsColarga,
      desc: 'Menos alcance pero la gente que los busca tiene más intención de comprar.',
    },
  ];

  groups.forEach(g => {
    // Título grupo
    const [r, gr, b] = hexToRgb(g.color);
    doc.setFillColor(r, gr, b);
    doc.roundedRect(20, y, 170, 7, 2, 2, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    setTextColor(doc, WHITE);
    doc.text(g.title, 24, y + 5);
    y += 12;

    // Descripción
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    setTextColor(doc, SLATE);
    doc.text(g.desc, 20, y);
    y += 8;

    // Tags como chips
    let x = 20;
    g.tags.forEach(tag => {
      const tagText = tag.startsWith('#') ? tag : `#${tag}`;
      const w = doc.getTextWidth(tagText) + 8;
      if (x + w > 185) { x = 20; y += 10; }
      setFill(doc, '#f1f5f9');
      doc.roundedRect(x, y - 5, w, 8, 2, 2, 'F');
      doc.setFontSize(8);
      setTextColor(doc, SLATE);
      doc.text(tagText, x + 4, y + 0.5);
      x += w + 4;
    });
    y += 18;
  });
}

// ─── Página de calendario ─────────────────────────────────────

function drawCalendarPage(doc: jsPDF, plan: CampaignPlan) {
  doc.addPage();
  const W = 210;

  setFill(doc, LIGHT);
  doc.rect(0, 0, W, 297, 'F');

  setFill(doc, DARK);
  doc.rect(0, 0, W, 18, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  setTextColor(doc, WHITE);
  doc.text('CALENDARIO DE PUBLICACIÓN — 7 DÍAS', 20, 12);

  const dias = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  let y = 26;

  for (let d = 1; d <= 7; d++) {
    const piezasDelDia = plan.piezas.filter(p => p.dia === d);

    // Cabecera del día
    setFill(doc, d === 1 ? BRAND : '#e2e8f0');
    doc.roundedRect(20, y, 170, 8, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    setTextColor(doc, d === 1 ? WHITE : SLATE);
    doc.text(`DÍA ${d} — ${dias[d - 1].toUpperCase()}`, 24, y + 5.5);
    y += 10;

    if (piezasDelDia.length === 0) {
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'italic');
      setTextColor(doc, GRAY);
      doc.text('Día de descanso — no publicar.', 24, y + 4);
      y += 10;
    } else {
      piezasDelDia.forEach(p => {
        const canalMeta = CAMPAIGN_CHANNEL_META[p.canal];
        setFill(doc, WHITE);
        doc.roundedRect(22, y, 166, 16, 2, 2, 'F');

        // Canal + rol
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        setTextColor(doc, BRAND);
        doc.text(`${canalMeta.icon} ${canalMeta.label.toUpperCase()} · ${p.rol.toUpperCase()}`, 26, y + 5);

        // Titular
        doc.setFont('helvetica', 'normal');
        setTextColor(doc, SLATE);
        doc.text(`"${p.titular}"`, 26, y + 11);

        // Hora
        doc.setFontSize(6.5);
        setTextColor(doc, GRAY);
        doc.text(p.horaRecomendada, 174, y + 5);

        y += 18;
      });
    }

    y += 2;

    // Salto de página si hace falta
    if (y > 260 && d < 7) {
      doc.addPage();
      setFill(doc, LIGHT);
      doc.rect(0, 0, W, 297, 'F');
      y = 20;
    }
  }
}

// ─── Páginas de piezas ────────────────────────────────────────

async function drawPiecesPages(doc: jsPDF, plan: CampaignPlan) {
  const W = 210;

  for (let i = 0; i < plan.piezas.length; i++) {
    const p = plan.piezas[i];
    doc.addPage();

    setFill(doc, LIGHT);
    doc.rect(0, 0, W, 297, 'F');

    // Header
    setFill(doc, DARK);
    doc.rect(0, 0, W, 18, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    setTextColor(doc, WHITE);
    const canalMeta = CAMPAIGN_CHANNEL_META[p.canal];
    doc.text(`PIEZA ${i + 1} · DÍA ${p.dia} · ${canalMeta.label.toUpperCase()}`, 20, 12);
    // Número de pieza arriba derecha
    setTextColor(doc, BRAND);
    doc.text(`${i + 1}/${plan.piezas.length}`, 190, 12, { align: 'right' });

    let y = 28;

    // Rol badge
    const [br, bg, bb] = hexToRgb(BRAND);
    doc.setFillColor(br, bg, bb, 0.15);
    setFill(doc, '#fce7ef');
    doc.roundedRect(20, y, doc.getTextWidth(p.rol) + 16, 9, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    setTextColor(doc, BRAND);
    doc.text(p.rol.toUpperCase(), 28, y + 6);
    y += 16;

    // Imagen si existe
    if (p.imageUrl && p.imageUrl.startsWith('data:')) {
      try {
        doc.addImage(p.imageUrl, 'JPEG', 20, y, 80, 80);
      } catch (_) { /* imagen no disponible */ }
    }

    const textX = p.imageUrl ? 110 : 20;
    const textW = p.imageUrl ? 80 : 170;

    // Titular
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    setTextColor(doc, SLATE);
    wrapText(doc, p.titular, textX, y + 10, textW, 8);

    // CTA
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    setTextColor(doc, BRAND);
    doc.text(`→ ${p.cta}`, textX, y + 30);

    // Hora
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    setTextColor(doc, GRAY);
    doc.text(`⏰ Publicar a las ${p.horaRecomendada}`, textX, y + 40);

    y = Math.max(y + 88, y + 88);

    // Separador
    setDrawColor(doc, '#e2e8f0');
    doc.setLineWidth(0.3);
    doc.line(20, y, 190, y);
    y += 8;

    // Caption completo
    setFill(doc, WHITE);
    doc.roundedRect(20, y, 170, 40, 3, 3, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    setTextColor(doc, GRAY);
    doc.text('CAPTION COMPLETO', 26, y + 8);
    doc.setFont('helvetica', 'normal');
    setTextColor(doc, SLATE);
    wrapText(doc, p.caption, 26, y + 16, 158, 5.5);
    y += 48;

    // Hashtags
    setFill(doc, '#f8fafc');
    doc.roundedRect(20, y, 170, 22, 3, 3, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    setTextColor(doc, GRAY);
    doc.text('HASHTAGS', 26, y + 7);
    doc.setFont('helvetica', 'normal');
    setTextColor(doc, '#7C3AED');
    const hashText = p.hashtags.join('  ');
    wrapText(doc, hashText, 26, y + 14, 158, 5);
    y += 30;

    // Instrucción de Sofi
    setFill(doc, '#fef9c3');
    doc.roundedRect(20, y, 170, 28, 3, 3, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    setTextColor(doc, '#854d0e');
    doc.text('📌 QUÉ HACER', 26, y + 8);
    doc.setFont('helvetica', 'normal');
    setTextColor(doc, '#713f12');
    wrapText(doc, p.instruccion, 26, y + 16, 158, 5.5);
  }
}

// ─── Export principal ─────────────────────────────────────────

export async function generateCampaignPdf(set: CampaignSet): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  // Portada
  drawCover(doc, set);

  // Hashtags
  drawHashtagPage(doc, set.plan);

  // Calendario
  drawCalendarPage(doc, set.plan);

  // Una página por pieza
  await drawPiecesPages(doc, set.plan);

  return doc.output('blob');
}

export function downloadCampaignPdf(set: CampaignSet, filename?: string) {
  generateCampaignPdf(set).then(blob => {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = filename ?? `campaña_${set.id.slice(-6)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  });
}
