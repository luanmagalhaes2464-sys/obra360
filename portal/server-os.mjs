import express from 'express'
import cookieParser from 'cookie-parser'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import pg from 'pg'
import path from 'path'
import { fileURLToPath } from 'url'

const { Pool } = pg
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT || 10000)
const DATABASE_URL = process.env.DATABASE_URL
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production'
const COOKIE = 'obra360_session'
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.6-terra'

if (!DATABASE_URL) {
  console.error('DATABASE_URL ausente')
  process.exit(1)
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1') ? false : { rejectUnauthorized: false },
})

const SOURCES = {
  viçosaDept: {
    label: 'Prefeitura de Viçosa — Licenciamento de Obras e Edificações',
    url: 'https://www.vicosa.mg.gov.br/abrir_arquivo.aspx?arquivo=%7BCA0EA1DE-8BDC-4A8B-EA41-8B3BEC7BAB8A%7D.pdf&cdLocal=12',
  },
  viçosaCadastro: {
    label: 'Prefeitura de Viçosa — Cadastro Imobiliário / Averbação',
    url: 'https://www.vicosa.mg.gov.br/abrir_arquivo.aspx/FORMULARIO_PARA_REVISAO_NO_CADASTRO_IMOBILIARIO_MUNICIPAL?arquivo=%7BA8E7042E-053A-ADDA-B566-5DCCBC4A71BA%7D.pdf&cdLocal=2',
  },
  viçosaIss: {
    label: 'Prefeitura de Viçosa — ISS de Obras',
    url: 'https://www.vicosa.mg.gov.br/abrir_arquivo.aspx/Processo_homologacao__ISS_Obras?arquivo=%7B6135E41B-CD6B-BDC2-CA8E-CD5E536BB5BA%7D.pdf&cdLocal=2',
  },
  cauPhases: {
    label: 'CAU/BR — Etapas do projeto de arquitetura',
    url: 'https://caubr.gov.br/vidas/criar-organizar-e-realizar/',
  },
  cauRrt: {
    label: 'CAU/BR — Registro de Responsabilidade Técnica (RRT)',
    url: 'https://transparencia.caubr.gov.br/perguntas-frequentes-registro-de-responsabilidade-tecnica-rrt/',
  },
  nr18: {
    label: 'MTE — NR-18 Construção',
    url: 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/norma-regulamentadora-no-18-nr-18',
  },
  pgr: {
    label: 'MTE — Programa de Gerenciamento de Riscos (PGR)',
    url: 'https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/pgr',
  },
  nr35: {
    label: 'MTE — NR-35 Trabalho em Altura',
    url: 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/norma-regulamentadora-no-35-nr-35',
  },
  scpo: {
    label: 'Gov.br — Comunicação Prévia de Obras (SCPO)',
    url: 'https://www.gov.br/pt-br/servicos/realizar-a-comunicacao-previa-de-obras',
  },
  sero: {
    label: 'Receita Federal — Aferição de Obras (Sero)',
    url: 'https://www.gov.br/receitafederal/pt-br/assuntos/construcao-civil/sero',
  },
}

const STAGES = [
  ['00', 'terreno', 'Terreno & viabilidade', 'Antes de desenhar, confirmar o que é possível construir e quais condicionantes existem.'],
  ['01', 'arquitetura', 'Arquitetura & conceito', 'Transformar necessidades, orçamento e restrições em uma solução aprovada pelo cliente.'],
  ['02', 'legal', 'Projeto legal & Prefeitura', 'Preparar e acompanhar o licenciamento municipal antes do início da obra.'],
  ['03', 'complementares', 'Projetos complementares & compatibilização', 'Resolver estrutura, instalações e interfaces antes do canteiro.'],
  ['04', 'planejamento', 'Orçamento, contratação & planejamento', 'Definir custo, sequência, compras, contratos e responsabilidades.'],
  ['05', 'mobilizacao', 'Mobilização, CNO & SST', 'Liberar o início do canteiro com obrigações administrativas e de segurança organizadas.'],
  ['06', 'fundacoes', 'Terraplenagem, locação & fundações', 'Executar o início físico da obra com controle de terreno, cotas, fundações e segurança.'],
  ['07', 'estrutura', 'Estrutura', 'Controlar execução estrutural, concretagens, interfaces e proteções coletivas.'],
  ['08', 'envoltoria', 'Vedações, cobertura & esquadrias', 'Fechar a edificação com controle de prumo, nível, cobertura e estanqueidade.'],
  ['09', 'instalacoes', 'Instalações', 'Executar e registrar elétrica, hidráulica, esgoto, dados, gás e demais sistemas aplicáveis.'],
  ['10', 'impermeabilizacao', 'Impermeabilização & revestimentos', 'Validar bases, impermeabilização, testes e revestimentos antes do acabamento.'],
  ['11', 'acabamentos', 'Acabamentos & equipamentos', 'Concluir pisos, pintura, louças, metais, marcenaria e equipamentos previstos.'],
  ['12', 'externas', 'Áreas externas & paisagismo', 'Finalizar acessos, drenagem, calçadas, muros, paisagismo e áreas externas.'],
  ['13', 'conclusao', 'Vistoria, Habite-se & regularização', 'Fechar a obra tecnicamente e regularizar município, Receita e registro do imóvel.'],
  ['14', 'entrega', 'Entrega & passaporte do imóvel', 'Entregar documentação, as built, garantias, manutenção e memória técnica permanente.'],
]

function normalizeCity(v = '') {
  return String(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function buildWorkflow(profile = {}) {
  const tasks = []
  const city = normalizeCity(profile.city || profile.municipality || '')
  const isVicosa = city.includes('vicosa') && String(profile.state || 'MG').toUpperCase() === 'MG'
  const isNew = ['casa_nova', 'predio_residencial', 'comercial_novo'].includes(profile.kind)
  const isRenovation = ['reforma', 'ampliacao'].includes(profile.kind)
  const isBuilding = profile.kind === 'predio_residencial' || Number(profile.floors || 1) >= 3
  const hasHeight = Boolean(profile.workAtHeight) || Number(profile.floors || 1) >= 2
  const hasEmployees = Boolean(profile.hasEmployees)
  const multiContractors = Boolean(profile.multipleContractors)
  const earthwork = Boolean(profile.earthwork) || profile.slope === 'acentuado' || Boolean(profile.basement)
  const commercial = profile.kind === 'comercial_novo' || profile.kind === 'comercial_reforma'
  const hasGas = Boolean(profile.gas)
  const hasElevator = Boolean(profile.elevator)
  const hasPool = Boolean(profile.pool)
  const hasSolar = Boolean(profile.solar)
  const demolition = Boolean(profile.demolition) || isRenovation
  const treeRemoval = Boolean(profile.treeRemoval)

  let order = 0
  const add = (stage, code, discipline, title, detail, role, opts = {}) => {
    order += 1
    const source = opts.source || null
    tasks.push({
      code,
      stage,
      discipline,
      title,
      detail,
      role,
      required: opts.required !== false,
      priority: opts.priority || 'normal',
      client_action: Boolean(opts.clientAction),
      source_label: source?.label || null,
      source_url: source?.url || null,
      legal_note: opts.legalNote || null,
      task_order: order,
      metadata: { auto: true, condition: opts.condition || null, city_specific: Boolean(opts.citySpecific) },
    })
  }

  // 00 — Terreno & viabilidade
  add('terreno','property_title','prefeitura','Conferir matrícula e titularidade do imóvel','Garantir que os dados do proprietário, lote e registro estejam coerentes antes de protocolar projetos.','cliente',{priority:'alta'})
  add('terreno','iptu_registry','prefeitura','Conferir cadastro imobiliário / IPTU','Checar inscrição imobiliária, endereço, lote e dados cadastrais usados nos processos municipais.','cliente',{priority:'alta',source:isVicosa?SOURCES.viçosaCadastro:null,citySpecific:isVicosa})
  add('terreno','urban_parameters','arquitetura','Levantar parâmetros urbanísticos do lote','Zoneamento, uso permitido, afastamentos, taxa de ocupação, coeficiente, altura e demais restrições aplicáveis.','arquiteto',{priority:'critica'})
  add('terreno','topography','engenharia','Levantamento topográfico / cadastral','Base geométrica do terreno para projeto, implantação, cotas e planejamento de movimentação de terra.','engenheiro_civil',{priority:'alta'})
  if (isRenovation) add('terreno','existing_survey','arquitetura','Levantamento completo da edificação existente','Medidas, estrutura aparente, instalações conhecidas e patologias relevantes antes de projetar a intervenção.','arquiteto',{priority:'alta'})
  if (earthwork) add('terreno','soil_investigation','engenharia','Avaliar necessidade de sondagem e investigação do solo','Definir solução de fundação e riscos de corte, aterro, contenção ou subsolo.','engenheiro_civil',{priority:'critica'})
  if (treeRemoval) add('terreno','vegetation_check','prefeitura','Verificar autorização para supressão / manejo de vegetação','Confirmar licenciamento ambiental ou autorização municipal aplicável antes da intervenção.','arquiteto',{priority:'alta'})
  if (demolition) add('terreno','demolition_scope','engenharia','Planejar demolições e escoramentos','Mapear elementos a remover, estabilidade temporária, resíduos e riscos antes do início.','engenheiro_civil',{priority:'critica'})
  add('terreno','feasibility_budget','financeiro','Definir teto de investimento e reserva','Registrar quanto o cliente pretende investir para orientar arquitetura, padrão de acabamento e escopo.','cliente',{clientAction:true,priority:'alta'})
  add('terreno','needs_program','arquitetura','Briefing e programa de necessidades','Ambientes, usos, prioridades, rotina, acessibilidade, expansão futura e preferências do cliente.','arquiteto',{source:SOURCES.cauPhases,clientAction:true,priority:'alta'})

  // 01 — Arquitetura
  add('arquitetura','arch_preliminary','arquitetura','Estudo preliminar de arquitetura','Primeira solução espacial considerando lote, programa de necessidades, legislação e orçamento.','arquiteto',{source:SOURCES.cauPhases,priority:'alta'})
  add('arquitetura','client_preliminary_approval','cliente','Aprovar estudo preliminar','Registrar a concordância do cliente antes de avançar para definições mais detalhadas.','cliente',{clientAction:true,priority:'critica'})
  add('arquitetura','arch_anteproject','arquitetura','Anteprojeto / definição do produto','Consolidar partido arquitetônico, dimensões, circulações, volumetria e principais sistemas.','arquiteto',{source:SOURCES.cauPhases,priority:'alta'})
  add('arquitetura','client_anteproject_approval','cliente','Aprovar anteprojeto','Congelar decisões principais para reduzir mudança tardia e retrabalho.','cliente',{clientAction:true,priority:'critica'})
  add('arquitetura','materials_concept','arquitetura','Definir conceito de materiais e acabamentos','Estabelecer padrão de pisos, revestimentos, esquadrias, louças, metais e linguagem geral compatível com orçamento.','arquiteto')
  add('arquitetura','accessibility_review','arquitetura','Revisar acessibilidade e circulação','Verificar exigências legais e critérios de uso conforme tipologia e público da edificação.','arquiteto',{priority:commercial||isBuilding?'alta':'normal'})
  add('arquitetura','legal_arch_project','arquitetura','Preparar projeto para licenciamento','Montar plantas, cortes, fachadas, implantação e informações exigidas para análise municipal.','arquiteto',{source:SOURCES.cauPhases,priority:'critica'})
  add('arquitetura','rrt_art_project','arquitetura','Emitir responsabilidade técnica do projeto aplicável','Registrar RRT/ART conforme autoria, escopo e atribuições dos profissionais envolvidos.','arquiteto',{source:SOURCES.cauRrt,priority:'critica'})
  add('arquitetura','executive_arch','arquitetura','Projeto executivo de arquitetura','Detalhar soluções para execução, evitando que decisões críticas sejam resolvidas improvisadamente no canteiro.','arquiteto',{priority:'alta'})
  add('arquitetura','details_arch','arquitetura','Detalhamentos construtivos prioritários','Banheiros, escadas, bancadas, esquadrias, paginações, áreas molhadas e interfaces que geram retrabalho quando ficam indefinidas.','arquiteto')

  // 02 — Prefeitura
  if (isVicosa) {
    add('legal','vicosa_professional_check','prefeitura','Confirmar cadastro e regularidade municipal dos responsáveis técnicos','Antes do protocolo, confirmar exigências vigentes para profissionais e documentos fiscais municipais.','arquiteto',{source:SOURCES.viçosaDept,citySpecific:true,priority:'alta',legalNote:'A estrutura municipal atual possui Departamento de Licenciamento de Obras e Edificações. Exigências operacionais devem ser confirmadas no protocolo vigente.'})
    add('legal','vicosa_protocol_pack','prefeitura','Montar dossiê de aprovação e Alvará de Construção','Organizar documentação do imóvel, projeto legal e responsabilidades técnicas para protocolo municipal.','arquiteto',{source:SOURCES.viçosaDept,citySpecific:true,priority:'critica'})
    add('legal','vicosa_protocol','prefeitura','Protocolar aprovação do projeto / licenciamento da obra','Registrar o processo no órgão municipal responsável e guardar número, recibo e versão protocolada.','arquiteto',{source:SOURCES.viçosaDept,citySpecific:true,priority:'critica'})
    add('legal','vicosa_requirements','prefeitura','Responder exigências da análise municipal','Centralizar exigências, revisão de projeto, resposta e nova versão para evitar perda de histórico.','arquiteto',{source:SOURCES.viçosaDept,citySpecific:true,priority:'alta'})
    add('legal','vicosa_alvara','prefeitura','Obter projeto aprovado e Alvará de Construção','Não iniciar preparo de terreno ou locação da obra antes da licença municipal aplicável.','arquiteto',{source:SOURCES.viçosaDept,citySpecific:true,priority:'critica'})
    add('legal','vicosa_site_documents','prefeitura','Manter licença e projeto aprovado disponíveis na obra','Organizar a versão aprovada que deve orientar a execução e eventuais fiscalizações.','engenheiro_civil',{source:SOURCES.viçosaDept,citySpecific:true,priority:'alta'})
  } else {
    add('legal','city_requirements','prefeitura','Consultar exigências da Prefeitura do município','Confirmar órgão responsável, documentos, taxas, formato de projeto, aprovações complementares e fluxo de protocolo.','arquiteto',{priority:'critica'})
    add('legal','city_protocol','prefeitura','Protocolar aprovação / licenciamento da obra','Enviar projeto legal e documentos exigidos pelo município e registrar número do processo.','arquiteto',{priority:'critica'})
    add('legal','city_alvara','prefeitura','Obter licença / Alvará antes de iniciar','Confirmar documento municipal que autoriza o início da execução.','arquiteto',{priority:'critica'})
  }
  if (earthwork) add('legal','earthwork_license','prefeitura','Verificar licença específica para terraplenagem / movimentação de terra','Confirmar se corte, aterro, contenção ou transporte de material exige autorização específica.','engenheiro_civil',{priority:'alta'})
  if (treeRemoval) add('legal','environment_license','prefeitura','Verificar licença ambiental / vegetação aplicável','Confirmar autorização antes de supressão ou intervenção ambiental.','arquiteto',{priority:'alta'})
  if (commercial || isBuilding) add('legal','fire_department_check','engenharia','Verificar enquadramento no Corpo de Bombeiros','Confirmar se a tipologia, área, altura e ocupação exigem projeto, medidas ou licenciamento de segurança contra incêndio.','engenheiro_civil',{priority:'critica'})

  // 03 — Complementares
  add('complementares','structural_design','engenharia','Projeto estrutural','Dimensionar sistema estrutural e compatibilizar pilares, vigas, lajes, fundações e arquitetura.','engenheiro_civil',{priority:'critica'})
  add('complementares','foundation_design','engenharia','Projeto / definição de fundações','Definir solução coerente com estrutura, solo e condições do terreno.','engenheiro_civil',{priority:'critica'})
  add('complementares','electrical_design','engenharia','Projeto elétrico','Definir cargas, quadros, circuitos, pontos, entrada e interfaces com arquitetura.','engenheiro_eletricista',{priority:'alta'})
  add('complementares','hydro_design','engenharia','Projeto hidrossanitário','Água fria/quente, esgoto, ventilação, águas pluviais e reservação conforme escopo.','engenheiro_civil',{priority:'alta'})
  add('complementares','drainage_design','engenharia','Drenagem do lote e águas pluviais','Definir coleta, condução e lançamento evitando infiltrações, erosão e conflito com áreas externas.','engenheiro_civil',{priority:'alta'})
  if (hasGas) add('complementares','gas_design','engenharia','Projeto / definição da instalação de gás','Definir rede, ventilação, abrigo e requisitos técnicos aplicáveis.','engenheiro_civil',{priority:'alta'})
  if (hasSolar) add('complementares','solar_design','engenharia','Projeto / infraestrutura para energia solar','Compatibilizar cobertura, estrutura, eletrodutos, quadro e acesso de manutenção.','engenheiro_eletricista')
  if (hasPool) add('complementares','pool_design','engenharia','Projetos e instalações da piscina','Compatibilizar estrutura, hidráulica, casa de máquinas, impermeabilização e áreas externas.','engenheiro_civil')
  if (hasElevator) add('complementares','elevator_design','engenharia','Definição do elevador e infraestrutura','Compatibilizar caixa, poço, energia, acesso, estrutura e requisitos do equipamento.','engenheiro_civil',{priority:'alta'})
  add('complementares','project_coordination','arquitetura','Compatibilizar arquitetura e projetos complementares','Eliminar interferências entre estrutura, instalações, esquadrias, forros, impermeabilização e acabamentos antes da execução.','arquiteto',{priority:'critica'})
  add('complementares','compatibility_signoff','cliente','Aprovar conjunto executivo compatibilizado','Registrar o conjunto de projeto que será usado como base oficial de orçamento e execução.','cliente',{clientAction:true,priority:'critica'})

  // 04 — Planejamento
  add('planejamento','quantities','engenharia','Levantamento de quantitativos','Quantificar serviços e materiais principais a partir dos projetos compatibilizados.','engenheiro_producao',{priority:'alta'})
  add('planejamento','executive_budget','financeiro','Orçamento executivo da obra','Consolidar materiais, mão de obra, equipamentos, terceiros, impostos, contingência e itens fora do escopo.','engenheiro_producao',{priority:'critica'})
  add('planejamento','cashflow','financeiro','Fluxo de caixa por etapa','Distribuir desembolsos previstos para antecipar compras e necessidade financeira do cliente.','engenheiro_producao',{priority:'alta'})
  add('planejamento','schedule','engenharia','Cronograma físico da obra','Definir sequência, durações, dependências, marcos, folgas e caminho de decisões.','engenheiro_producao',{priority:'critica'})
  add('planejamento','purchase_schedule','suprimentos','Mapa de compras e prazos críticos','Listar o que precisa ser comprado antes de cada etapa, principalmente itens com fabricação ou entrega longa.','engenheiro_producao',{priority:'alta'})
  add('planejamento','contracts_scope','financeiro','Definir escopo de empreiteiros e contratos','Separar claramente o que cada contratado entrega, mede, fornece, protege e corrige.','engenheiro_producao',{priority:'alta'})
  add('planejamento','responsibility_matrix','gestao','Matriz de responsabilidades','Definir cliente, arquiteto, engenheiros, segurança, empreiteiros, fornecedores e responsáveis por aprovações.','engenheiro_producao',{priority:'alta'})
  add('planejamento','baseline_approval','cliente','Aprovar orçamento + cronograma-base','Criar a linha de base que permitirá comparar custo e prazo durante a execução.','cliente',{clientAction:true,priority:'critica'})

  // 05 — Mobilização / federal / SST
  add('mobilizacao','cno','federal','Inscrever / conferir a obra no CNO','Organizar o Cadastro Nacional de Obras, necessário para a regularização previdenciária posterior.','cliente',{source:SOURCES.sero,priority:'critica'})
  add('mobilizacao','scpo','sst','Realizar Comunicação Prévia de Obras (SCPO)','Comunicar a obra antes do início das atividades, com dados de endereço, responsável, tipo, datas e trabalhadores previstos.','engenheiro_seguranca',{source:SOURCES.scpo,priority:'critica'})
  add('mobilizacao','pgr','sst','Elaborar e implementar PGR do canteiro','Inventário de riscos e plano de ação atualizados conforme a etapa da obra.','engenheiro_seguranca',{source:SOURCES.nr18,priority:'critica'})
  add('mobilizacao','site_layout','sst','Projeto / organização da área de vivência e canteiro','Definir acessos, áreas de apoio, armazenamento, circulação e condições previstas no PGR conforme aplicabilidade.','engenheiro_seguranca',{source:SOURCES.nr18,priority:'alta'})
  add('mobilizacao','temporary_electrical','sst','Projeto das instalações elétricas temporárias','Organizar quadro, distribuição, proteção e solução temporária do canteiro por profissional habilitado.','engenheiro_eletricista',{source:SOURCES.nr18,priority:'alta'})
  add('mobilizacao','collective_protection','sst','Definir sistemas de proteção coletiva','Planejar proteções coletivas necessárias para as fases previstas da obra.','engenheiro_seguranca',{source:SOURCES.nr18,priority:'critica'})
  if (hasHeight) add('mobilizacao','fall_protection_system','sst','Planejar proteção contra quedas / SPIQ quando aplicável','Antes de atividades com risco de queda, definir soluções coletivas e individuais, acessos e resgate aplicáveis.','engenheiro_seguranca',{source:SOURCES.nr35,priority:'critica'})
  add('mobilizacao','epi_matrix','sst','Matriz de EPI por atividade e risco','Relacionar equipamentos necessários e especificações coerentes com os riscos da obra.','engenheiro_seguranca',{source:SOURCES.nr18,priority:'alta'})
  if (multiContractors) add('mobilizacao','contractor_risk_inventories','sst','Integrar inventários de riscos dos contratados','Reunir riscos específicos das empresas contratadas e incorporá-los à gestão do canteiro.','engenheiro_seguranca',{source:SOURCES.nr18,priority:'alta'})
  if (hasEmployees) {
    add('mobilizacao','pcmso','sst','Confirmar PCMSO aplicável à organização','Integrar saúde ocupacional à gestão dos riscos e funções presentes no canteiro.','medico_trabalho',{source:SOURCES.pgr,priority:'alta'})
    add('mobilizacao','aso','sst','Conferir ASO e aptidões ocupacionais aplicáveis','Garantir que trabalhadores possuam documentação de saúde ocupacional exigível antes das atividades.','engenheiro_seguranca',{priority:'alta'})
  }
  add('mobilizacao','training_matrix','sst','Matriz de treinamentos e autorizações','Relacionar capacitações por função e atividade: integração, trabalho em altura, eletricidade, equipamentos e outras aplicáveis.','engenheiro_seguranca',{source:SOURCES.nr18,priority:'critica'})
  add('mobilizacao','site_signage','sst','Sinalização, isolamento e organização inicial do canteiro','Implantar controles básicos antes da entrada regular das equipes.','engenheiro_seguranca',{priority:'alta'})
  add('mobilizacao','neighbor_record','engenharia','Registro fotográfico de confrontantes / vizinhança','Documentar condições prévias relevantes antes de escavações, demolições ou atividades com potencial de impacto.','engenheiro_civil',{priority:earthwork||demolition?'alta':'normal'})

  // 06 — Fundação
  add('fundacoes','setout','engenharia','Conferir locação, eixos e cotas','Validar implantação antes de escavar ou concretar.','engenheiro_civil',{priority:'critica'})
  if (earthwork) add('fundacoes','earthwork_control','engenharia','Controlar cortes, aterros, contenções e drenagem provisória','Registrar níveis, estabilidade e condições do terreno ao longo da movimentação.','engenheiro_civil',{priority:'critica'})
  add('fundacoes','foundation_precheck','qualidade','Inspecionar fundações antes do fechamento / concretagem','Conferir dimensões, armaduras, formas, cotas e condições definidas no projeto.','engenheiro_civil',{priority:'critica'})
  add('fundacoes','foundation_evidence','qualidade','Registrar evidências de fundações','Fotos e registros antes de elementos ficarem ocultos.','engenheiro_civil',{priority:'alta'})
  add('fundacoes','excavation_safety','sst','Inspecionar riscos de escavação e circulação','Revisar acesso, isolamento, estabilidade e interferência de equipamentos conforme a frente de serviço.','engenheiro_seguranca',{priority:'critica'})
  add('fundacoes','foundation_measurement','financeiro','Medição da etapa de fundações','Conferir quantitativos executados antes de aprovar pagamento da etapa.','engenheiro_producao',{priority:'alta'})

  // 07 — Estrutura
  add('estrutura','structural_release','qualidade','Conferir formas, armaduras e inserts antes da concretagem','Validar pontos que ficarão inacessíveis após concretar.','engenheiro_civil',{priority:'critica'})
  add('estrutura','concrete_records','qualidade','Registrar concretagens e rastreabilidade','Data, elemento, fornecedor, volume e registros de execução conforme controle definido.','engenheiro_civil',{priority:'alta'})
  add('estrutura','structure_interfaces','engenharia','Conferir passagens e interfaces antes de concretar','Verificar shafts, esperas, embutidos e interferências com instalações.','engenheiro_civil',{priority:'alta'})
  add('estrutura','edge_protection','sst','Inspecionar proteção contra quedas e bordas','Reavaliar proteções coletivas a cada mudança de nível e frente de trabalho.','engenheiro_seguranca',{source:SOURCES.nr35,priority:'critica'})
  add('estrutura','structure_measurement','financeiro','Medição da estrutura','Validar serviços executados antes da liberação financeira.','engenheiro_producao',{priority:'alta'})

  // 08 — Envoltória
  add('envoltoria','masonry_layout','qualidade','Conferir locação de paredes e vãos','Checar dimensões, prumo, nível, vergas, contravergas e interfaces de esquadrias.','engenheiro_civil',{priority:'alta'})
  add('envoltoria','roof_execution','qualidade','Validar cobertura e arremates críticos','Conferir caimentos, rufos, calhas, fixações e interfaces com impermeabilização.','engenheiro_civil',{priority:'alta'})
  add('envoltoria','window_interfaces','qualidade','Conferir esquadrias, peitoris e vedação','Reduzir risco de infiltração e retrabalho antes de acabamentos.','arquiteto',{priority:'alta'})
  if (hasHeight) add('envoltoria','roof_safety','sst','Liberar trabalho em cobertura / altura','Revisar acesso, proteção contra queda, isolamento e condições da atividade antes da execução.','engenheiro_seguranca',{source:SOURCES.nr35,priority:'critica'})

  // 09 — Instalações
  add('instalacoes','hydro_roughin','qualidade','Conferir instalações hidrossanitárias antes do fechamento','Validar traçados, pontos, declividades, conexões e testes aplicáveis.','engenheiro_civil',{priority:'critica'})
  add('instalacoes','electrical_roughin','qualidade','Conferir eletrodutos, caixas e circuitos antes do fechamento','Validar pontos e infraestrutura elétrica antes de reboco, forro ou revestimento.','engenheiro_eletricista',{priority:'critica'})
  add('instalacoes','hidden_services_photos','passaporte','Fotografar instalações ocultas por ambiente','Registrar tubulações e eletrodutos com referências de localização antes de fechar paredes, pisos e forros.','engenheiro_civil',{priority:'critica'})
  add('instalacoes','hydro_tests','qualidade','Registrar testes hidráulicos / estanqueidade aplicáveis','Concluir testes antes do fechamento definitivo das instalações.','engenheiro_civil',{priority:'alta'})
  add('instalacoes','electrical_safety','sst','Controlar segurança em serviços elétricos','Confirmar pessoal autorizado, condições da instalação e medidas aplicáveis às atividades elétricas.','engenheiro_seguranca',{priority:'critica'})
  if (hasGas) add('instalacoes','gas_test','qualidade','Testar e registrar instalação de gás','Concluir verificações aplicáveis antes de ocultar ou colocar o sistema em uso.','engenheiro_civil',{priority:'critica'})

  // 10 — Impermeabilização
  add('impermeabilizacao','substrate_check','qualidade','Conferir base antes da impermeabilização','Validar caimentos, regularização, ralos, cantos e preparação do substrato.','engenheiro_civil',{priority:'alta'})
  add('impermeabilizacao','waterproof_record','passaporte','Registrar impermeabilização antes de cobrir','Documentar áreas, sistema utilizado e fotos antes do revestimento.','engenheiro_civil',{priority:'critica'})
  add('impermeabilizacao','waterproof_test','qualidade','Executar / registrar teste de estanqueidade quando aplicável','Não avançar para revestimento antes da validação definida para a área.','engenheiro_civil',{priority:'critica'})
  add('impermeabilizacao','tile_layout','arquitetura','Aprovar paginação e pontos de acabamento','Conferir recortes, alinhamentos, níveis e encontros antes da execução em escala.','arquiteto',{clientAction:true})

  // 11 — Acabamentos
  add('acabamentos','finish_samples','arquitetura','Aprovar amostras e referências finais','Registrar materiais e acabamentos efetivamente escolhidos para reduzir substituições não controladas.','cliente',{clientAction:true,priority:'alta'})
  add('acabamentos','finish_quality','qualidade','Checklist de qualidade dos acabamentos','Inspecionar pisos, revestimentos, pintura, forros, louças, metais e arremates.','arquiteto',{priority:'alta'})
  add('acabamentos','equipment_commissioning','qualidade','Testar equipamentos e sistemas instalados','Conferir funcionamento, manuais, garantias e responsáveis por assistência.','engenheiro_civil',{priority:'alta'})
  if (hasElevator) add('acabamentos','elevator_commissioning','qualidade','Comissionar elevador e documentação aplicável','Concluir testes, documentação técnica, manutenção e liberações exigíveis.','engenheiro_civil',{priority:'critica'})
  if (hasSolar) add('acabamentos','solar_commissioning','qualidade','Comissionar sistema fotovoltaico','Registrar projeto final, equipamentos, garantias e condições de operação.','engenheiro_eletricista',{priority:'alta'})

  // 12 — Externas
  add('externas','site_drainage_final','engenharia','Finalizar drenagem externa','Conferir caimentos, caixas, grelhas, lançamentos e proteção contra erosão.','engenheiro_civil',{priority:'alta'})
  add('externas','sidewalk_access','arquitetura','Conferir calçadas, acessos e níveis','Finalizar acesso do lote, circulação e interfaces com espaço público conforme exigências aplicáveis.','arquiteto',{priority:'alta'})
  add('externas','walls_gates','qualidade','Concluir muros, portões e fechamentos','Revisar estabilidade, acabamentos, drenagem e funcionamento.','engenheiro_civil')
  if (hasPool) add('externas','pool_commissioning','qualidade','Concluir piscina e sistemas','Testar instalações, acabamento, drenagem, equipamentos e segurança de uso.','engenheiro_civil',{priority:'alta'})

  // 13 — Conclusão
  add('conclusao','final_punchlist','qualidade','Vistoria final e lista de pendências','Inspecionar todos os ambientes e sistemas, atribuindo responsável e prazo para cada correção.','arquiteto',{priority:'critica'})
  add('conclusao','asbuilt','arquitetura','Consolidar as built / como construído','Atualizar alterações relevantes executadas em relação aos projetos.','arquiteto',{priority:'alta'})
  if (isVicosa) {
    add('conclusao','vicosa_habite_se','prefeitura','Solicitar vistoria, Habite-se e Certidão Discriminativa','Organizar pedido municipal de conclusão e documentos da obra para a vistoria final.','arquiteto',{source:SOURCES.viçosaCadastro,citySpecific:true,priority:'critica'})
    add('conclusao','vicosa_iss_works','prefeitura','Regularizar / homologar ISS de obras quando aplicável','A Prefeitura possui formulário específico com projeto aprovado e declaração de obra pronta entre os documentos mínimos indicados.','cliente',{source:SOURCES.viçosaIss,citySpecific:true,priority:'alta'})
    add('conclusao','vicosa_cadastral_update','prefeitura','Atualizar cadastro imobiliário / certidão para averbação','Organizar projeto aprovado, Habite-se, Certidão Discriminativa, matrícula e documentos requeridos para atualização cadastral/averbação.','cliente',{source:SOURCES.viçosaCadastro,citySpecific:true,priority:'alta'})
  } else {
    add('conclusao','municipal_final_inspection','prefeitura','Solicitar vistoria final / Habite-se ou equivalente','Confirmar procedimento municipal para autorização de ocupação e documentação final.','arquiteto',{priority:'critica'})
  }
  add('conclusao','sero_regularization','federal','Aferir e regularizar a obra no Sero','Conferir CNO, dados da obra, créditos, aferição, DCTFWeb e emissão da certidão para regularização.','cliente',{source:SOURCES.sero,priority:'critica'})
  add('conclusao','registry_update','prefeitura','Averbar a construção na matrícula do imóvel','Após regularização e documentos finais, providenciar a averbação junto ao Registro de Imóveis quando aplicável.','cliente',{priority:'alta'})

  // 14 — Entrega
  add('entrega','handover_documents','gestao','Entregar dossiê técnico da obra','Projetos finais, responsabilidades técnicas, notas relevantes, manuais, garantias e documentos de regularização.','engenheiro_producao',{priority:'critica'})
  add('entrega','passport_hidden_systems','passaporte','Concluir passaporte das instalações ocultas','Organizar fotos e referências de hidráulica, elétrica, impermeabilização e demais sistemas ocultos.','engenheiro_civil',{priority:'alta'})
  add('entrega','warranties','passaporte','Cadastrar garantias e fornecedores','Registrar vencimentos, contatos e documentos para manutenção pós-obra.','engenheiro_producao',{priority:'alta'})
  add('entrega','maintenance_plan','gestao','Plano inicial de manutenção do imóvel','Criar calendário de inspeções e manutenções preventivas dos principais sistemas.','engenheiro_civil',{priority:'alta'})
  add('entrega','client_handover','cliente','Aceite final do cliente','Registrar entrega, pendências residuais e ciência sobre documentos, garantias e manutenção.','cliente',{clientAction:true,priority:'critica'})

  return { stages: STAGES, tasks }
}

async function migrate() {
  const c = await pool.connect()
  try {
    await c.query('BEGIN')
    await c.query(`
      CREATE TABLE IF NOT EXISTS users(
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'client',
        created_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS projects(
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        city TEXT,
        address TEXT,
        client_name TEXT,
        status TEXT NOT NULL DEFAULT 'planejamento',
        start_date DATE,
        planned_end_date DATE,
        budget NUMERIC(14,2) DEFAULT 0,
        committed NUMERIC(14,2) DEFAULT 0,
        spent NUMERIC(14,2) DEFAULT 0,
        progress NUMERIC(5,2) DEFAULT 0,
        planned_progress NUMERIC(5,2) DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS project_members(
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        member_role TEXT DEFAULT 'client',
        PRIMARY KEY(project_id,user_id)
      );
      CREATE TABLE IF NOT EXISTS os_profiles(
        project_id INTEGER PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
        profile JSONB NOT NULL DEFAULT '{}'::jsonb,
        workflow_version TEXT NOT NULL DEFAULT '2026.09-v1',
        updated_at TIMESTAMPTZ DEFAULT now(),
        updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
      );
      CREATE TABLE IF NOT EXISTS os_tasks(
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        code TEXT NOT NULL,
        stage_key TEXT NOT NULL,
        discipline TEXT NOT NULL,
        title TEXT NOT NULL,
        detail TEXT,
        role TEXT,
        required BOOLEAN DEFAULT true,
        priority TEXT DEFAULT 'normal',
        status TEXT NOT NULL DEFAULT 'pending',
        client_action BOOLEAN DEFAULT false,
        source_label TEXT,
        source_url TEXT,
        legal_note TEXT,
        task_order INTEGER DEFAULT 0,
        is_custom BOOLEAN DEFAULT false,
        metadata JSONB DEFAULT '{}'::jsonb,
        completed_at TIMESTAMPTZ,
        completed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE(project_id,code)
      );
      CREATE TABLE IF NOT EXISTS os_events(
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL DEFAULT 'task',
        title TEXT NOT NULL,
        description TEXT,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS passport_items(
        id SERIAL PRIMARY KEY,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        system_type TEXT NOT NULL,
        zone TEXT,
        title TEXT NOT NULL,
        description TEXT,
        photo_url TEXT,
        warranty_until DATE,
        supplier TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_os_tasks_project_stage ON os_tasks(project_id,stage_key,task_order);
      CREATE INDEX IF NOT EXISTS idx_os_events_project ON os_events(project_id,created_at DESC);
    `)
    await c.query('COMMIT')
  } catch (e) {
    await c.query('ROLLBACK')
    throw e
  } finally {
    c.release()
  }

  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  const name = process.env.ADMIN_NAME || 'Equipe Obra360'
  if (email && password) {
    const hash = await bcrypt.hash(password, 12)
    await pool.query(`INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'admin') ON CONFLICT(email) DO UPDATE SET name=EXCLUDED.name,role='admin'`, [name,email.toLowerCase(),hash])
  }
}

function auth(req,res,next){
  const token=req.cookies[COOKIE]
  if(!token)return res.status(401).json({error:'Não autenticado'})
  try{req.user=jwt.verify(token,JWT_SECRET);next()}catch{return res.status(401).json({error:'Sessão expirada'})}
}
function staff(req,res,next){if(!['admin','team'].includes(req.user?.role))return res.status(403).json({error:'Acesso restrito à equipe técnica'});next()}
async function canAccess(user,projectId){if(['admin','team'].includes(user.role))return true;const q=await pool.query('SELECT 1 FROM project_members WHERE project_id=$1 AND user_id=$2',[projectId,user.id]);return q.rowCount>0}

async function syncWorkflow(projectId,profile,userId){
  const generated=buildWorkflow(profile)
  const c=await pool.connect()
  try{
    await c.query('BEGIN')
    await c.query(`INSERT INTO os_profiles(project_id,profile,workflow_version,updated_by) VALUES($1,$2,'2026.09-v1',$3) ON CONFLICT(project_id) DO UPDATE SET profile=EXCLUDED.profile,workflow_version=EXCLUDED.workflow_version,updated_at=now(),updated_by=EXCLUDED.updated_by`,[projectId,profile,userId])
    const codes=[]
    for(const t of generated.tasks){
      codes.push(t.code)
      await c.query(`INSERT INTO os_tasks(project_id,code,stage_key,discipline,title,detail,role,required,priority,client_action,source_label,source_url,legal_note,task_order,metadata)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        ON CONFLICT(project_id,code) DO UPDATE SET stage_key=EXCLUDED.stage_key,discipline=EXCLUDED.discipline,title=EXCLUDED.title,detail=EXCLUDED.detail,role=EXCLUDED.role,required=EXCLUDED.required,priority=EXCLUDED.priority,client_action=EXCLUDED.client_action,source_label=EXCLUDED.source_label,source_url=EXCLUDED.source_url,legal_note=EXCLUDED.legal_note,task_order=EXCLUDED.task_order,metadata=EXCLUDED.metadata,updated_at=now()`,
        [projectId,t.code,t.stage,t.discipline,t.title,t.detail,t.role,t.required,t.priority,t.client_action,t.source_label,t.source_url,t.legal_note,t.task_order,t.metadata])
    }
    if(codes.length) await c.query(`DELETE FROM os_tasks WHERE project_id=$1 AND is_custom=false AND NOT(code=ANY($2::text[]))`,[projectId,codes])
    await c.query(`INSERT INTO os_events(project_id,event_type,title,description,created_by) VALUES($1,'workflow','Roteiro automático atualizado',$2,$3)`,[projectId,`O motor gerou ${generated.tasks.length} ações aplicáveis ao perfil atual da obra.`,userId])
    await c.query('COMMIT')
    return generated
  }catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
}

async function getOSBundle(projectId){
  const [p,prof,tasks,events,passport]=await Promise.all([
    pool.query('SELECT * FROM projects WHERE id=$1',[projectId]),
    pool.query('SELECT * FROM os_profiles WHERE project_id=$1',[projectId]),
    pool.query('SELECT * FROM os_tasks WHERE project_id=$1 ORDER BY task_order,id',[projectId]),
    pool.query('SELECT e.*,u.name author_name FROM os_events e LEFT JOIN users u ON u.id=e.created_by WHERE e.project_id=$1 ORDER BY e.created_at DESC LIMIT 60',[projectId]),
    pool.query('SELECT * FROM passport_items WHERE project_id=$1 ORDER BY created_at DESC',[projectId]),
  ])
  if(!p.rows[0])return null
  const taskRows=tasks.rows
  const done=taskRows.filter(t=>t.status==='done').length
  const na=taskRows.filter(t=>t.status==='na').length
  const applicable=Math.max(0,taskRows.length-na)
  const completedApplicable=taskRows.filter(t=>t.status==='done').length
  const progress=applicable?Math.round(completedApplicable/applicable*100):0
  const byStage=STAGES.map(([num,key,title,summary])=>{
    const list=taskRows.filter(t=>t.stage_key===key)
    const active=list.filter(t=>t.status!=='na')
    const stageDone=active.filter(t=>t.status==='done').length
    return {num,key,title,summary,total:list.length,applicable:active.length,done:stageDone,progress:active.length?Math.round(stageDone/active.length*100):0}
  }).filter(s=>s.total>0)
  const nextTask=taskRows.find(t=>t.status==='pending'&&t.required)||taskRows.find(t=>t.status==='pending')||null
  return {project:p.rows[0],profile:prof.rows[0]?.profile||null,workflowVersion:prof.rows[0]?.workflow_version||null,tasks:taskRows,events:events.rows,passport:passport.rows,stages:byStage,summary:{total:taskRows.length,done,na,applicable,progress,nextTask}}
}

const app=express()
app.disable('x-powered-by')
app.use(express.json({limit:'2mb'}))
app.use(cookieParser())

app.get('/api/health',(_req,res)=>res.json({ok:true,product:'Obra360 OS'}))
app.post('/api/auth/login',async(req,res)=>{const email=String(req.body.email||'').trim().toLowerCase(),password=String(req.body.password||'');const q=await pool.query('SELECT * FROM users WHERE email=$1',[email]);const u=q.rows[0];if(!u||!(await bcrypt.compare(password,u.password_hash)))return res.status(401).json({error:'E-mail ou senha inválidos'});const token=jwt.sign({id:u.id,name:u.name,email:u.email,role:u.role},JWT_SECRET,{expiresIn:'7d'});res.cookie(COOKIE,token,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:7*24*60*60*1000});res.json({user:{id:u.id,name:u.name,email:u.email,role:u.role}})})
app.post('/api/auth/logout',(_req,res)=>{res.clearCookie(COOKIE);res.json({ok:true})})
app.get('/api/me',auth,async(req,res)=>{const q=await pool.query('SELECT id,name,email,role FROM users WHERE id=$1',[req.user.id]);res.json({user:q.rows[0]})})

app.get('/api/projects',auth,async(req,res)=>{let q;if(['admin','team'].includes(req.user.role))q=await pool.query('SELECT * FROM projects ORDER BY updated_at DESC,id DESC');else q=await pool.query('SELECT p.* FROM projects p JOIN project_members pm ON pm.project_id=p.id WHERE pm.user_id=$1 ORDER BY p.updated_at DESC',[req.user.id]);res.json({projects:q.rows})})
app.post('/api/projects',auth,staff,async(req,res)=>{const{name,city,address,clientName,budget=0}=req.body;if(!name)return res.status(400).json({error:'Nome da obra obrigatório'});const q=await pool.query(`INSERT INTO projects(name,city,address,client_name,budget,status) VALUES($1,$2,$3,$4,$5,'planejamento') RETURNING *`,[name,city||null,address||null,clientName||null,Number(budget)||0]);res.status(201).json({project:q.rows[0]})})

app.get('/api/os/projects/:id',auth,async(req,res)=>{const id=Number(req.params.id);if(!(await canAccess(req.user,id)))return res.status(403).json({error:'Sem acesso'});const b=await getOSBundle(id);if(!b)return res.status(404).json({error:'Obra não encontrada'});res.json(b)})
app.put('/api/os/projects/:id/profile',auth,staff,async(req,res)=>{const id=Number(req.params.id);const profile={...req.body};const project=await pool.query('SELECT * FROM projects WHERE id=$1',[id]);if(!project.rows[0])return res.status(404).json({error:'Obra não encontrada'});profile.city=profile.city||project.rows[0].city||'';profile.state=profile.state||'MG';const generated=await syncWorkflow(id,profile,req.user.id);await pool.query('UPDATE projects SET city=COALESCE($1,city),updated_at=now() WHERE id=$2',[profile.city||null,id]);res.json({ok:true,count:generated.tasks.length})})
app.patch('/api/os/projects/:projectId/tasks/:taskId',auth,async(req,res)=>{const projectId=Number(req.params.projectId),taskId=Number(req.params.taskId);if(!(await canAccess(req.user,projectId)))return res.status(403).json({error:'Sem acesso'});const q=await pool.query('SELECT * FROM os_tasks WHERE id=$1 AND project_id=$2',[taskId,projectId]);const task=q.rows[0];if(!task)return res.status(404).json({error:'Item não encontrado'});const isStaff=['admin','team'].includes(req.user.role);if(!isStaff&&!task.client_action)return res.status(403).json({error:'Este item é de responsabilidade da equipe técnica'});const status=req.body.status;if(!['pending','done','na'].includes(status))return res.status(400).json({error:'Status inválido'});const u=await pool.query(`UPDATE os_tasks SET status=$1,completed_at=CASE WHEN $1='done' THEN now() ELSE NULL END,completed_by=CASE WHEN $1='done' THEN $2 ELSE NULL END,updated_at=now() WHERE id=$3 RETURNING *`,[status,req.user.id,taskId]);await pool.query(`INSERT INTO os_events(project_id,event_type,title,description,created_by) VALUES($1,'task',$2,$3,$4)`,[projectId,`${status==='done'?'Concluído':status==='na'?'Não aplicável':'Reaberto'}: ${task.title}`,`Disciplina: ${task.discipline}.`,req.user.id]);res.json({task:u.rows[0]})})
app.post('/api/os/projects/:id/tasks',auth,staff,async(req,res)=>{const projectId=Number(req.params.id);const{stageKey='planejamento',discipline='gestao',title,detail='',role='equipe'}=req.body;if(!title)return res.status(400).json({error:'Título obrigatório'});const code=`custom_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;const max=await pool.query('SELECT COALESCE(MAX(task_order),0)+1 n FROM os_tasks WHERE project_id=$1',[projectId]);const q=await pool.query(`INSERT INTO os_tasks(project_id,code,stage_key,discipline,title,detail,role,required,priority,task_order,is_custom) VALUES($1,$2,$3,$4,$5,$6,$7,false,'normal',$8,true) RETURNING *`,[projectId,code,stageKey,discipline,title,detail,role,max.rows[0].n]);res.status(201).json({task:q.rows[0]})})

app.post('/api/os/projects/:id/passport',auth,staff,async(req,res)=>{const projectId=Number(req.params.id);const{systemType='geral',zone='',title,description='',photoUrl='',warrantyUntil,supplier=''}=req.body;if(!title)return res.status(400).json({error:'Título obrigatório'});const q=await pool.query(`INSERT INTO passport_items(project_id,system_type,zone,title,description,photo_url,warranty_until,supplier,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[projectId,systemType,zone,title,description,photoUrl,warrantyUntil||null,supplier,req.user.id]);res.status(201).json({item:q.rows[0]})})

app.post('/api/os/projects/:id/ai',auth,async(req,res)=>{const projectId=Number(req.params.id);if(!(await canAccess(req.user,projectId)))return res.status(403).json({error:'Sem acesso'});const question=String(req.body.question||'').trim();if(!question)return res.status(400).json({error:'Pergunta vazia'});const b=await getOSBundle(projectId);const pending=b.tasks.filter(t=>t.status==='pending');const q=question.toLowerCase();let fallback='';if(/prefeitura|alvar|habite|licen|regulariz/.test(q)){const rows=pending.filter(t=>['prefeitura','federal'].includes(t.discipline)).slice(0,8);fallback=rows.length?`Os próximos itens de Prefeitura/regularização registrados são: ${rows.map(t=>t.title).join('; ')}.`:'Não há pendências de Prefeitura/regularização registradas no roteiro atual.'}else if(/arquitet|projeto|rrt/.test(q)){const rows=pending.filter(t=>t.discipline==='arquitetura'||t.stage_key==='complementares').slice(0,8);fallback=rows.length?`Na frente de projetos, ainda faltam: ${rows.map(t=>t.title).join('; ')}.`:'Não há pendências de projeto registradas no roteiro atual.'}else if(/seguran|pgr|nr|epi|altura|risco/.test(q)){const rows=pending.filter(t=>t.discipline==='sst').slice(0,8);fallback=rows.length?`Na frente de segurança, os próximos itens são: ${rows.map(t=>t.title).join('; ')}.`:'Não há pendências de SST registradas no roteiro atual.'}else{fallback=`O roteiro está ${b.summary.progress}% concluído. Há ${pending.length} item(ns) pendente(s). A próxima ação priorizada é: ${b.summary.nextTask?.title||'nenhuma pendência registrada'}.`}
  if(!OPENAI_API_KEY)return res.json({answer:fallback,mode:'grounded'})
  try{const context=JSON.stringify({project:b.project,profile:b.profile,summary:b.summary,pending:pending.slice(0,40),done:b.tasks.filter(t=>t.status==='done').slice(-20),passport:b.passport.slice(0,30),events:b.events.slice(0,20)});const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${OPENAI_API_KEY}`},body:JSON.stringify({model:OPENAI_MODEL,instructions:'Você é a Obra IA do Obra360 OS. Responda em português do Brasil usando primeiro os dados registrados da obra. Não invente exigências municipais, documentos, normas aplicáveis ou fatos. Diferencie claramente o que está registrado do que precisa ser validado por arquiteto, engenheiro civil, engenheiro de segurança ou órgão público. Seja prático: diga o próximo passo e por quê.',input:`CONTEXTO\n${context}\n\nPERGUNTA\n${question}`,max_output_tokens:900})});if(!r.ok)throw new Error('falha IA');const d=await r.json();let answer=d.output_text;if(!answer&&Array.isArray(d.output))answer=d.output.flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text).join('\n');res.json({answer:answer||fallback,mode:answer?'ai':'grounded'})}catch(e){res.json({answer:fallback,mode:'grounded'})}
})

app.get('/api/public/os/:id',async(req,res)=>{const b=await getOSBundle(Number(req.params.id));if(!b)return res.status(404).json({error:'Obra não encontrada'});res.json({project:{id:b.project.id,name:b.project.name,city:b.project.city,status:b.project.status},summary:b.summary,stages:b.stages.map(s=>({num:s.num,title:s.title,progress:s.progress}))})})

const dist=path.join(__dirname,'dist')
app.use(express.static(dist))
app.get('*',(req,res,next)=>{if(req.path.startsWith('/api/'))return next();res.sendFile(path.join(dist,'index.html'))})

migrate().then(()=>app.listen(PORT,'0.0.0.0',()=>console.log(`Obra360 OS ativo na porta ${PORT}`))).catch(e=>{console.error('Falha inicial',e);process.exit(1)})
