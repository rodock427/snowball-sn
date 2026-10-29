// snowball() runs inside the ServiceNow page via chrome.scripting, so it must stay self-contained.
// job: 'peek' → ticket context, 'capture' → filled-in fields, 'apply' → fill fields / add a message.
function snowball(job, data) {
  if (typeof g_form === 'undefined' || typeof g_form.getTableName !== 'function') return null;
  const table = g_form.getTableName();
  const ref = f => g_form.getDisplayBox?.(f)?.value; // display name of a reference field
  const shown = f => {
    const v = g_form.getValue(f);
    try { return ref(f) || g_form.getOption?.(f, v)?.text || v; } catch { return v; }
  };
  const ctx = { table, number: g_form.getValue('number'), short_description: g_form.getValue('short_description') };
  if (job === 'peek') return ctx;

  if (job === 'capture') {
    const skip = /^(sys_|number$|opened_|closed_|resolved_|calendar_|business_duration|business_stc|reassignment_count|reopen_count|activity_due|sla_due|comments|work_notes|approval_history)/;
    const names = [...new Set((g_form.elements || []).map(e => e.fieldName))];
    const fields = names.filter(n => !skip.test(n) && !n.includes('.') && g_form.getValue(n)).map(name => ({
      name, label: g_form.getLabelOf?.(name) || name, value: g_form.getValue(name), display: shown(name),
    }));
    return { ...ctx, fields };
  }

  // {field} → that field's displayed value; {first_name} → caller's first name; {me} → your first name
  const fill = s => data.raw ? s : s.replace(/\{(\w+)\}/g, (_, x) =>
    x === 'me' ? (typeof g_user !== 'undefined' ? g_user.firstName : '') :
    x === 'first_name' ? shown('caller_id').split(' ')[0] : shown(x));
  const before = {};
  const set = (f, value, display) => {
    before[f] = { value: g_form.getValue(f), display: ref(f) };
    g_form.setValue(f, value, ref(f) !== undefined ? display : undefined);
    try { g_form.flash?.(`${table}.${f}`, '#7dd3fc', 0); } catch {}
  };
  for (const [f, { value, display }] of Object.entries(data.fields || {})) set(f, fill(value), display);
  if (data.message) {
    const f = data.visibility === 'work_notes' ? 'work_notes' : 'comments';
    const cur = g_form.getValue(f);
    set(f, (cur ? cur + '\n\n' : '') + fill(data.message));
  }
  return { count: Object.keys(before).length, before };
}

// ponytail: values containing "^" break the encoded query; escape them if that ever bites.
function newUrl(origin, table, fields) {
  const q = Object.entries(fields).map(([f, { value }]) => `${f}=${value}`).join('^');
  return `${origin}/${table}.do?sys_id=-1&sysparm_query=${encodeURIComponent(q)}`;
}
