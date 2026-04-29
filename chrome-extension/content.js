// LUZ IA - Facebook Prompt Extractor v1.1
// Extrae imagen + caption del viewer de foto de Facebook
// El caption del viewer esta en el panel derecho, en un span dir="auto"

let isInjected = false;

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action !== 'capture') return;

  try {
    const result = extractCurrentPhoto();
    if (result) {
      sendResponse({ ok: true, data: result });
    } else {
      sendResponse({ ok: false, error: 'Abre una foto individual en Facebook' });
    }
  } catch (e) {
    sendResponse({ ok: false, error: e.message.slice(0, 80) });
  }

  return true;
});

function extractCurrentPhoto() {
  // Expandir "Ver mas" / "See more" antes de leer
  expandSeeMore();

  const imageUrl  = findImageUrl();
  const rawCaption = findViewerCaption();

  if (!imageUrl) return null;

  return {
    imageUrl,
    rawCaption: rawCaption ? cleanCaption(rawCaption) : '',
    capturedAt: new Date().toISOString(),
  };
}

// ── Imagen ────────────────────────────────────────────────────────────────────

function findImageUrl() {
  // El viewer de Facebook tiene la foto principal en un img dentro de
  // un contenedor que NO es el feed. Buscamos la imagen de mayor resolucion
  // en fbcdn.net excluyendo avatares y emojis.

  const all = Array.from(document.querySelectorAll('img'));
  const candidates = all.filter(img => {
    const src = img.src || '';
    return src.includes('fbcdn.net')
      && !src.includes('_s.jpg')    // thumbs pequenas
      && !src.includes('emoji')
      && !src.includes('sticker')
      && img.naturalWidth  > 300
      && img.naturalHeight > 300;
  });

  if (!candidates.length) return null;

  // La mas grande = foto principal
  return candidates.reduce((best, img) =>
    (img.naturalWidth * img.naturalHeight) > (best.naturalWidth * best.naturalHeight)
      ? img : best
  ).src;
}

// ── Caption del viewer ────────────────────────────────────────────────────────
//
// Facebook renderiza el viewer como una capa encima del feed.
// El caption de la FOTO (no del post) esta en el panel derecho del viewer.
// Se identifica porque:
//   1. Es un span con dir="auto"
//   2. Tiene texto largo (>40 chars)
//   3. Cuando hay texto del post principal Y caption de la foto,
//      el caption de la foto es el que esta MAS ABAJO en el DOM
//      dentro del overlay del viewer.
//
// Estrategia: recoger TODOS los spans dir="auto" con texto relevante,
// ordenar por longitud descendente, devolver el que mas parezca un prompt.

function findViewerCaption() {
  expandSeeMore();

  const spans = Array.from(document.querySelectorAll('span[dir="auto"]'));

  const candidates = spans
    .map(el => {
      // Usar innerText para respetar saltos de linea y no capturar hijos duplicados
      const text = (el.innerText || el.textContent || '').trim();
      return { el, text };
    })
    .filter(({ text }) =>
      text.length > 40
      && !isUIChrome(text)
    );

  if (!candidates.length) return null;

  // Preferir el que tiene mas señales de prompt de IA
  const scored = candidates.map(c => ({ ...c, score: scorePrompt(c.text) }));
  scored.sort((a, b) => b.score - a.score || b.text.length - a.text.length);

  return scored[0].text;
}

function scorePrompt(text) {
  const t = text.toLowerCase();
  const signals = [
    'prompt','photography','photo','lighting','background','style',
    'woman','man','girl','model','portrait','fashion','outfit',
    'camera','lens','studio','natural light','bokeh','cinematic',
    'product','render','realistic','ultra','8k','4k','hd',
    'wearing','dressed','skin','hair','eyes','makeup',
    'depth of field','shallow','sharp focus','bokeh',
    'editorial','commercial','skincare','beauty',
  ];
  return signals.reduce((acc, s) => acc + (t.includes(s) ? 1 : 0), 0);
}

function isUIChrome(text) {
  if (text.length > 200) return false; // textos largos no son UI
  const t = text.toLowerCase();
  const uiPhrases = [
    'me gusta','comentar','compartir','responder','ver traduccion',
    'like','comment','share','reply','see translation',
    'seguir','follow','amigo','friend','mensaje','message',
    'foto de portada','cover photo','foto de perfil','profile picture',
    'ver mas comentarios','view more comments','escribir un comentario',
    'write a comment','responde a','replied to','reacciono','reacted',
  ];
  return uiPhrases.some(p => t.includes(p));
}

// ── Expandir "Ver mas" ────────────────────────────────────────────────────────

function expandSeeMore() {
  const labels = ['Ver más','See more','Ver todo','Show more','Ver menos'];
  document.querySelectorAll('[role="button"]').forEach(el => {
    const t = (el.innerText || el.textContent || '').trim();
    if (labels.includes(t)) {
      try { el.click(); } catch {}
    }
  });
}

// ── Limpiar caption ───────────────────────────────────────────────────────────

function cleanCaption(text) {
  return text
    .replace(/#\w+/g, '')           // hashtags
    .replace(/@[\w.]+/g, '')        // menciones
    .replace(/https?:\/\/\S+/g, '') // URLs
    .replace(/ /g, ' ')        // espacios especiales
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}
