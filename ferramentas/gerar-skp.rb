# Gera os arquivos .skp do catálogo dentro do SketchUp.
#
# Lê skp/fonte/*.json (criados por ferramentas/gerar-json.js) e grava skp/<chave>.skp.
# Cada barra vira um grupo com seção quadrada do perfil, dentro de um grupo por tipo
# (banzo, diagonal, pilar...), com etiqueta (tag) e material por tipo.
# No fim grava skp/index.json, que o site lê para saber quais .skp existem.
#
# Uso: rode ferramentas/gerar-skp.ps1, ou no SketchUp abra Extensões › Console Ruby e digite
#   load 'C:/Users/Leo/Documents/acervo-estruturas/ferramentas/gerar-skp.rb'
require 'json'

module AcervoEstruturas
  RAIZ = File.expand_path('..', File.dirname(__FILE__))
  FONTE = File.join(RAIZ, 'skp', 'fonte')
  SAIDA = File.join(RAIZ, 'skp')
  LOG = File.join(SAIDA, 'gerar-skp.log')
  CANTOS = [[1, 1], [-1, 1], [-1, -1], [1, -1]].freeze

  def self.log(msg)
    File.open(LOG, 'a:UTF-8') { |f| f.puts("#{Time.now.strftime('%H:%M:%S')} #{msg}") }
    puts msg
  end

  def self.limpar(model)
    model.entities.clear!
    model.definitions.purge_unused
    model.materials.purge_unused
    model.layers.purge_unused
  end

  def self.barra(ents, a, b, h)
    u = a.vector_to(b)
    return false if u.length < 0.001
    u.normalize!
    ref = u.parallel?(Z_AXIS) ? X_AXIS : Z_AXIS
    v = u.cross(ref).normalize
    w = u.cross(v).normalize
    ab = a.vector_to(b)
    pa = CANTOS.map { |s1, s2| a.offset(Geom::Vector3d.linear_combination(s1 * h, v, s2 * h, w)) }
    pb = pa.map { |p| p.offset(ab) }
    ents.add_face(pa)
    ents.add_face(pb)
    4.times do |k|
      k2 = (k + 1) % 4
      ents.add_face(pa[k], pa[k2], pb[k2], pb[k])
    end
    true
  end

  def self.gerar_um(model, dados)
    limpar(model)
    model.start_operation('Gerar estrutura', true)
    raiz = model.entities.add_group
    raiz.name = dados['nome']
    tipos = dados['tipos'].map do |t|
      mat = model.materials[t['nome']] || model.materials.add(t['nome'])
      mat.color = Sketchup::Color.new(t['cor'])
      tag = model.layers[t['nome']] || model.layers.add(t['nome'])
      grupo = raiz.entities.add_group
      grupo.name = "#{t['nome']} (#{t['perfil']})"
      grupo.layer = tag
      { nome: t['nome'], mat: mat, tag: tag, h: (t['d'].to_f / 2.0).m, grupo: grupo, n: 0 }
    end
    dados['barras'].each do |b|
      tp = tipos[b[6]]
      g = tp[:grupo].entities.add_group
      a = Geom::Point3d.new(b[0].m, b[1].m, b[2].m)
      c = Geom::Point3d.new(b[3].m, b[4].m, b[5].m)
      if barra(g.entities, a, c, tp[:h])
        tp[:n] += 1
        g.name = "#{tp[:nome]} #{tp[:n]}"
        g.material = tp[:mat]
        g.layer = tp[:tag]
      else
        g.erase!
      end
    end
    tipos.each { |tp| tp[:grupo].erase! if tp[:n].zero? }
    model.commit_operation
    model.active_view.zoom_extents
  end

  def self.salvar(model, caminho)
    # Formato 2017: abre no SketchUp 2017 em diante (Make, Free e Pro).
    if defined?(Sketchup::Model::VERSION_2017)
      model.save(caminho, Sketchup::Model::VERSION_2017)
    else
      model.save(caminho)
    end
  end

  def self.executar
    File.write(LOG, '', encoding: 'UTF-8')
    model = Sketchup.active_model
    unless model
      log('ERRO: nenhum modelo aberto no SketchUp. Abra um modelo em branco e rode de novo.')
      return
    end
    model.options['UnitsOptions']['LengthUnit'] = 4 # metros
    manifesto = {}
    arquivos = Dir.glob(File.join(FONTE, '*.json')).sort
    log("Gerando #{arquivos.size} arquivos .skp em #{SAIDA}")
    arquivos.each do |arq|
      dados = JSON.parse(File.read(arq, encoding: 'UTF-8'))
      destino = File.join(SAIDA, dados['arquivo'])
      begin
        gerar_um(model, dados)
        if salvar(model, destino) && File.exist?(destino)
          manifesto[dados['chave']] = dados['arquivo']
          log("ok   #{dados['arquivo']}  (#{dados['barras'].size} barras)  #{dados['nome']}")
        else
          log("FALHOU ao salvar #{dados['arquivo']}")
        end
      rescue StandardError => e
        model.abort_operation rescue nil
        log("ERRO em #{dados['arquivo']}: #{e.message}")
      end
    end
    File.write(File.join(SAIDA, 'index.json'), JSON.pretty_generate(manifesto), encoding: 'UTF-8')
    log("Pronto: #{manifesto.size} de #{arquivos.size} arquivos gerados.")
    limpar(model)
  end
end

AcervoEstruturas.executar
Sketchup.quit if ENV['ACERVO_FECHAR'] == '1'
