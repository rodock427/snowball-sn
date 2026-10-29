const $ = s => document.querySelector(s);
const el = (tag, text = '', cls = '') => Object.assign(document.createElement(tag), { textContent: text, className: cls });

const ROUTING = ['assignment_group', 'assigned_to', 'state'];
const MATTERS = ['short_description', 'description', 'category', 'subcategory', 'priority', 'impact', 'urgency',
  'assignment_group', 'assigned_to', 'cmdb_ci', 'business_service', 'contact_type'];
const EMOJIS = ['👋', '✅', '🔑', '🖨️', '🛜', '💻', '📧', '🔥', '⏳', '🙏', '📞', '🧊', '🚀', '🐛', '📦', '🎯'];
const CHIPS = { first_name: 'First name', caller_id: 'Caller', number: 'Number', short_description: 'Summary', me: 'Me' };
const SECTIONS = ['Replies', 'Hand-offs', 'Templates'];

let tab, form, store, sel = 0, shown = [], ed;

const embedded = window.top !== window; // opened from the floating button
const close = () => embedded ? parent.postMessage('snowball:close', '*') : window.close();
const save = () => chrome.storage.local.set(store);
const fieldNames = t => Object.keys(t.fields || {});
const kind = t => !fieldNames(t).length ? 'Replies' : fieldNames(t).every(n => ROUTING.includes(n)) ? 'Hand-offs' : 'Templates';
const canNew = t => !!t.table && fieldNames(t).length > 0;
const summary = t => [t.message && (t.visibility === 'work_notes' ? '🔒 ' : '') + t.message,
  ...Object.values(t.fields || {}).map(f => f.display || f.value)].filter(Boolean).join(' · ');
// v0.1 stored { values: { field: 'value' } }
const norm = t => t.values ? { name: t.name, table: t.table, emoji: '🧊',
  fields: Object.fromEntries(Object.entries(t.values).map(([k, v]) => [k, { value: v }])) } : t;

async function run(job, data = null) {
  const target = form ? { tabId: tab.id, frameIds: [form.frameId] } : { tabId: tab.id, allFrames: true };
  const res = await chrome.scripting.executeScript({ target, world: 'MAIN', func: snowball, args: [job, data] });
  return res.find(r => r.result);
}

function show(view) {
  for (const v of ['list', 'edit', 'settings']) $(`#${v}-view`).hidden = v !== view;
  $('.keys').hidden = view !== 'list';
  if (view === 'list') { render(); $('#q').focus(); }
}

let toastTimer;
function toast(msg, undo, after) {
  const t = $('#toast'), b = t.querySelector('button');
  clearTimeout(toastTimer);
  t.querySelector('span').textContent = msg;
  b.hidden = !undo;
  b.onclick = () => { clearTimeout(toastTimer); undo(); };
  t.hidden = false;
  t.classList.remove('pop'); void t.offsetWidth; t.classList.add('pop');
  toastTimer = setTimeout(() => { t.hidden = true; after?.(); }, undo ? 5000 : 2500);
}

const bounce = () => $('#logo').animate([{ transform: 'none' }, { transform: 'translateY(-7px) rotate(-10deg)' }, { transform: 'none' }], { duration: 450, easing: 'ease-out' });

// ---- list ----

function render() {
  const q = $('#q').value.trim().toLowerCase();
  const match = t => !q || [t.name, t.table, summary(t)].join(' ').toLowerCase().includes(q);
  const rank = t => (form && t.table && t.table !== form.table ? 1 : 0); // current ticket type first
  const list = $('#list');
  list.replaceChildren();
  shown = [];
  for (const sec of SECTIONS) {
    const items = store.items.filter(t => kind(t) === sec && match(t)).sort((a, b) => rank(a) - rank(b));
    if (!items.length) continue;
    list.append(el('h5', sec));
    for (const t of items) list.append(row(t, shown.push(t) - 1));
  }
  if (!store.items.length) list.append(emptyCard());
  else if (!shown.length) list.append(el('p', `Nothing matches “${q}”.`, 'none'));
  sel = Math.max(0, Math.min(sel, shown.length - 1));
  highlight();
}

function row(t, i) {
  const r = el('div', '', 'row');
  r.style.animationDelay = `${Math.min(i, 12) * 25}ms`;
  if (!form && !canNew(t)) r.classList.add('off');
  const body = el('div', '', 'body');
  const name = el('b', t.name);
  if (t.table && (!form || t.table !== form.table)) name.append(el('span', t.table, 'tag'));
  body.append(name, el('small', summary(t)));
  r.append(el('span', t.emoji || '🧊', 'emo'), body);
  if (canNew(t)) r.append(iconBtn('↗', 'Start a new ticket with this (⇧⏎)', () => use(t, true)));
  r.append(iconBtn('✎', 'Edit', () => openEditor(t)));
  r.onclick = () => use(t);
  r.onmouseenter = () => { sel = i; highlight(); };
  return r;
}

function iconBtn(text, title, fn) {
  const b = el('button', text, 'icon');
  b.title = title;
  b.setAttribute('aria-label', title);
  b.onclick = e => { e.stopPropagation(); fn(); };
  return b;
}

function emptyCard() {
  const c = el('div', '', 'empty');
  c.append(Object.assign(el('img'), { src: 'icons/128.png', alt: '' }), el('b', "Let's get rolling"),
    el('p', 'Write a reply you send all the time, or open a ticket and save the fields that matter — like who it goes to.'));
  return c;
}

function highlight() {
  document.querySelectorAll('.row').forEach((r, i) => r.classList.toggle('sel', i === sel));
  document.querySelectorAll('.row')[sel]?.scrollIntoView({ block: 'nearest' });
}

async function use(t, forceNew) {
  if (forceNew || (!form && canNew(t))) {
    if (!canNew(t)) return toast('Replies need a ticket to land on.');
    const origin = form || !store.origin ? new URL(tab.url).origin : store.origin;
    chrome.tabs.create({ url: newUrl(origin, t.table, t.fields) });
    return close();
  }
  if (!form) return toast("Snowball can't see a ticket here — open one first.");
  const { result } = await run('apply', { fields: t.fields, message: t.message, visibility: t.visibility });
  bounce();
  const msg = !fieldNames(t).length ? 'Reply added — hit Post when ready'
    : `Nice — ${result.count} field${result.count === 1 ? '' : 's'} filled`;
  toast(msg, async () => { await run('apply', { fields: result.before, raw: true }); toast('Undone ↩'); }, close);
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') return $('#list-view').hidden ? show('list') : close();
  if ($('#list-view').hidden || !shown.length) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + shown.length) % shown.length;
    highlight();
    e.preventDefault();
  } else if (e.key === 'Enter') use(shown[sel], e.shiftKey);
});
$('#q').oninput = () => { sel = 0; render(); };

// ---- editor ----

function openEditor(item, captured) {
  const draft = structuredClone(item || { emoji: EMOJIS[0], name: '', message: '', visibility: 'comments', fields: {} });
  const opts = captured ? captured.fields : Object.entries(draft.fields || {}).map(([name, f]) => ({ name, ...f }));
  const picked = new Set(captured ? (store.picks[captured.table] || MATTERS) : fieldNames(draft));
  if (captured) Object.assign(draft, { table: captured.table, name: captured.short_description || '', emoji: '🎯' });
  ed = { item, draft, opts, captured };

  $('#emojis').replaceChildren(...EMOJIS.map(e => {
    const b = el('button', e, e === draft.emoji ? 'on' : '');
    b.onclick = () => { draft.emoji = e; $('#emojis .on')?.classList.remove('on'); b.classList.add('on'); };
    return b;
  }));
  $('#e-name').value = draft.name;
  $('#e-msg').value = draft.message || '';
  setVis(draft.visibility || 'comments');
  $('#e-fields-wrap').hidden = !opts.length;
  $('#e-fields').replaceChildren(...opts.map(o => {
    const l = el('label', '', 'field');
    const c = Object.assign(el('input'), { type: 'checkbox', value: o.name, checked: picked.has(o.name) });
    const s = el('span');
    s.append(el('b', o.label || o.name), el('small', o.display || o.value));
    l.append(c, s);
    return l;
  }));
  $('#e-del').hidden = !item;
  show('edit');
  (captured ? $('#e-name') : $('#e-msg')).focus();
}

function setVis(v) {
  ed.draft.visibility = v;
  document.querySelectorAll('#vis button').forEach(b => b.classList.toggle('on', b.dataset.vis === v));
}
document.querySelectorAll('#vis button').forEach(b => b.onclick = () => setVis(b.dataset.vis));

$('#chips').replaceChildren(...Object.entries(CHIPS).map(([k, label]) => {
  const b = el('button', `+ ${label}`);
  b.title = `Inserts {${k}}`;
  b.onclick = () => { const m = $('#e-msg'); m.setRangeText(`{${k}}`, m.selectionStart, m.selectionEnd, 'end'); m.focus(); };
  return b;
}));

$('#just-routing').onclick = () =>
  document.querySelectorAll('#e-fields input').forEach(c => c.checked = ['assignment_group', 'assigned_to'].includes(c.value));

$('#e-save').onclick = () => {
  const { item, draft, opts, captured } = ed;
  const checked = [...document.querySelectorAll('#e-fields input:checked')].map(c => c.value);
  draft.message = $('#e-msg').value.trim();
  draft.fields = Object.fromEntries(opts.filter(o => checked.includes(o.name))
    .map(o => [o.name, { value: o.value, display: o.display, label: o.label }]));
  if (!draft.message && !checked.length) return toast('Add a message or tick a field first.');
  draft.name = $('#e-name').value.trim() || draft.message.slice(0, 40) || 'Untitled';
  if (captured) store.picks[captured.table] = checked;
  if (item) store.items[store.items.indexOf(item)] = draft; else store.items.push(draft);
  save();
  show('list');
  toast(item ? 'Saved ✓' : `Saved — find it under ${kind(draft)} ✓`);
};

$('#e-del').onclick = () => {
  const { item } = ed, i = store.items.indexOf(item);
  store.items.splice(i, 1);
  save();
  show('list');
  toast(`Deleted “${item.name}”`, () => { store.items.splice(i, 0, item); save(); render(); });
};

$('#e-cancel').onclick = () => show('list');
$('#new-reply').onclick = () => openEditor(null);
$('#save-ticket').onclick = async () => {
  if (!form) return toast("Snowball can't see a ticket here — open one first.");
  openEditor(null, (await run('capture')).result);
};

// ---- settings ----

$('#gear').onclick = () => show($('#settings-view').hidden ? 'settings' : 'list');
$('#s-back').onclick = () => show('list');
$('#export').onclick = () => {
  const a = el('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(store.items, null, 2)], { type: 'application/json' }));
  a.download = 'snowball-backup.json';
  a.click();
};
$('#import').onchange = async e => {
  try {
    const items = JSON.parse(await e.target.files[0].text());
    if (!Array.isArray(items)) throw new Error('expected a list');
    store.items.push(...items.map(norm));
    save();
    toast(`Imported ${items.length} item${items.length === 1 ? '' : 's'} ✓`);
  } catch (err) { toast(`That file didn't work: ${err.message}`); }
  e.target.value = '';
};

// ---- start ----

(async () => {
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  store = { picks: {}, origin: '', ...await chrome.storage.local.get(null) };
  store.items = (store.items || store.templates || []).map(norm);
  delete store.templates;
  chrome.storage.local.remove('templates');
  let why = '';
  try {
    const hit = await run('peek');
    if (hit) form = { frameId: hit.frameId, ...hit.result };
  } catch (e) { why = e.message; } // e.g. chrome:// pages, or no access to this site
  if (form) { store.origin = new URL(tab.url).origin; save(); }
  $('#ctx-title').textContent = form ? form.number || `New ${form.table}` : 'Snowball';
  $('#ctx-sub').textContent = form ? form.short_description || form.table
    : why ? `Can't read this page: ${why}` : 'No ticket here — templates will start a new one';
  $('#ctx-sub').title = $('#ctx-sub').textContent;
  show('list');
})();
