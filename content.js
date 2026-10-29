// Puts a Snowball button on ServiceNow ticket forms; the panel it opens is popup.html in an iframe.
if (/\.do$/.test(location.pathname) && new URLSearchParams(location.search).has('sys_id')) {
  const host = document.createElement('div');
  const root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = `<style>
    .b { position: fixed; right: 20px; bottom: 20px; z-index: 2147483647; width: 52px; height: 52px; padding: 0; border: 0; border-radius: 50%;
      display: grid; place-items: center; cursor: pointer; background: #0d0f14;
      box-shadow: 0 0 0 2px #7dd3fc66, 0 8px 24px -6px #7dd3fcaa; transition: transform .15s; }
    .b:hover { transform: scale(1.08) rotate(-8deg); }
    .b img { width: 36px; height: 36px; image-rendering: pixelated; }
    .b.pulse { animation: pulse 1.6s ease-out 3; }
    iframe { position: fixed; right: 20px; bottom: 84px; z-index: 2147483647; width: 360px; height: 520px; border: 0; border-radius: 14px;
      box-shadow: 0 0 0 1px #262c3a, 0 24px 60px -12px #000b; animation: up .18s ease-out; }
    @keyframes pulse { from { box-shadow: 0 0 0 0 #7dd3fcaa; } to { box-shadow: 0 0 0 18px #7dd3fc00; } }
    @keyframes up { from { opacity: 0; transform: translateY(8px); } }
  </style><button class="b" title="Snowball (Alt+Shift+S)"><img alt="Snowball" src="${chrome.runtime.getURL('icons/48.png')}"></button>`;
  const btn = root.querySelector('button');
  let panel;
  const close = () => { panel?.remove(); panel = null; };

  btn.onclick = () => {
    if (panel) return close();
    panel = document.createElement('iframe');
    panel.src = chrome.runtime.getURL('popup.html');
    panel.onload = () => panel?.focus();
    root.append(panel);
  };
  addEventListener('message', e => { if (panel && e.source === panel.contentWindow && e.data === 'snowball:close') close(); });
  addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  addEventListener('mousedown', e => { if (panel && e.target !== host) close(); });
  document.body.append(host);

  chrome.storage.local.get('seenButton').then(({ seenButton }) => {
    if (!seenButton) { btn.classList.add('pulse'); chrome.storage.local.set({ seenButton: true }); }
  });
}
