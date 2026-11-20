const src = require('fs').readFileSync(require('path').join(__dirname, '../web/ce/boot.js'), 'utf8');
const i = src.indexOf('  async function syncGet(col)'); let d = 0, j = src.indexOf('{', i);
for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}') { d--; if (!d) break; } }
const fn = src.slice(i, j + 1);
const store = {}; global.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v) } };
let rows = [{ id: 'o_1', data: { id: '1', t: 'a' }, updated_at: '2026-11-20T10:00:00.123456+00:00' }, { id: 'o_2', data: { id: '2' }, updated_at: '2026-11-20T10:05:00.000001+00:00' }, { id: 'sugg', data: { mt: 1 }, updated_at: '2026-11-20T09:00:00+00:00' }];
let bytes = 0;
function q() { let f = { cols: '', filt: [] }; const o = { select(c) { f.cols = c; return o }, eq() { return o }, order() { return o }, gt(k, v) { f.filt.push(v); return o }, range() { return o },
  then(res) { let out = rows.filter(r => !f.filt.length || r.updated_at > f.filt[0]); out = out.map(r => f.cols === 'id' ? { id: r.id } : r); bytes += JSON.stringify(out).length; res({ data: out, error: null }) } }; return o }
global.sb = { from: () => q() };
const LS = 'candexp.'; const err = (a, b) => new Error(b);
store['candexp.off'] = '[{}]';
const syncGet = eval('(' + fn.replace('async function syncGet', 'async function') + ')');
const { eq, done } = require('./lib.cjs');
(async () => {
  const tag = (r) => r.docs.map(x => x.id + (x.same ? '=' : '+')).join(' ');
  let r = await syncGet('app'); eq('premier passage : tout', tag(r), 'o_1+ o_2+ sugg+');
  r = await syncGet('app'); eq('passage suivant : inchangés non retéléchargés', tag(r), 'o_1= o_2+ sugg=');
  rows[1] = { ...rows[1], data: { id: '2', t: 'modifié' }, updated_at: '2026-11-20T11:00:00.5+00:00' }; rows.shift();
  r = await syncGet('app'); eq('modification reçue, suppression vue', tag(r) + ' ' + r.docs[0].data().t, 'o_2+ sugg= modifié');
  done('Synchronisation économe');
})();
