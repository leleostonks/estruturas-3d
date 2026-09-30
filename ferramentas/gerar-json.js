/* Gera skp/fonte/<modelo>-v<n>.json com as barras de cada variante do catálogo.
   O script gerar-skp.rb lê esses arquivos dentro do SketchUp e grava os .skp.
   Uso: node ferramentas/gerar-json.js */
const fs = require('fs');
const path = require('path');
const { MODELS, PF, CORES, variantParams, variantLabel, skpKey } = require('../js/modelos.js');

const raiz = path.join(__dirname, '..');
const destino = path.join(raiz, 'skp', 'fonte');
fs.mkdirSync(destino, { recursive: true });
for (const f of fs.readdirSync(destino)) if (f.endsWith('.json')) fs.unlinkSync(path.join(destino, f));

const r4 = v => Math.round(v * 1e4) / 1e4;
/* O app usa Y para cima; o SketchUp usa Z para cima. */
const zup = p => [r4(p[0]), r4(-p[2]), r4(p[1])];

let total = 0;
for (const md of MODELS) {
  md.V.forEach((_, vi) => {
    const prm = variantParams(md, vi), mem = md.build(prm);
    const nome = `${md.name} ${variantLabel(md, vi)}`;
    const tipos = md.types.map((t, i) => {
      const pf = PF[md.prof[t]];
      return { nome: t, perfil: pf.nome, d: pf.d, cor: CORES[i % CORES.length] };
    });
    const idx = Object.fromEntries(md.types.map((t, i) => [t, i]));
    const barras = mem.map(x => [...zup(x.a), ...zup(x.b), idx[x.t]]);
    const chave = skpKey(md, vi);
    fs.writeFileSync(path.join(destino, `${chave}.json`), JSON.stringify({ chave, arquivo: `${chave}.skp`, nome, parametros: prm, tipos, barras }));
    total++;
  });
}
console.log(`${total} variantes geradas em ${path.relative(raiz, destino)}`);
