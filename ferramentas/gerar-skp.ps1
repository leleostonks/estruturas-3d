# Gera todos os .skp do catálogo: monta as barras (Node) e abre o SketchUp para gravar os arquivos.
# Uso (na pasta do projeto):  pwsh ferramentas/gerar-skp.ps1
$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot

node (Join-Path $raiz 'ferramentas/gerar-json.js')

$sketchup = Get-ChildItem "$env:ProgramFiles\SketchUp" -Recurse -Filter SketchUp.exe -ErrorAction SilentlyContinue |
  Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName
if (-not $sketchup) { throw 'SketchUp não encontrado em Arquivos de Programas\SketchUp.' }
Write-Host "Usando $sketchup"

$rb = Join-Path $raiz 'ferramentas/gerar-skp.rb'
$env:ACERVO_FECHAR = '1'
$p = Start-Process -FilePath $sketchup -ArgumentList @('-RubyStartup', "`"$rb`"") -PassThru
$p | Wait-Process -Timeout 900 -ErrorAction SilentlyContinue
Get-Content (Join-Path $raiz 'skp/gerar-skp.log') -ErrorAction SilentlyContinue
