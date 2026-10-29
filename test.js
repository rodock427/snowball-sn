// node test.js — runs snow.js against a fake g_form.
const vm = require('vm'), fs = require('fs'), assert = require('assert');

const vals = { number: 'INC001', short_description: 'Printer down', caller_id: 'abc123', assignment_group: 'g1', priority: '', business_service: 's1', business_duration: '1h', comments: '', sys_id: 'x' };
const names = { caller_id: 'Ada Lovelace', assignment_group: 'Network Ops' };
const g_form = {
  elements: Object.keys(vals).map(fieldName => ({ fieldName })),
  getValue: f => vals[f] ?? '',
  setValue: (f, v, d) => { vals[f] = v; if (d) names[f] = d; },
  getTableName: () => 'incident',
  getLabelOf: f => f.replace('_', ' '),
  getDisplayBox: f => (f in names ? { value: names[f] } : undefined),
  flash() {},
};
const ctx = vm.createContext({ g_form, g_user: { firstName: 'Sam' } });
vm.runInContext(fs.readFileSync(__dirname + '/snow.js', 'utf8'), ctx);
const json = x => JSON.parse(JSON.stringify(x));

assert.deepEqual(json(ctx.snowball('peek')), { table: 'incident', number: 'INC001', short_description: 'Printer down' });

const cap = json(ctx.snowball('capture'));
assert.deepEqual(cap.fields.map(f => f.name), ['short_description', 'caller_id', 'assignment_group', 'business_service']);
assert.deepEqual(cap.fields[2], { name: 'assignment_group', label: 'assignment group', value: 'g1', display: 'Network Ops' });

const res = json(ctx.snowball('apply', { fields: { assignment_group: { value: 'g2', display: 'Desktop' } }, message: 'Hi {first_name}, {me} here re {short_description}' }));
assert.equal(vals.assignment_group, 'g2');
assert.equal(names.assignment_group, 'Desktop');
assert.equal(vals.comments, 'Hi Ada, Sam here re Printer down');
assert.equal(res.count, 2);

ctx.snowball('apply', { message: 'Second', visibility: 'comments' });
assert.equal(vals.comments, 'Hi Ada, Sam here re Printer down\n\nSecond');

ctx.snowball('apply', { fields: res.before, raw: true }); // undo
assert.equal(vals.assignment_group, 'g1');
assert.equal(names.assignment_group, 'Network Ops');
assert.equal(vals.comments, '');

assert.equal(ctx.newUrl('https://x.service-now.com', 'incident', { a: { value: '1' }, b: { value: '2' } }),
  'https://x.service-now.com/incident.do?sys_id=-1&sysparm_query=a%3D1%5Eb%3D2');

console.log('ok');
