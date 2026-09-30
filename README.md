# Tess Architecture — Catálogo de Estruturas

Biblioteca de estruturas metálicas 3D paramétricas (treliças, coberturas, galpões, edifícios, torres e pontes), com visualizador 3D, lista de materiais e download em:

- **SketchUp** (.dae / Collada): Arquivo › Importar
- **OBJ**: Blender, Revit, SketchUp Pro
- **DXF**: AutoCAD, FreeCAD, SAP2000 (linhas de eixo por camada)
- **CSV**: lista de materiais para planilha

Site estático de um arquivo (`index.html`). Hospedagem no Render via `render.yaml`.

## Arquivos .skp (SketchUp)

Cada modelo do catálogo tem medidas prontas (variantes), definidas em `js/modelos.js`. Os `.skp` delas são gerados com o próprio SketchUp:

1. `node ferramentas/gerar-json.js` monta as barras de cada variante em `skp/fonte/`.
2. `pwsh ferramentas/gerar-skp.ps1` abre o SketchUp, roda `ferramentas/gerar-skp.rb` e grava `skp/<modelo>-v<n>.skp` e `skp/index.json`.
   Também dá para rodar pelo SketchUp: Extensões › Console Ruby › `load 'C:/.../ferramentas/gerar-skp.rb'`.
3. Commit e push dos arquivos em `skp/`. O site passa a baixar o `.skp` dessas medidas; as demais baixam `.dae`.

## Publicar no Render

Static Site ligado a este repositório (`render.yaml`). Cada `git push` na branch `main` publica sozinho.
