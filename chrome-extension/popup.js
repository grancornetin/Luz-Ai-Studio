const btnCapture  = document.getElementById('btn-capture');
const btnDownload = document.getElementById('btn-download');
const btnClear    = document.getElementById('btn-clear');
const countEl     = document.getElementById('count');
const lastTextEl  = document.getElementById('last-text');

function refreshUI(items) {
  countEl.textContent = items.length;
  btnDownload.disabled = items.length === 0;
  if (items.length > 0) {
    const last = items[items.length - 1];
    lastTextEl.className = 'last-captured has-content';
    lastTextEl.textContent = last.rawCaption
      ? last.rawCaption.slice(0, 120) + (last.rawCaption.length > 120 ? '...' : '')
      : '(sin caption — solo imagen)';
  }
}

function loadItems(cb) {
  chrome.storage.local.get(['fbPrompts'], r => cb(r.fbPrompts || []));
}

loadItems(refreshUI);

function setBtn(text, state) {
  btnCapture.textContent = text;
  btnCapture.className = state || '';
  setTimeout(() => {
    btnCapture.textContent = 'Capturar imagen actual';
    btnCapture.className = '';
  }, 2200);
}

btnCapture.addEventListener('click', () => {
  btnCapture.textContent = 'Capturando...';
  btnCapture.className = '';

  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    const tab = tabs[0];
    if (!tab || !tab.url || !tab.url.includes('facebook.com')) {
      setBtn('No estas en Facebook', 'error');
      return;
    }

    // Re-inyectar content script para asegurar que esta activo
    chrome.scripting.executeScript(
      { target: { tabId: tab.id }, files: ['content.js'] },
      () => {
        if (chrome.runtime.lastError) {
          // Ignorar error de re-inyeccion (ya estaba cargado)
        }
        chrome.tabs.sendMessage(tab.id, { action: 'capture' }, response => {
          if (chrome.runtime.lastError || !response) {
            setBtn('Error — recarga Facebook (F5)', 'error');
            return;
          }
          if (!response.ok) {
            setBtn(response.error || 'No se encontro imagen', 'error');
            return;
          }

          loadItems(items => {
            const exists = items.some(i => i.imageUrl === response.data.imageUrl);
            if (exists) { setBtn('Ya capturada', 'error'); return; }

            const updated = [...items, response.data];
            chrome.storage.local.set({ fbPrompts: updated }, () => {
              refreshUI(updated);
              setBtn('Capturada!', 'success');
            });
          });
        });
      }
    );
  });
});

btnDownload.addEventListener('click', () => {
  loadItems(items => {
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'facebook-raw.json';
    a.click();
    URL.revokeObjectURL(url);
  });
});

btnClear.addEventListener('click', () => {
  if (!confirm('Borrar todos los prompts capturados?')) return;
  chrome.storage.local.set({ fbPrompts: [] }, () => {
    refreshUI([]);
    lastTextEl.className = 'last-captured';
    lastTextEl.textContent = 'Abre una foto en Facebook y pulsa Capturar';
  });
});
