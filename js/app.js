(() => {
const { m, PERFIS, PF, CORES, MODELS, CATS, variantParams, variantLabel, skpKey, bom, len } = window.ESTR;
const $ = s => document.querySelector(s);
const fmt = (v, d = 1) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};

/* ---------- estado ---------- */
let tab = 'produtos', query = '', quick = store.get('acervo.quick', true), qcat = 'Todos', sortKey = 'padrao';
let saved = new Set(store.get('acervo.saved', []));
const filterCats = new Set();
const selVar = {};               // variante escolhida em cada card
const userModels = [];           // estruturas adicionadas (IndexedDB)
let skpIndex = {};               // chave → arquivo .skp publicado em skp/
const thumbs = {}, summaries = {};
let cur = null, curVar = 0, params = {}, prof = {}, hidden = new Set(), members = [], custom = false, style = 'traco';

const allModels = () => MODELS.concat(userModels);
const byId = id => allModels().find(x => x.id === id);
const vOf = md => md.custom ? 0 : (selVar[md.id] ?? md.dv);
const titleOf = (md, vi) => md.custom ? md.name : `${md.name} ${variantLabel(md, vi)}`;
const subOf = md => md.custom ? `${md.cat} · arquivo ${md.fmt}` : `${md.cat} · ${PF[md.prof[md.types[0]]].nome}`;
function allCats() { return [...new Set([...CATS, ...userModels.map(x => x.cat)])]; }
function summaryOf(md, vi) {
  const k = md.id + ':' + vi;
  if (!summaries[k]) {
    if (md.user) summaries[k] = { bars: 0, kg: 0 };
    else { const mem = md.build(md.custom ? {} : variantParams(md, vi)); summaries[k] = { bars: mem.length, kg: bom(md, mem, md.prof).reduce((s, r) => s + r.kg, 0) }; }
  }
  return summaries[k];
}

/* ---------- cores do tema ---------- */
let COL = {};
function readColors() {
  const cs = getComputedStyle(document.documentElement), g = k => cs.getPropertyValue(k).trim();
  COL = { stage: g('--stage'), face: g('--face'), edge: g('--edge'), grid: g('--grid'), m: ['--m1', '--m2', '--m3', '--m4', '--m5', '--m6'].map(g) };
}
const typeColor = (md, t) => COL.m[Math.max(0, md.types.indexOf(t)) % 6];

/* ---------- 3D: barras como caixas de seção quadrada, com arestas em traço (estilo SketchUp) ---------- */
const UP = new THREE.Vector3(0, 1, 0);
const BOXG = new THREE.BoxGeometry(1, 1, 1);
const UNIT = [...Array(8)].map((_, i) => new THREE.Vector3(i & 1 ? .5 : -.5, i & 2 ? .5 : -.5, i & 4 ? .5 : -.5));
const UNIT_EDGES = [];
for (let i = 0; i < 8; i++) for (const b of [1, 2, 4]) if (!(i & b)) UNIT_EDGES.push([i, i | b]);

function bounds(mem) {
  const b = new THREE.Box3();
  for (const x of mem) { b.expandByPoint(new THREE.Vector3(...x.a)); b.expandByPoint(new THREE.Vector3(...x.b)); }
  return b;
}
function uniqueNodes(mem) {
  const map = new Map();
  for (const x of mem) for (const p of [x.a, x.b]) map.set(p.map(v => v.toFixed(3)).join(','), p);
  return map.size;
}
const faceMat = color => new THREE.MeshLambertMaterial({ color, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, side: THREE.DoubleSide });
function buildObject(md, mem, pmap, hid, sty, grid) {
  const g = new THREE.Group(), lineMat = new THREE.LineBasicMaterial({ color: COL.edge });
  if (md.user) {
    const o = md.object.clone();
    o.traverse(c => {
      if (!c.isMesh) return;
      c.material = faceMat(sty === 'cores' ? COL.m[0] : COL.face);
      c.add(new THREE.LineSegments(new THREE.EdgesGeometry(c.geometry, 25), lineMat));
    });
    g.add(o);
    const box = new THREE.Box3().setFromObject(g);
    if (grid) addGrid(g, box);
    return { group: g, box };
  }
  const box = bounds(mem), size = box.getSize(new THREE.Vector3()).length() || 1;
  const byType = {};
  for (const x of mem) (byType[x.t] ||= []).push(x);
  const mat4 = new THREE.Matrix4(), q = new THREE.Quaternion(), va = new THREE.Vector3(), vb = new THREE.Vector3(), dir = new THREE.Vector3(), mid = new THREE.Vector3(), sc = new THREE.Vector3(), p = new THREE.Vector3();
  const lines = [];
  for (const t in byType) {
    if (hid.has(t)) continue;
    const pf = PF[pmap[t]] || PERFIS[0];
    const r = Math.min(Math.max(pf.d * .5, size * .003), size * .011);
    const list = byType[t];
    const im = new THREE.InstancedMesh(BOXG, faceMat(sty === 'cores' ? typeColor(md, t) : COL.face), list.length);
    list.forEach((x, i) => {
      va.set(...x.a); vb.set(...x.b); dir.subVectors(vb, va);
      const L = dir.length(); dir.normalize();
      q.setFromUnitVectors(UP, dir); mid.addVectors(va, vb).multiplyScalar(.5); sc.set(2 * r, L, 2 * r);
      mat4.compose(mid, q, sc); im.setMatrixAt(i, mat4);
      for (const [a, b] of UNIT_EDGES) {
        p.copy(UNIT[a]).applyMatrix4(mat4); lines.push(p.x, p.y, p.z);
        p.copy(UNIT[b]).applyMatrix4(mat4); lines.push(p.x, p.y, p.z);
      }
    });
    g.add(im);
  }
  if (lines.length) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
    g.add(new THREE.LineSegments(geo, lineMat));
  }
  if (grid) addGrid(g, box);
  return { group: g, box };
}
function addGrid(g, box) {
  const s = box.getSize(new THREE.Vector3()), span = Math.max(s.x, s.z, s.y * .6, 1) * 1.6;
  const grid = new THREE.GridHelper(span, Math.min(40, Math.max(6, Math.round(span))), COL.grid, COL.grid);
  const c = box.getCenter(new THREE.Vector3());
  grid.position.set(c.x, box.min.y - .001, c.z);
  g.add(grid);
}
function disposeGroup(g) {
  g.traverse(o => {
    if (o.material) o.material.dispose?.();
    if (o.isInstancedMesh) o.dispose?.();
    if ((o.isLineSegments || o.isGridHelper) && o.geometry) o.geometry.dispose();
  });
}
function makeScene() {
  const s = new THREE.Scene();
  s.add(new THREE.HemisphereLight(0xffffff, 0x9aa3aa, .95));
  const d = new THREE.DirectionalLight(0xffffff, .35); d.position.set(3, 6, 4); s.add(d);
  return s;
}
function viewDir(box, v) {
  const s = box.getSize(new THREE.Vector3()), planar = s.z < .02 * Math.max(s.x, s.y);
  if (v === 'front') return new THREE.Vector3(0, .02, 1);
  if (v === 'top') return new THREE.Vector3(0, 1, .001);
  if (v === 'side') return new THREE.Vector3(1, .02, 0);
  return planar ? new THREE.Vector3(.5, .32, 1) : new THREE.Vector3(1, .75, 1.25);
}
/* Enquadra pelos cantos da caixa projetados na tela, para o modelo ocupar `fill` da imagem. */
function fit(cam, box, v, target, fill = .8) {
  const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
  const dir = viewDir(box, v).normalize();
  let dist = Math.max(s.length(), 1) * 2;
  const corners = [...Array(8)].map((_, i) => new THREE.Vector3(i & 1 ? box.min.x : box.max.x, i & 2 ? box.min.y : box.max.y, i & 4 ? box.min.z : box.max.z));
  for (let it = 0; it < 4; it++) {
    cam.position.copy(c).addScaledVector(dir, dist);
    cam.near = dist / 100; cam.far = dist * 20; cam.updateProjectionMatrix();
    cam.lookAt(c); cam.updateMatrixWorld();
    let ext = 0;
    for (const p of corners) { const q = p.clone().project(cam); ext = Math.max(ext, Math.abs(q.x), Math.abs(q.y)); }
    if (!isFinite(ext) || ext <= 0) break;
    dist *= ext / fill;
  }
  cam.position.copy(c).addScaledVector(dir, dist);
  cam.near = dist / 100; cam.far = dist * 20; cam.updateProjectionMatrix();
  cam.lookAt(c); if (target) target.copy(c);
}

/* ---------- miniaturas ---------- */
const tR = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
tR.setPixelRatio(1); tR.setSize(560, 340);
const tCam = new THREE.PerspectiveCamera(30, 560 / 340, .1, 1000);
let thumbQueue = [], thumbBusy = false;
function queueThumb(md, vi) { const k = md.id + ':' + vi; if (!thumbs[k] && !thumbQueue.includes(k)) thumbQueue.push(k); if (!thumbBusy) pump(); }
function pump() {
  const k = thumbQueue.shift();
  if (!k) { thumbBusy = false; return; }
  thumbBusy = true;
  const [id, vs] = k.split(':'), md = byId(id), vi = +vs;
  if (md) {
    const mem = md.user ? [] : md.build(md.custom ? {} : variantParams(md, vi));
    const { group, box } = buildObject(md, mem, md.prof || {}, new Set(), 'traco', false);
    const sc = makeScene(); sc.add(group);
    tR.setClearColor(COL.stage); fit(tCam, box, 'iso', null, .86); tR.render(sc, tCam);
    thumbs[k] = tR.domElement.toDataURL('image/png');
    disposeGroup(group);
    const el = document.querySelector(`.card[data-id="${id}"] .thumb`);
    if (el && vOf(md) === vi) el.innerHTML = thumbHTML(md, vi);
  }
  requestAnimationFrame(pump);
}
const thumbHTML = (md, vi) => thumbs[md.id + ':' + vi] ? `<img src="${thumbs[md.id + ':' + vi]}" alt="">` : '<span class="ph">gerando desenho…</span>';

/* ---------- lista ---------- */
const ICON_HEART = '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.2-9.3C1.7 8 3.7 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.5 0 5.5 3.5 4.4 6.7C19.5 15.9 12 20.5 12 20.5z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';
const ICON_DL = '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3.5h8M12 7v9m0 0-4-4m4 4 4-4M4 14v5.5h16V14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const SORTS = { padrao: 'Padrão', nome: 'Nome (A–Z)', leve: 'Mais leve', pesado: 'Mais pesado', barras: 'Menos barras' };

function tabModels() {
  if (tab === 'produtos') return MODELS.filter(x => x.grupo === 'produtos').concat(userModels);
  if (tab === 'solucoes') return MODELS.filter(x => x.grupo === 'solucoes');
  if (tab === 'minhas') return userModels.concat(MODELS.filter(x => saved.has(x.id)));
  return [];
}
function matches(md) {
  if (quick && qcat !== 'Todos' && md.cat !== qcat) return false;
  if (filterCats.size && !filterCats.has(md.cat)) return false;
  const qq = query.trim().toLowerCase();
  if (!qq) return true;
  const labels = md.custom ? '' : md.V.map((_, i) => variantLabel(md, i)).join(' ');
  return `${md.name} ${md.cat} ${md.tags || ''} ${labels}`.toLowerCase().includes(qq);
}
function sorted(list) {
  const s = [...list];
  const kg = md => summaryOf(md, vOf(md)).kg, bars = md => summaryOf(md, vOf(md)).bars;
  if (sortKey === 'nome') s.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  if (sortKey === 'leve') s.sort((a, b) => kg(a) - kg(b));
  if (sortKey === 'pesado') s.sort((a, b) => kg(b) - kg(a));
  if (sortKey === 'barras') s.sort((a, b) => bars(a) - bars(b));
  return s;
}
function cardHTML(md) {
  const vi = vOf(md), title = titleOf(md, vi);
  const opts = md.custom ? `<option>${esc(md.fmt)} enviado por você</option>` : md.V.map((_, i) => `<option value="${i}"${i === vi ? ' selected' : ''}>${esc(md.name)} ${esc(variantLabel(md, i))}</option>`).join('');
  const hasSkp = !md.custom && skpIndex[skpKey(md, vi)];
  return `<article class="card" data-id="${md.id}">
    <button class="card-open" aria-label="Abrir ${esc(title)}"><div class="thumb">${thumbHTML(md, vi)}</div></button>
    <div class="card-body"><h3 title="${esc(title)}">${esc(title)}</h3><p class="sub">${esc(subOf(md))}</p></div>
    <div class="card-var"><select data-var aria-label="Medida de ${esc(md.name)}"${md.custom ? ' disabled' : ''}>${opts}</select></div>
    <div class="card-act">
      <button class="ico fav" data-fav aria-pressed="${saved.has(md.id)}" aria-label="${saved.has(md.id) ? 'Remover de' : 'Salvar em'} Minhas soluções">${ICON_HEART}</button>
      <button class="ico" data-dl aria-label="Baixar ${esc(title)} para o SketchUp" title="${hasSkp ? 'Baixar .skp' : 'Baixar para o SketchUp (.dae)'}">${ICON_DL}</button>
    </div>
  </article>`;
}
const ADD_CARD = '<button class="card add-card" id="add-card"><span class="plus" aria-hidden="true">+</span><b>Adicionar estrutura</b><span>Envie um .dae do SketchUp, um .dxf, .obj ou .stl</span></button>';
function renderList() {
  const base = tabModels();
  const cats = [...new Set(base.map(x => x.cat))];
  if (qcat !== 'Todos' && !cats.includes(qcat)) qcat = 'Todos';
  $('#chips').hidden = !quick;
  $('#chips').innerHTML = ['Todos', ...cats].map(c => `<button class="chip" data-chip="${esc(c)}" aria-pressed="${c === qcat}">${esc(c)}</button>`).join('');
  const list = sorted(base.filter(matches));
  $('#count').textContent = `${list.length} ${list.length === 1 ? 'modelo' : 'modelos'}`;
  let html;
  if (tab === 'minhas') {
    const mine = list.filter(x => x.custom), favs = list.filter(x => !x.custom);
    html = `<p class="sec-title">Favoritas</p>` + (favs.length ? favs.map(cardHTML).join('') : '<div class="empty">Toque no coração de um modelo para guardá-lo aqui.</div>')
      + `<p class="sec-title">Adicionadas por mim</p>${mine.map(cardHTML).join('')}${ADD_CARD}`;
  } else {
    html = (list.length ? list.map(cardHTML).join('') : `<div class="empty">Nenhum modelo encontrado${query ? ` para “${esc(query)}”` : ''}. Tente outro nome ou adicione a sua estrutura.</div>`) + ADD_CARD;
  }
  $('#grid').innerHTML = html;
  for (const md of list) queueThumb(md, vOf(md));
  $('#filter-n').hidden = !filterCats.size; $('#filter-n').textContent = filterCats.size;
  $('#sort-txt').textContent = sortKey === 'padrao' ? 'Ordenar' : SORTS[sortKey];
}
function setTab(t) {
  tab = t;
  document.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === t));
  closeDetail(false);
  $('#view-list').hidden = t === 'guia'; $('#view-guide').hidden = t !== 'guia';
  if (t !== 'guia') renderList();
}
document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => setTab(b.dataset.tab));
$('#home').onclick = () => setTab('produtos');
$('#q').addEventListener('input', e => {
  query = e.target.value;
  if (tab === 'guia') setTab('produtos'); else { closeDetail(false); renderList(); }
});
function setQuick(v) { quick = v; store.set('acervo.quick', v); $('#quick').setAttribute('aria-checked', v); $('#quick-txt').textContent = v ? 'Ligado' : 'Desligado'; if (!v) qcat = 'Todos'; renderList(); }
$('#quick').onclick = () => setQuick(!quick);
$('#chips').addEventListener('click', e => { const b = e.target.closest('[data-chip]'); if (b) { qcat = b.dataset.chip; renderList(); } });

function togglePop(btn, pop, fill) {
  const open = pop.hidden;
  document.querySelectorAll('.pop').forEach(p => p.hidden = true);
  document.querySelectorAll('.tool').forEach(b => b.setAttribute('aria-expanded', 'false'));
  if (!open) return;
  fill(); pop.hidden = false; btn.setAttribute('aria-expanded', 'true');
  pop.style.left = btn.offsetLeft + 'px';
}
$('#filter-btn').onclick = e => { e.stopPropagation(); togglePop($('#filter-btn'), $('#filter-pop'), () => {
  $('#filter-pop').innerHTML = allCats().map((c, i) => `<label><input type="checkbox" id="fc-${i}" value="${esc(c)}"${filterCats.has(c) ? ' checked' : ''}>${esc(c)}</label>`).join('')
    + '<div class="pop-foot"><button class="linkbtn" id="fc-clear">Limpar filtros</button><button class="linkbtn" id="fc-close">Fechar</button></div>';
}); };
$('#filter-pop').addEventListener('click', e => e.stopPropagation());
$('#filter-pop').addEventListener('change', e => { const v = e.target.value; e.target.checked ? filterCats.add(v) : filterCats.delete(v); renderList(); });
$('#filter-pop').addEventListener('click', e => {
  if (e.target.id === 'fc-clear') { filterCats.clear(); $('#filter-pop').querySelectorAll('input').forEach(i => i.checked = false); renderList(); }
  if (e.target.id === 'fc-close') $('#filter-pop').hidden = true;
});
$('#sort-btn').onclick = e => { e.stopPropagation(); togglePop($('#sort-btn'), $('#sort-pop'), () => {
  $('#sort-pop').innerHTML = Object.entries(SORTS).map(([k, v]) => `<label><input type="radio" name="ord" id="ord-${k}" value="${k}"${k === sortKey ? ' checked' : ''}>${v}</label>`).join('');
}); };
$('#sort-pop').addEventListener('click', e => e.stopPropagation());
$('#sort-pop').addEventListener('change', e => { sortKey = e.target.value; $('#sort-pop').hidden = true; renderList(); });
document.addEventListener('click', () => { document.querySelectorAll('.pop').forEach(p => p.hidden = true); document.querySelectorAll('.tool').forEach(b => b.setAttribute('aria-expanded', 'false')); });

$('#grid').addEventListener('change', e => {
  const sel = e.target.closest('[data-var]'); if (!sel) return;
  const card = sel.closest('.card'), md = byId(card.dataset.id), vi = +sel.value;
  selVar[md.id] = vi;
  const title = titleOf(md, vi);
  card.querySelector('h3').textContent = title; card.querySelector('h3').title = title;
  card.querySelector('.thumb').innerHTML = thumbHTML(md, vi);
  card.querySelector('[data-dl]').title = skpIndex[skpKey(md, vi)] ? 'Baixar .skp' : 'Baixar para o SketchUp (.dae)';
  queueThumb(md, vi);
});
$('#grid').addEventListener('click', e => {
  if (e.target.closest('#add-card')) return openAdd();
  const card = e.target.closest('.card'); if (!card || !card.dataset.id) return;
  const md = byId(card.dataset.id);
  if (e.target.closest('[data-fav]')) { toggleFav(md); if (tab === 'minhas') renderList(); else { const b = card.querySelector('[data-fav]'); b.setAttribute('aria-pressed', saved.has(md.id)); b.setAttribute('aria-label', `${saved.has(md.id) ? 'Remover de' : 'Salvar em'} Minhas soluções`); } return; }
  if (e.target.closest('[data-dl]')) return downloadSketchUp(md, vOf(md));
  if (e.target.closest('.card-open, .card-body')) openModel(md.id);
});
function toggleFav(md) {
  saved.has(md.id) ? saved.delete(md.id) : saved.add(md.id);
  store.set('acervo.saved', [...saved]);
  toast(saved.has(md.id) ? 'Salvo em Minhas soluções' : 'Removido de Minhas soluções');
}

/* ---------- ficha do modelo ---------- */
const canvas = $('#stage');
const R = new THREE.WebGLRenderer({ canvas, antialias: true });
R.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
const cam = new THREE.PerspectiveCamera(35, 1, .1, 1000);
const controls = new THREE.OrbitControls(cam, canvas);
controls.enableDamping = true; controls.dampingFactor = .08; controls.autoRotateSpeed = 1.2;
const scene = makeScene();
let obj = null, box = null, running = false, view = 'iso';
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas);
function loop() { if (!running) return; controls.update(); R.render(scene, cam); requestAnimationFrame(loop); }

function rebuild(refit) {
  if (obj) { scene.remove(obj); disposeGroup(obj); }
  members = cur.user ? [] : cur.build(params);
  const r = buildObject(cur, members, prof, hidden, style, true);
  obj = r.group; box = r.box; scene.add(obj);
  R.setClearColor(COL.stage);
  if (refit) { resize(); fit(cam, box, view, controls.target); }
  const s = box.getSize(new THREE.Vector3());
  $('#dims').textContent = `${fmt(s.x)} × ${fmt(s.z)} × ${fmt(s.y)} m`;
  if (!cur.user) renderBom();
  renderDownloadInfo();
}
function renderDownloadInfo() {
  const key = !cur.custom && !custom ? skpKey(cur, curVar) : null, skp = key && skpIndex[key];
  $('#d-skp').textContent = skp ? 'Baixar para SketchUp (.skp)' : 'Baixar para SketchUp (.dae)';
  $('#d-dlnote').textContent = skp ? 'Abre direto no SketchUp 2017 ou mais novo. Cada barra vem como grupo, com etiqueta por tipo.'
    : custom ? 'Medida personalizada: baixa em .dae. No SketchUp, use Arquivo › Importar › COLLADA.'
    : cur.custom ? 'Estrutura adicionada por você: baixa em .dae. No SketchUp, use Arquivo › Importar › COLLADA.'
    : 'O .skp desta medida ainda não foi publicado. Por enquanto baixa em .dae: no SketchUp, use Arquivo › Importar › COLLADA.';
}
function renderLegend() {
  $('#legend').innerHTML = cur.user ? '' : cur.types.map(t => `<button data-t="${esc(t)}" aria-pressed="${!hidden.has(t)}"><span class="dot" style="background:${typeColor(cur, t)}"></span>${esc(t)}</button>`).join('');
}
const pval = (p, v) => p.u === 'liga' ? (v ? 'sim' : 'não') : `${fmt(v, p.step % 1 ? (p.step < .1 || p.step === .25 ? 2 : 1) : 0)}${p.u ? ' ' + p.u : ''}`;
function renderParams() {
  $('#params').innerHTML = cur.params.map(p => `<div class="prm"><label for="p-${p.k}"><span>${esc(p.label)}</span><output id="o-${p.k}">${pval(p, params[p.k])}</output></label>
    <input type="range" id="p-${p.k}" data-k="${p.k}" min="${p.min}" max="${p.max}" step="${p.step}" value="${params[p.k]}"></div>`).join('');
}
function renderVarSelect() {
  $('#d-var-wrap').hidden = !!cur.custom;
  if (cur.custom) return;
  $('#d-var').innerHTML = cur.V.map((_, i) => `<option value="${i}"${!custom && i === curVar ? ' selected' : ''}>${esc(cur.name)} ${esc(variantLabel(cur, i))}</option>`).join('')
    + (custom ? '<option value="" selected>Medida personalizada</option>' : '');
}
function renderBom() {
  const rows = bom(cur, members, prof);
  const tl = rows.reduce((s, r) => s + r.len, 0), tk = rows.reduce((s, r) => s + r.kg, 0);
  $('#bom').innerHTML = rows.map((r, i) => `<tr>
    <td><span class="el"><span class="dot" style="background:${typeColor(cur, r.t)}"></span>${esc(r.t)}</span></td>
    <td><select id="perf-${i}" data-t="${esc(r.t)}" aria-label="Perfil de ${esc(r.t)}">${PERFIS.map(p => `<option value="${p.id}"${p.id === prof[r.t] ? ' selected' : ''}>${p.nome}</option>`).join('')}</select></td>
    <td class="n">${r.n}</td><td class="n">${fmt(r.len)}</td><td class="n">${fmt(r.kg, 0)}</td></tr>`).join('');
  $('#bom-foot').innerHTML = `<tr><td colspan="2">Total</td><td class="n">${members.length}</td><td class="n">${fmt(tl)}</td><td class="n">${fmt(tk, 0)}</td></tr>`;
  const s = box.getSize(new THREE.Vector3()), area = s.x * Math.max(s.z, 0);
  const third = area > 1 ? ['kg/m² em planta', fmt(tk / area, 1)] : ['kg por metro de vão', fmt(tk / Math.max(s.x, 1), 1)];
  $('#totals').innerHTML = `<div><span>Nós</span><b>${uniqueNodes(members)}</b></div><div><span>Peso total</span><b>${fmt(tk / 1000, 2)} t</b></div><div><span>${third[0]}</span><b>${third[1]}</b></div>`;
}
function setStyleBtns() {
  document.querySelectorAll('#views [data-v]').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === 'spin' ? controls.autoRotate : b.dataset.v === view));
  document.querySelectorAll('#views [data-s]').forEach(b => b.setAttribute('aria-pressed', b.dataset.s === style));
}
function openModel(id) {
  cur = byId(id); if (!cur) return;
  curVar = vOf(cur); custom = false;
  params = cur.custom ? {} : variantParams(cur, curVar);
  prof = { ...(cur.prof || {}) }; hidden = new Set(); view = 'iso';
  $('#view-list').hidden = true; $('#view-guide').hidden = true; $('#view-det').hidden = false;
  $('#d-cat').textContent = subOf(cur); $('#d-name').textContent = titleOf(cur, curVar); $('#d-desc').textContent = cur.desc;
  $('#fav').setAttribute('aria-pressed', saved.has(id));
  $('#sec-params').hidden = !cur.params.length;
  $('#sec-bom').hidden = !!cur.user;
  $('#sec-imp').hidden = !cur.custom;
  $('#del-row').hidden = false; $('#del-confirm').hidden = true;
  document.querySelectorAll('[data-exp]').forEach(b => b.hidden = cur.user && !['obj', 'dae'].includes(b.dataset.exp));
  if (cur.custom) {
    const when = cur.rec?.created ? new Date(cur.rec.created).toLocaleDateString('pt-BR') : 'hoje';
    $('#imp-info').textContent = cur.user
      ? `Arquivo ${cur.rec.fileName} (${cur.fmt}, ${fmt(cur.tris, 0)} triângulos), adicionado em ${when}. Para ter lista de materiais e peso, envie a estrutura em DXF com linhas de eixo. Fica salva neste navegador.`
      : `Arquivo ${cur.rec.fileName} com ${cur.build().length} barras em ${cur.types.length} camadas, adicionado em ${when}. Troque os perfis na lista de materiais. Fica salva neste navegador.`;
  }
  setStyleBtns(); renderVarSelect(); renderParams(); renderLegend();
  window.scrollTo({ top: 0 });
  requestAnimationFrame(() => { rebuild(true); if (!running) { running = true; loop(); } });
}
function closeDetail(render = true) {
  if ($('#view-det').hidden) return;
  running = false; controls.autoRotate = false;
  $('#view-det').hidden = true; $('#view-list').hidden = tab === 'guia'; $('#view-guide').hidden = tab !== 'guia';
  if (render && tab !== 'guia') renderList();
}
$('#back').onclick = () => closeDetail();
$('#d-var').onchange = e => {
  if (e.target.value === '') return;
  curVar = +e.target.value; custom = false; selVar[cur.id] = curVar;
  params = variantParams(cur, curVar);
  $('#d-name').textContent = titleOf(cur, curVar);
  renderVarSelect(); renderParams(); rebuild(true);
};
$('#params').addEventListener('input', e => {
  const k = e.target.dataset.k; if (!k) return;
  const p = cur.params.find(x => x.k === k);
  params[k] = +e.target.value; $('#o-' + k).textContent = pval(p, params[k]);
  const was = custom;
  custom = cur.params.some((q, i) => params[q.k] !== cur.V[curVar][i]);
  if (was !== custom) renderVarSelect();
  $('#d-name').textContent = custom ? `${cur.name} (personalizada)` : titleOf(cur, curVar);
  rebuild(false);
});
$('#params').addEventListener('change', () => fit(cam, box, view, controls.target));
$('#reset').onclick = () => { custom = false; params = variantParams(cur, curVar); prof = { ...cur.prof }; $('#d-name').textContent = titleOf(cur, curVar); renderVarSelect(); renderParams(); rebuild(true); };
$('#bom').addEventListener('change', e => { if (e.target.dataset.t) { prof[e.target.dataset.t] = e.target.value; rebuild(false); } });
$('#legend').addEventListener('click', e => {
  const b = e.target.closest('[data-t]'); if (!b) return;
  const t = b.dataset.t; hidden.has(t) ? hidden.delete(t) : hidden.add(t);
  b.setAttribute('aria-pressed', !hidden.has(t)); rebuild(false);
});
$('#views').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.s) { style = b.dataset.s; rebuild(false); }
  else if (b.dataset.v === 'spin') controls.autoRotate = !controls.autoRotate;
  else { view = b.dataset.v; fit(cam, box, view, controls.target); }
  setStyleBtns();
});
$('#fav').onclick = () => { toggleFav(cur); $('#fav').setAttribute('aria-pressed', saved.has(cur.id)); };
$('#d-skp').onclick = () => {
  if (!cur.custom && !custom && skpIndex[skpKey(cur, curVar)]) return downloadSketchUp(cur, curVar);
  exportFile('dae', cur, members, prof, params, custom ? `${cur.name} personalizada` : titleOf(cur, curVar));
};
document.querySelectorAll('[data-exp]').forEach(b => b.addEventListener('click', () =>
  exportFile(b.dataset.exp, cur, members, prof, params, custom ? `${cur.name} personalizada` : titleOf(cur, curVar))));

/* ---------- exportação ---------- */
const n3 = v => (Math.round(v * 1e4) / 1e4).toString();
const UPX = new THREE.Vector3(1, 0, 0);
function barCorners(x, h) {
  const A = new THREE.Vector3(...x.a), B = new THREE.Vector3(...x.b), u = new THREE.Vector3().subVectors(B, A).normalize();
  const v = new THREE.Vector3().crossVectors(u, Math.abs(u.y) < .9 ? UP : UPX).normalize().multiplyScalar(h);
  const w = new THREE.Vector3().crossVectors(u, v).normalize().multiplyScalar(h);
  const out = [];
  for (const P0 of [A, B]) for (const [s1, s2] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) out.push(P0.clone().addScaledVector(v, s1).addScaledVector(w, s2));
  return out;
}
function meshTriangles(md) {
  const tris = [];
  md.object.updateMatrixWorld(true);
  md.object.traverse(o => {
    if (!o.isMesh) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry, pa = g.attributes.position;
    const pos = [];
    for (let i = 0; i < pa.count; i++) pos.push(new THREE.Vector3().fromBufferAttribute(pa, i).applyMatrix4(o.matrixWorld));
    tris.push(pos);
  });
  return tris;
}
function toOBJ(md, mem, pm, prm) {
  let out = `# ${md.name} — Tess Architecture\n# unidades: metros, Y para cima\n`, vi = 1;
  if (md.user) {
    for (const pos of meshTriangles(md)) {
      pos.forEach(p => out += `v ${n3(p.x)} ${n3(p.y)} ${n3(p.z)}\n`);
      for (let i = 0; i < pos.length; i += 3) out += `f ${vi + i} ${vi + i + 1} ${vi + i + 2}\n`;
      vi += pos.length;
    }
    return out;
  }
  out += `# ${Object.entries(prm).map(([k, v]) => k + '=' + v).join(' ')}\n`;
  const groups = {};
  for (const x of mem) (groups[x.t] ||= []).push(x);
  for (const t in groups) {
    out += `g ${t.replace(/\s+/g, '_')}\n`;
    const h = (PF[pm[t]]?.d || .05) / 2;
    for (const x of groups[t]) {
      barCorners(x, h).forEach(p => out += `v ${n3(p.x)} ${n3(p.y)} ${n3(p.z)}\n`);
      const o = vi; vi += 8;
      out += `f ${o} ${o + 3} ${o + 2} ${o + 1}\nf ${o + 4} ${o + 5} ${o + 6} ${o + 7}\n`;
      for (let k = 0; k < 4; k++) { const k2 = (k + 1) % 4; out += `f ${o + k} ${o + k2} ${o + 4 + k2} ${o + 4 + k}\n`; }
    }
  }
  return out;
}
function toDXF(md, mem) {
  let out = '0\nSECTION\n2\nENTITIES\n';
  for (const x of mem) {
    const L = x.t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_').toUpperCase();
    out += `0\nLINE\n8\n${L}\n10\n${n3(x.a[0])}\n20\n${n3(-x.a[2])}\n30\n${n3(x.a[1])}\n11\n${n3(x.b[0])}\n21\n${n3(-x.b[2])}\n31\n${n3(x.b[1])}\n`;
  }
  return out + '0\nENDSEC\n0\nEOF\n';
}
function toCSV(md, mem, pm) {
  return '﻿elemento;perfil;kg_m;quantidade;comprimento_m;peso_kg\n' + bom(md, mem, pm).map(r => [r.t, PF[pm[r.t]].nome, fmt(PF[pm[r.t]].kg, 2), r.n, fmt(r.len, 2), fmt(r.kg, 1)].join(';')).join('\n');
}
/* Collada (.dae): o SketchUp importa em Arquivo › Importar. Z para cima, metros, cada barra um grupo. */
const xesc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
const zup = p => `${n3(p.x)} ${n3(-p.z)} ${n3(p.y)}`;
const BOX_TRIS = [0, 3, 2, 0, 2, 1, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7].join(' ');
function daeGeometry(id, name, pos, tris) {
  return `<geometry id="${id}" name="${xesc(name)}"><mesh>
<source id="${id}-p"><float_array id="${id}-a" count="${pos.length * 3}">${pos.map(zup).join(' ')}</float_array><technique_common><accessor source="#${id}-a" count="${pos.length}" stride="3"><param name="X" type="float"/><param name="Y" type="float"/><param name="Z" type="float"/></accessor></technique_common></source>
<vertices id="${id}-v"><input semantic="POSITION" source="#${id}-p"/></vertices>
<triangles material="mat" count="${tris.split(' ').length / 3}"><input semantic="VERTEX" source="#${id}-v" offset="0"/><p>${tris}</p></triangles>
</mesh></geometry>\n`;
}
const daeInst = (gid, mid) => `<instance_geometry url="#${gid}"><bind_material><technique_common><instance_material symbol="mat" target="#${mid}"/></technique_common></bind_material></instance_geometry>`;
function toDAE(md, mem, pm, prm, title) {
  const now = new Date().toISOString(), mats = [], geos = [];
  let nodes = '', gi = 0;
  const addMat = (i, name, hex) => { const c = new THREE.Color(hex); mats.push({ id: 'm' + i, name, rgb: `${c.r.toFixed(3)} ${c.g.toFixed(3)} ${c.b.toFixed(3)}` }); return 'm' + i; };
  if (md.user) {
    const mid = addMat(0, 'modelo', '#dfe3e6');
    for (const pos of meshTriangles(md)) {
      const gid = 'g' + gi++;
      geos.push(daeGeometry(gid, md.name, pos, pos.map((_, i) => i).join(' ')));
      nodes += `<node id="n${gid}" name="${xesc(md.name)}">${daeInst(gid, mid)}</node>\n`;
    }
  } else {
    const groups = {};
    for (const x of mem) (groups[x.t] ||= []).push(x);
    md.types.forEach((t, ti) => {
      if (!groups[t]) return;
      const pf = PF[pm[t]], mid = addMat(ti, `${t} - ${pf?.nome || ''}`, CORES[ti % CORES.length]), h = (pf?.d || .05) / 2;
      nodes += `<node id="t${ti}" name="${xesc(t)} (${xesc(pf?.nome || '')})">\n`;
      groups[t].forEach((x, k) => {
        const gid = 'g' + gi++;
        geos.push(daeGeometry(gid, `${t} ${k + 1}`, barCorners(x, h), BOX_TRIS));
        nodes += `<node id="n${gid}" name="${xesc(t)} ${k + 1}">${daeInst(gid, mid)}</node>\n`;
      });
      nodes += '</node>\n';
    });
  }
  return `<?xml version="1.0" encoding="utf-8"?>
<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1">
<asset><contributor><authoring_tool>Tess Architecture</authoring_tool><comments>${xesc(title || md.name)} ${xesc(Object.entries(prm).map(([k, v]) => k + '=' + v).join(' '))}</comments></contributor><created>${now}</created><modified>${now}</modified><unit name="meter" meter="1"/><up_axis>Z_UP</up_axis></asset>
<library_effects>${mats.map(x => `<effect id="${x.id}-fx"><profile_COMMON><technique sid="common"><lambert><diffuse><color>${x.rgb} 1</color></diffuse></lambert></technique></profile_COMMON></effect>`).join('')}</library_effects>
<library_materials>${mats.map(x => `<material id="${x.id}" name="${xesc(x.name)}"><instance_effect url="#${x.id}-fx"/></material>`).join('')}</library_materials>
<library_geometries>
${geos.join('')}</library_geometries>
<library_visual_scenes><visual_scene id="Scene" name="Scene"><node id="root" name="${xesc(title || md.name)}">
${nodes}</node></visual_scene></library_visual_scenes>
<scene><instance_visual_scene url="#Scene"/></scene>
</COLLADA>
`;
}
const MIME = { dae: 'model/vnd.collada+xml', obj: 'model/obj', dxf: 'application/dxf', csv: 'text/csv;charset=utf-8' };
const safeName = s => s.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();
function saveBlob(name, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
function exportFile(k, md, mem, pm, prm, title) {
  const txt = k === 'dae' ? toDAE(md, mem, pm, prm, title) : k === 'obj' ? toOBJ(md, mem, pm, prm) : k === 'dxf' ? toDXF(md, mem) : toCSV(md, mem, pm);
  const name = `${safeName(title || md.name)}.${k}`;
  saveBlob(name, new Blob([txt], { type: MIME[k] }));
  toast(k === 'dae' ? `Baixando ${name}. No SketchUp: Arquivo › Importar.` : `Baixando ${name}`);
}
function downloadSketchUp(md, vi) {
  const title = titleOf(md, vi), file = !md.custom && skpIndex[skpKey(md, vi)];
  if (file) {
    const a = document.createElement('a'); a.href = `skp/${file}`; a.download = `${safeName(title)}.skp`;
    document.body.appendChild(a); a.click(); a.remove();
    toast(`Baixando ${safeName(title)}.skp`);
    return;
  }
  const prm = md.custom ? {} : variantParams(md, vi), mem = md.user ? [] : md.build(prm);
  exportFile('dae', md, mem, { ...(md.prof || {}) }, prm, title);
}

/* ---------- adicionar estrutura ---------- */
/* Guardado no IndexedDB deste navegador: continua ao recarregar, mas não aparece para outras pessoas. */
const idb = (() => {
  let p;
  const open = () => p ||= new Promise((res, rej) => {
    const r = indexedDB.open('acervo-estruturas', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('estruturas', { keyPath: 'id' });
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  const tx = async (mode, fn) => {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction('estruturas', mode), r = fn(t.objectStore('estruturas'));
      t.oncomplete = () => res(r?.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    });
  };
  return { all: () => tx('readonly', s => s.getAll()), put: rec => tx('readwrite', s => s.put(rec)), del: id => tx('readwrite', s => s.delete(id)) };
})();
const layerType = l => { l = (l || '').trim(); return !l || l === '0' ? 'barra' : l.replace(/_/g, ' ').toLowerCase(); };
function parseDXF(text, k) {
  const L = text.split(/\r?\n/), ents = [];
  let e = null;
  for (let i = 0; i + 1 < L.length; i += 2) {
    const c = parseInt(L[i], 10), v = L[i + 1].trim();
    if (c === 0) { e = { type: v, g: [] }; ents.push(e); } else if (e) e.g.push([c, v]);
  }
  const raw = [];
  let sec = '', poly = null;
  const get = (en, c) => { const f = en.g.find(x => x[0] === c); return f ? f[1] : undefined; };
  const num = (en, c) => +(get(en, c) || 0);
  const closePoly = () => {
    if (!poly) return;
    const P = poly.pts;
    for (let i = 0; i + 1 < P.length; i++) raw.push([P[i], P[i + 1], poly.t]);
    if (poly.closed && P.length > 2) raw.push([P[P.length - 1], P[0], poly.t]);
    poly = null;
  };
  for (const en of ents) {
    if (en.type === 'SECTION') { sec = get(en, 2) || ''; continue; }
    if (sec !== 'ENTITIES') continue;
    if (en.type === 'LINE') raw.push([[num(en, 10), num(en, 20), num(en, 30)], [num(en, 11), num(en, 21), num(en, 31)], layerType(get(en, 8))]);
    else if (en.type === 'LWPOLYLINE') {
      const z = num(en, 38), pts = [];
      for (const [c, v] of en.g) { if (c === 10) pts.push([+v, 0, z]); else if (c === 20 && pts.length) pts[pts.length - 1][1] = +v; }
      poly = { pts, t: layerType(get(en, 8)), closed: num(en, 70) & 1 }; closePoly();
    } else if (en.type === 'POLYLINE') { closePoly(); poly = { pts: [], t: layerType(get(en, 8)), closed: num(en, 70) & 1 }; }
    else if (en.type === 'VERTEX' && poly) poly.pts.push([num(en, 10), num(en, 20), num(en, 30)]);
    else if (en.type === 'SEQEND') closePoly();
  }
  closePoly();
  /* DXF é Z para cima. Desenho 2D (tudo em Z=0) é tratado como elevação, em pé. */
  const flat = raw.every(([a, b]) => !a[2] && !b[2]);
  const conv = p => flat ? [p[0] * k, p[1] * k, 0] : [p[0] * k, p[2] * k, -p[1] * k];
  const mem = raw.map(([a, b, t]) => m(conv(a), conv(b), t)).filter(x => len(x) > 1e-6);
  if (!mem.length) return mem;
  const bb = bounds(mem), c = bb.getCenter(new THREE.Vector3());
  const sh = p => [p[0] - c.x, p[1] - bb.min.y, p[2] - c.z];
  return mem.map(x => m(sh(x.a), sh(x.b), x.t));
}
function recordToModel(rec) {
  const k = +rec.unit || 1, base = { id: rec.id, name: rec.name, cat: rec.cat, desc: rec.desc || '', tags: rec.tags || '', custom: true, fmt: rec.fmt.toUpperCase(), rec, params: [], V: [[]], dv: 0 };
  if (rec.fmt === 'dxf') {
    const mem = parseDXF(rec.data, k);
    if (!mem.length) throw new Error('O DXF não tem linhas (LINE ou POLYLINE) na área de desenho.');
    const types = [...new Set(mem.map(x => x.t))];
    return { ...base, types, prof: Object.fromEntries(types.map(t => [t, rec.prof || 'L50'])), build: () => mem };
  }
  let object;
  if (rec.fmt === 'stl') { const geo = new THREE.STLLoader().parse(rec.data); geo.computeVertexNormals(); object = new THREE.Mesh(geo); }
  else if (rec.fmt === 'obj') object = new THREE.OBJLoader().parse(rec.data);
  else if (rec.fmt === 'dae') {
    if (!THREE.ColladaLoader) throw new Error('O leitor de .dae não carregou. Verifique a internet e tente de novo.');
    object = new THREE.ColladaLoader().parse(rec.data, '').scene;
  } else throw new Error('Formato não aceito. Use .dae, .dxf, .obj ou .stl.');
  if (rec.fmt !== 'dae') object.scale.setScalar(k);
  let tris = 0;
  object.traverse(o => { if (o.isMesh) { const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; } });
  if (!tris) throw new Error('O arquivo não tem faces 3D para mostrar.');
  const g = new THREE.Group(); g.add(object); g.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(g), c = bb.getCenter(new THREE.Vector3());
  object.position.sub(new THREE.Vector3(c.x, bb.min.y, c.z));
  return { ...base, user: true, object: g, tris, types: [] };
}

const dlg = $('#add-dlg'), ACCEPT = ['dae', 'dxf', 'obj', 'stl'];
let pending = null;
function openAdd() {
  $('#add-form').reset(); pending = null;
  $('#drop').classList.remove('ok'); $('#drop-t').textContent = 'Arraste o arquivo aqui ou clique para escolher';
  addError('');
  const pre = allCats().includes(qcat) ? qcat : CATS[0];
  $('#f-cat').innerHTML = allCats().map(c => `<option${c === pre ? ' selected' : ''}>${esc(c)}</option>`).join('') + '<option value="__nova">+ Nova categoria…</option>';
  $('#f-prof').innerHTML = PERFIS.map(p => `<option value="${p.id}">${p.nome} (${fmt(p.kg, 2)} kg/m)</option>`).join('');
  syncAddFields();
  if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
}
function closeAdd() { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); }
function syncAddFields() {
  const f = pending?.fmt;
  $('#f-newcat-wrap').hidden = $('#f-cat').value !== '__nova';
  $('#f-unit-wrap').hidden = !f || f === 'dae';
  $('#f-prof-wrap').hidden = f !== 'dxf';
}
function addError(msg) { $('#add-err').textContent = msg; $('#add-err').hidden = !msg; }
async function takeFile(f) {
  addError('');
  const ext = (f.name.split('.').pop() || '').toLowerCase();
  if (!ACCEPT.includes(ext)) { pending = null; syncAddFields(); return addError(`“${f.name}” não é aceito. Envie .dae (SketchUp), .dxf, .obj ou .stl.`); }
  try {
    const data = ext === 'stl' ? await f.arrayBuffer() : await f.text();
    pending = { fmt: ext, fileName: f.name, data };
    const probe = recordToModel({ id: 'probe', name: '', cat: '', fmt: ext, data, unit: 1 });
    const s = (probe.user ? new THREE.Box3().setFromObject(probe.object) : bounds(probe.build())).getSize(new THREE.Vector3());
    const big = Math.max(s.x, s.y, s.z);
    $('#f-unit').value = big >= 2000 ? '0.001' : big >= 200 ? '0.01' : '1';
    $('#drop').classList.add('ok');
    $('#drop-t').textContent = `${f.name} · ${probe.user ? fmt(probe.tris, 0) + ' triângulos' : probe.build().length + ' barras em ' + probe.types.length + ' camadas'}`;
    if (!$('#f-name').value.trim()) $('#f-name').value = f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
  } catch (err) {
    pending = null; $('#drop').classList.remove('ok');
    $('#drop-t').textContent = 'Arraste o arquivo aqui ou clique para escolher';
    addError(`Não consegui ler “${f.name}”. ${err.message || ''}`);
  }
  syncAddFields();
}
$('#add-open').onclick = openAdd;
$('#add-x').onclick = closeAdd; $('#add-cancel').onclick = closeAdd;
$('#f-cat').onchange = () => { syncAddFields(); if (!$('#f-newcat-wrap').hidden) $('#f-newcat').focus(); };
$('#f-file').onchange = e => { const f = e.target.files[0]; if (f) takeFile(f); };
const drop = $('#drop');
['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, () => drop.classList.remove('over')));
drop.addEventListener('drop', e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) takeFile(f); });
$('#add-form').addEventListener('submit', async e => {
  e.preventDefault();
  const name = $('#f-name').value.trim();
  const catV = $('#f-cat').value === '__nova' ? $('#f-newcat').value.trim() : $('#f-cat').value;
  if (!pending) return addError('Escolha o arquivo da estrutura.');
  if (!name) { $('#f-name').focus(); return addError('Dê um nome para a estrutura.'); }
  if (!catV) { $('#f-newcat').focus(); return addError('Escreva o nome da nova categoria.'); }
  const rec = { id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, cat: catV,
    desc: $('#f-desc').value.trim() || `Estrutura adicionada a partir de ${pending.fileName}.`, tags: $('#f-tags').value.trim(),
    fmt: pending.fmt, fileName: pending.fileName, data: pending.data, unit: pending.fmt === 'dae' ? 1 : +$('#f-unit').value, prof: $('#f-prof').value, created: new Date().toISOString() };
  let md;
  try { md = recordToModel(rec); } catch (err) { return addError(err.message); }
  let kept = true;
  try { await idb.put(rec); } catch { kept = false; }
  userModels.push(md);
  closeAdd();
  tab = 'minhas'; document.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === tab));
  query = ''; $('#q').value = '';
  openModel(md.id);
  toast(kept ? `“${name}” adicionada em Minhas soluções` : `“${name}” adicionada, mas este navegador não deixou salvar: ela some ao recarregar.`);
});
$('#del').onclick = () => { $('#del-row').hidden = true; $('#del-confirm').hidden = false; };
$('#del-no').onclick = () => { $('#del-row').hidden = false; $('#del-confirm').hidden = true; };
$('#del-yes').onclick = async () => {
  const md = cur, i = userModels.indexOf(md);
  if (i >= 0) userModels.splice(i, 1);
  saved.delete(md.id); store.set('acervo.saved', [...saved]);
  delete thumbs[md.id + ':0']; delete summaries[md.id + ':0'];
  try { await idb.del(md.id); } catch {}
  toast(`“${md.name}” excluída`);
  closeDetail();
};

/* ---------- utilitários e início ---------- */
let tt;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => t.hidden = true, 3200); }
function retheme() {
  readColors();
  for (const k in thumbs) delete thumbs[k];
  if (!$('#view-list').hidden) renderList();
  if (cur && !$('#view-det').hidden) { renderLegend(); rebuild(false); }
}
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', retheme);
new MutationObserver(retheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

readColors();
$('#quick').setAttribute('aria-checked', quick); $('#quick-txt').textContent = quick ? 'Ligado' : 'Desligado';
renderList();
fetch('skp/index.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : {}).then(j => {
  skpIndex = j || {};
  if (!$('#view-list').hidden) renderList();
  if (cur && !$('#view-det').hidden) renderDownloadInfo();
}).catch(() => {});
(async () => {
  let recs = [];
  try { recs = await idb.all(); } catch { return; }
  for (const rec of recs.sort((a, b) => (a.created || '').localeCompare(b.created || ''))) {
    try { userModels.push(recordToModel(rec)); } catch {}
  }
  if (recs.length && !$('#view-list').hidden) renderList();
})();
})();
