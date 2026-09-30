/* Catálogo de estruturas: perfis, geradores paramétricos e variantes.
   Usado pela página (window.ESTR) e pelo gerador de .skp (require em Node). */
(function (root) {
  const m = (a, b, t) => ({ a, b, t });
  const lerp = (a, b, t) => a + (b - a) * t;
  const f = v => (Math.round(v * 100) / 100).toString().replace('.', ',');

  /* ---------- perfis (kg/m nominal) ---------- */
  const PERFIS = [
    { id: 'L50', nome: 'Cantoneira L 50×5', kg: 3.77, d: .05 },
    { id: 'L76', nome: 'Cantoneira L 76×6,3', kg: 7.29, d: .076 },
    { id: 'TQ50', nome: 'Tubo quadrado 50×50×3', kg: 4.43, d: .05 },
    { id: 'TQ100', nome: 'Tubo quadrado 100×100×4', kg: 11.7, d: .1 },
    { id: 'TC60', nome: 'Tubo redondo Ø60,3×3,6', kg: 5.03, d: .06 },
    { id: 'U150', nome: 'U 152×12,2', kg: 12.2, d: .152 },
    { id: 'W150', nome: 'W 150×13', kg: 13.0, d: .15 },
    { id: 'W200', nome: 'W 200×22,5', kg: 22.5, d: .2 },
    { id: 'W250', nome: 'W 250×32,7', kg: 32.7, d: .25 },
    { id: 'W310', nome: 'W 310×38,7', kg: 38.7, d: .31 },
    { id: 'W360', nome: 'W 360×51', kg: 51.0, d: .355 },
  ];
  const PF = Object.fromEntries(PERFIS.map(p => [p.id, p]));
  /* cores por tipo de barra (índice na lista de tipos do modelo) */
  const CORES = ['#2d5c89', '#c98500', '#62717e', '#34876a', '#a44848', '#6f57a3'];

  /* ---------- geradores ---------- */
  function trussPlane(L, H, n, kind, z, out) {
    const dx = L / n, x0 = -L / 2;
    const B = i => [x0 + i * dx, 0, z], T = i => [x0 + i * dx, H, z];
    if (kind === 'warren') {
      const Tm = i => [x0 + (i + .5) * dx, H, z];
      for (let i = 0; i < n; i++) {
        out.push(m(B(i), B(i + 1), 'banzo inferior'), m(B(i), Tm(i), 'diagonal'), m(Tm(i), B(i + 1), 'diagonal'));
        if (i < n - 1) out.push(m(Tm(i), Tm(i + 1), 'banzo superior'));
      }
      return out;
    }
    for (let i = 0; i < n; i++) out.push(m(B(i), B(i + 1), 'banzo inferior'), m(T(i), T(i + 1), 'banzo superior'));
    for (let i = 0; i <= n; i++) out.push(m(B(i), T(i), 'montante'));
    if (kind === 'vierendeel') return out;
    for (let i = 0; i < n; i++) {
      const left = (i + .5) < n / 2;
      if (kind === 'pratt') out.push(left ? m(T(i), B(i + 1), 'diagonal') : m(B(i), T(i + 1), 'diagonal'));
      else out.push(left ? m(B(i), T(i + 1), 'diagonal') : m(T(i), B(i + 1), 'diagonal'));
    }
    return out;
  }
  const P = (k, label, min, max, step, u = 'm') => ({ k, label, min, max, step, u });
  const TRUSS_T = ['banzo superior', 'banzo inferior', 'montante', 'diagonal'];
  const TRUSS_PROF = { 'banzo superior': 'L76', 'banzo inferior': 'L76', 'montante': 'L50', 'diagonal': 'L50' };
  const TRUSS_P = [P('L', 'Vão', 4, 40, .5), P('H', 'Altura', .4, 5, .1), P('n', 'Painéis', 2, 24, 1, '')];

  /* grupo: 'produtos' = componentes (aba Catálogo de produtos); 'solucoes' = estruturas completas (aba Soluções clássicas).
     V: variantes prontas, na ordem de params. dv: variante padrão. lab: rótulo curto da variante. */
  const MODELS = [
    { id: 'pratt', name: 'Treliça Pratt', cat: 'Treliças planas', grupo: 'produtos', tags: 'viga treliçada banzo paralelo',
      desc: 'Banzos paralelos com diagonais tracionadas descendo para o centro. Boa para vãos médios com carga gravitacional.',
      params: TRUSS_P, V: [[8, 1, 6], [12, 1.5, 8], [18, 2, 10], [24, 2.5, 12]], dv: 1, lab: p => `${f(p.L)} × ${f(p.H)} m`,
      types: TRUSS_T, prof: TRUSS_PROF, build: p => trussPlane(p.L, p.H, p.n, 'pratt', 0, []) },
    { id: 'howe', name: 'Treliça Howe', cat: 'Treliças planas', grupo: 'produtos', tags: 'viga treliçada madeira',
      desc: 'Diagonais comprimidas subindo para o centro e montantes tracionados. Clássica em madeira.',
      params: TRUSS_P, V: [[8, 1, 6], [12, 1.5, 8], [18, 2, 10], [24, 2.5, 12]], dv: 1, lab: p => `${f(p.L)} × ${f(p.H)} m`,
      types: TRUSS_T, prof: TRUSS_PROF, build: p => trussPlane(p.L, p.H, p.n, 'howe', 0, []) },
    { id: 'warren', name: 'Treliça Warren', cat: 'Treliças planas', grupo: 'produtos', tags: 'viga treliçada triangular',
      desc: 'Triângulos alternados, sem montantes. Menos barras, e os esforços alternam tração e compressão.',
      params: [P('L', 'Vão', 4, 40, .5), P('H', 'Altura', .4, 5, .1), P('n', 'Módulos', 2, 24, 1, '')],
      V: [[10, 1.2, 6], [14, 1.4, 8], [20, 1.8, 10]], dv: 1, lab: p => `${f(p.L)} × ${f(p.H)} m`,
      types: ['banzo superior', 'banzo inferior', 'diagonal'], prof: TRUSS_PROF, build: p => trussPlane(p.L, p.H, p.n, 'warren', 0, []) },
    { id: 'vierendeel', name: 'Viga Vierendeel', cat: 'Treliças planas', grupo: 'produtos', tags: 'vierendeel quadro rígido aberturas',
      desc: 'Quadros rígidos sem diagonais. Libera passagem entre montantes; os nós trabalham à flexão.',
      params: [P('L', 'Vão', 4, 30, .5), P('H', 'Altura', .6, 4, .1), P('n', 'Painéis', 2, 16, 1, '')],
      V: [[6, 1.5, 3], [10, 2, 5], [14, 2.5, 7]], dv: 1, lab: p => `${f(p.L)} × ${f(p.H)} m`,
      types: ['banzo superior', 'banzo inferior', 'montante'], prof: { 'banzo superior': 'TQ100', 'banzo inferior': 'TQ100', 'montante': 'TQ100' },
      build: p => trussPlane(p.L, p.H, p.n, 'vierendeel', 0, []) },
    { id: 'tesoura', name: 'Tesoura de duas águas', cat: 'Coberturas', grupo: 'produtos', tags: 'telhado tesoura cobertura fink',
      desc: 'Tesoura triangular para telhado de duas águas, com montantes e diagonais em leque.',
      params: [P('L', 'Vão', 4, 30, .5), P('H', 'Altura da cumeeira', .5, 6, .1), P('n', 'Painéis (par)', 2, 20, 2, '')],
      V: [[6, 1.2, 6], [10, 2, 8], [15, 3, 10]], dv: 1, lab: p => `vão ${f(p.L)} m`,
      types: TRUSS_T, prof: TRUSS_PROF,
      build: ({ L, H, n }) => {
        const out = [], dx = L / n, x0 = -L / 2, y = x => H * (1 - Math.abs(x) / (L / 2));
        const B = i => [x0 + i * dx, 0, 0], T = i => { const x = x0 + i * dx; return [x, y(x), 0]; };
        for (let i = 0; i < n; i++) out.push(m(B(i), B(i + 1), 'banzo inferior'), m(T(i), T(i + 1), 'banzo superior'));
        for (let i = 1; i < n; i++) out.push(m(B(i), T(i), 'montante'));
        for (let i = 0; i < n; i++) {
          if (i < n / 2) { if (i > 0) out.push(m(T(i), B(i + 1), 'diagonal')); }
          else if (i + 1 < n) out.push(m(B(i), T(i + 1), 'diagonal'));
        }
        return out;
      } },
    { id: 'arco', name: 'Arco treliçado', cat: 'Coberturas', grupo: 'produtos', tags: 'arco parabólico cobertura curva',
      desc: 'Arco parabólico com seção treliçada de altura constante. Para coberturas curvas de grande vão.',
      params: [P('L', 'Vão', 10, 60, 1), P('f', 'Flecha', 2, 15, .5), P('h', 'Altura da seção', .4, 2.5, .1), P('n', 'Módulos', 6, 40, 1, '')],
      V: [[20, 5, .8, 16], [30, 7, 1, 20], [45, 10, 1.4, 26]], dv: 1, lab: p => `vão ${f(p.L)} m`,
      types: TRUSS_T, prof: { 'banzo superior': 'TC60', 'banzo inferior': 'TC60', 'montante': 'L50', 'diagonal': 'L50' },
      build: ({ L, f: fl, h, n }) => {
        const out = [], A = [], C = [];
        for (let i = 0; i <= n; i++) {
          const x = -L / 2 + i * L / n, yy = fl * (1 - (2 * x / L) ** 2), d = -8 * fl * x / (L * L), k = Math.hypot(d, 1);
          A.push([x, yy, 0]); C.push([x - d / k * h, yy + h / k, 0]);
        }
        for (let i = 0; i < n; i++) {
          out.push(m(A[i], A[i + 1], 'banzo inferior'), m(C[i], C[i + 1], 'banzo superior'));
          out.push(i % 2 ? m(C[i], A[i + 1], 'diagonal') : m(A[i], C[i + 1], 'diagonal'));
        }
        for (let i = 0; i <= n; i++) out.push(m(A[i], C[i], 'montante'));
        return out;
      } },
    { id: 'espacial', name: 'Estrutura espacial', cat: 'Coberturas', grupo: 'solucoes', tags: 'space frame malha espacial tubular',
      desc: 'Malha de pirâmides com banzos ortogonais em dois planos. Cobre grandes áreas com apoios espaçados.',
      params: [P('nx', 'Módulos em X', 2, 16, 1, ''), P('nz', 'Módulos em Z', 2, 16, 1, ''), P('a', 'Módulo', 1, 4, .25), P('h', 'Altura', .6, 3, .1)],
      V: [[6, 4, 2, 1.5], [8, 6, 2.5, 1.8], [12, 8, 2.5, 2]], dv: 1, lab: p => `${f(p.nx * p.a)} × ${f(p.nz * p.a)} m`,
      types: ['banzo superior', 'banzo inferior', 'diagonal'], prof: { 'banzo superior': 'TC60', 'banzo inferior': 'TC60', 'diagonal': 'TC60' },
      build: ({ nx, nz, a, h }) => {
        const out = [], x0 = -nx * a / 2, z0 = -nz * a / 2;
        const T = (i, j) => [x0 + i * a, h, z0 + j * a], B = (i, j) => [x0 + (i + .5) * a, 0, z0 + (j + .5) * a];
        for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) {
          if (i < nx) out.push(m(T(i, j), T(i + 1, j), 'banzo superior'));
          if (j < nz) out.push(m(T(i, j), T(i, j + 1), 'banzo superior'));
        }
        for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
          if (i + 1 < nx) out.push(m(B(i, j), B(i + 1, j), 'banzo inferior'));
          if (j + 1 < nz) out.push(m(B(i, j), B(i, j + 1), 'banzo inferior'));
          out.push(m(B(i, j), T(i, j), 'diagonal'), m(B(i, j), T(i + 1, j), 'diagonal'), m(B(i, j), T(i, j + 1), 'diagonal'), m(B(i, j), T(i + 1, j + 1), 'diagonal'));
        }
        return out;
      } },
    { id: 'galpao', name: 'Galpão em pórticos', cat: 'Galpões e edifícios', grupo: 'solucoes', tags: 'galpão barracão pórtico terça industrial',
      desc: 'Pórticos de alma cheia com terças, cumeeira e contraventamento em X nos vãos de extremidade.',
      params: [P('B', 'Vão (largura)', 8, 40, .5), P('C', 'Comprimento', 10, 90, 1), P('Hp', 'Altura do pilar', 3, 14, .25), P('i', 'Inclinação', 3, 30, 1, '%'), P('nb', 'Vãos entre pórticos', 2, 15, 1, '')],
      V: [[12, 24, 5, 10, 4], [20, 36, 7, 10, 6], [30, 60, 9, 8, 10]], dv: 1, lab: p => `${f(p.B)} × ${f(p.C)} m`,
      types: ['pilar', 'viga', 'terça', 'contravento'], prof: { pilar: 'W250', viga: 'W250', 'terça': 'U150', contravento: 'TC60' },
      build: ({ B, C, Hp, i, nb }) => {
        const out = [], e = C / nb, hr = Hp + B / 2 * i / 100, Z = k => -C / 2 + k * e;
        const eaveL = z => [-B / 2, Hp, z], eaveR = z => [B / 2, Hp, z], ridge = z => [0, hr, z];
        const along = (p, q, t) => p.map((v, k) => lerp(v, q[k], t));
        for (let k = 0; k <= nb; k++) {
          const z = Z(k);
          out.push(m([-B / 2, 0, z], eaveL(z), 'pilar'), m([B / 2, 0, z], eaveR(z), 'pilar'), m(eaveL(z), ridge(z), 'viga'), m(ridge(z), eaveR(z), 'viga'));
        }
        for (let k = 0; k < nb; k++) {
          const z1 = Z(k), z2 = Z(k + 1);
          for (const t of [0, 1 / 3, 2 / 3]) {
            out.push(m(along(eaveL(z1), ridge(z1), t), along(eaveL(z2), ridge(z2), t), 'terça'));
            out.push(m(along(eaveR(z1), ridge(z1), t), along(eaveR(z2), ridge(z2), t), 'terça'));
          }
          out.push(m(ridge(z1), ridge(z2), 'terça'));
          if (k === 0 || k === nb - 1) {
            for (const x of [-B / 2, B / 2]) out.push(m([x, 0, z1], [x, Hp, z2], 'contravento'), m([x, Hp, z1], [x, 0, z2], 'contravento'));
            out.push(m(eaveL(z1), ridge(z2), 'contravento'), m(ridge(z1), eaveL(z2), 'contravento'), m(eaveR(z1), ridge(z2), 'contravento'), m(ridge(z1), eaveR(z2), 'contravento'));
          }
        }
        return out;
      } },
    { id: 'edificio', name: 'Edifício em pórtico', cat: 'Galpões e edifícios', grupo: 'solucoes', tags: 'prédio pavimentos pilar viga contraventado',
      desc: 'Malha de pilares e vigas por pavimento, com contraventamento em X no vão central de cada fachada.',
      params: [P('nx', 'Vãos em X', 1, 8, 1, ''), P('nz', 'Vãos em Z', 1, 6, 1, ''), P('a', 'Vão', 3, 10, .5), P('h', 'Pé-direito', 2.6, 5, .1), P('np', 'Pavimentos', 1, 20, 1, ''), P('cv', 'Contraventamento', 0, 1, 1, 'liga')],
      V: [[2, 2, 5, 3, 3, 1], [4, 3, 6, 3.2, 6, 1], [5, 4, 7, 3.5, 10, 1]], dv: 1, lab: p => `${p.np} pavimentos`,
      types: ['pilar', 'viga', 'contravento'], prof: { pilar: 'W310', viga: 'W250', contravento: 'TC60' },
      build: ({ nx, nz, a, h, np, cv }) => {
        const out = [], x0 = -nx * a / 2, z0 = -nz * a / 2, X = i => x0 + i * a, Zc = j => z0 + j * a;
        for (let fl = 0; fl < np; fl++) for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) out.push(m([X(i), fl * h, Zc(j)], [X(i), (fl + 1) * h, Zc(j)], 'pilar'));
        for (let fl = 1; fl <= np; fl++) for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) {
          if (i < nx) out.push(m([X(i), fl * h, Zc(j)], [X(i + 1), fl * h, Zc(j)], 'viga'));
          if (j < nz) out.push(m([X(i), fl * h, Zc(j)], [X(i), fl * h, Zc(j + 1)], 'viga'));
        }
        if (cv) {
          const ci = Math.floor((nx - 1) / 2), cj = Math.floor((nz - 1) / 2);
          for (let fl = 0; fl < np; fl++) {
            const y1 = fl * h, y2 = (fl + 1) * h;
            for (const j of [0, nz]) out.push(m([X(ci), y1, Zc(j)], [X(ci + 1), y2, Zc(j)], 'contravento'), m([X(ci + 1), y1, Zc(j)], [X(ci), y2, Zc(j)], 'contravento'));
            for (const i of [0, nx]) out.push(m([X(i), y1, Zc(cj)], [X(i), y2, Zc(cj + 1)], 'contravento'), m([X(i), y1, Zc(cj + 1)], [X(i), y2, Zc(cj)], 'contravento'));
          }
        }
        return out;
      } },
    { id: 'torre', name: 'Torre treliçada', cat: 'Torres', grupo: 'solucoes', tags: 'torre autoportante telecomunicação antena',
      desc: 'Torre autoportante de seção quadrada com afunilamento e diagonais em X em todas as faces.',
      params: [P('H', 'Altura', 6, 80, 1), P('b', 'Base', 1.5, 12, .25), P('t', 'Topo', .8, 6, .1), P('n', 'Módulos', 3, 30, 1, '')],
      V: [[15, 3, 1, 6], [30, 6, 1.5, 10], [45, 8, 2, 15]], dv: 1, lab: p => `${f(p.H)} m de altura`,
      types: ['montante', 'horizontal', 'diagonal'], prof: { montante: 'L76', horizontal: 'L50', diagonal: 'L50' },
      build: ({ H, b, t, n }) => {
        const out = [], sg = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
        const c = (k, q) => { const s = lerp(b, t, k / n) / 2, [u, v] = sg[q % 4]; return [u * s, k * H / n, v * s]; };
        for (let k = 0; k <= n; k++) for (let q = 0; q < 4; q++) {
          out.push(m(c(k, q), c(k, q + 1), 'horizontal'));
          if (k < n) out.push(m(c(k, q), c(k + 1, q), 'montante'), m(c(k, q), c(k + 1, q + 1), 'diagonal'), m(c(k, q + 1), c(k + 1, q), 'diagonal'));
        }
        return out;
      } },
    { id: 'ponte', name: 'Ponte treliçada', cat: 'Pontes', grupo: 'solucoes', tags: 'ponte passarela pratt tabuleiro',
      desc: 'Duas treliças Pratt ligadas por transversinas no tabuleiro e contraventamento superior em X.',
      params: [P('L', 'Vão', 10, 80, 1), P('W', 'Largura', 2, 12, .5), P('H', 'Altura', 2, 10, .25), P('n', 'Painéis', 4, 20, 1, '')],
      V: [[20, 3, 3, 6], [36, 6, 5, 8], [50, 8, 6, 10]], dv: 1, lab: p => `vão ${f(p.L)} m`,
      types: ['banzo superior', 'banzo inferior', 'montante', 'diagonal', 'transversina', 'contravento'],
      prof: { 'banzo superior': 'W310', 'banzo inferior': 'W310', montante: 'W200', diagonal: 'W200', transversina: 'W360', contravento: 'L76' },
      build: ({ L, W, H, n }) => {
        const out = [];
        trussPlane(L, H, n, 'pratt', -W / 2, out); trussPlane(L, H, n, 'pratt', W / 2, out);
        const X = i => -L / 2 + i * L / n;
        for (let i = 0; i <= n; i++) {
          out.push(m([X(i), 0, -W / 2], [X(i), 0, W / 2], 'transversina'));
          if (i > 0 && i < n) out.push(m([X(i), H, -W / 2], [X(i), H, W / 2], 'contravento'));
        }
        for (let i = 1; i < n - 1; i++) out.push(m([X(i), H, -W / 2], [X(i + 1), H, W / 2], 'contravento'), m([X(i), H, W / 2], [X(i + 1), H, -W / 2], 'contravento'));
        return out;
      } },
  ];
  const CATS = ['Treliças planas', 'Coberturas', 'Galpões e edifícios', 'Torres', 'Pontes'];

  const variantParams = (md, vi) => Object.fromEntries(md.params.map((p, k) => [p.k, md.V[vi][k]]));
  const variantLabel = (md, vi) => md.lab(variantParams(md, vi));
  const skpKey = (md, vi) => `${md.id}-v${vi + 1}`;
  const len = x => Math.hypot(x.b[0] - x.a[0], x.b[1] - x.a[1], x.b[2] - x.a[2]);
  function bom(md, mem, pmap) {
    const rows = md.types.map(t => ({ t, n: 0, len: 0 }));
    const idx = Object.fromEntries(rows.map((r, i) => [r.t, i]));
    for (const x of mem) { const r = rows[idx[x.t]]; if (!r) continue; r.n++; r.len += len(x); }
    rows.forEach(r => r.kg = r.len * (PF[pmap[r.t]]?.kg || 0));
    return rows.filter(r => r.n);
  }

  const api = { m, lerp, PERFIS, PF, CORES, MODELS, CATS, variantParams, variantLabel, skpKey, bom, len };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ESTR = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
