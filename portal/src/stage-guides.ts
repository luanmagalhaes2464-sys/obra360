export type WorkKind='casa_nova'|'predio_residencial'|'comercial_novo'|'reforma'|'ampliacao'

export type StageSource={label:string;detail:string;url:string}
export type StageGuide={
  appliesTo:WorkKind[]
  conditionalFor?:WorkKind[]
  applicabilityNote:string
  steps:string[]
  sources:StageSource[]
}

export const WORK_KIND_LABELS:Record<WorkKind,string>={
  casa_nova:'Casa nova',
  predio_residencial:'Prédio residencial',
  comercial_novo:'Edificação comercial',
  reforma:'Reforma',
  ampliacao:'Ampliação',
}

const ABNT='https://www.abntcatalogo.com.br/'
const ART='https://www.planalto.gov.br/ccivil_03/leis/l6496.htm'
const RRT='https://caubr.gov.br/3-quando-se-deve-fazer-o-rrt/'
const NR18='https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/norma-regulamentadora-no-18-nr-18'
const NR35='https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/norma-regulamentadora-no-35-nr-35'
const CNO='https://www.gov.br/receitafederal/pt-br/assuntos/construcao-civil/cno'

export const STAGE_GUIDES:Record<string,StageGuide>={
  terreno:{
    appliesTo:['casa_nova','predio_residencial','comercial_novo','ampliacao'],conditionalFor:['reforma'],
    applicabilityNote:'Em obra nova e ampliação, a leitura do terreno e das restrições costuma ser etapa básica. Em reforma, o foco normalmente passa para levantamento da edificação existente e restrições do imóvel.',
    steps:['Conferir matrícula, cadastro e limites conhecidos do lote.','Levantar topografia e níveis quando isso influenciar implantação, drenagem ou fundações.','Verificar uso do solo, recuos, altura, ocupação e condicionantes ambientais locais.','Avaliar necessidade de sondagem e outros levantamentos conforme porte, solo e solução estrutural.','Registrar as premissas que serão usadas pelos projetos.'],
    sources:[
      {label:'Lei 6.496/1977 — ART',detail:'Responsabilidade técnica nos serviços de engenharia.',url:ART},
      {label:'ABNT NBR 13133',detail:'Execução de levantamentos topográficos — consultar edição vigente.',url:ABNT},
      {label:'ABNT NBR 6484',detail:'Sondagens de simples reconhecimento com SPT — consultar edição vigente.',url:ABNT},
      {label:'Legislação municipal',detail:'Plano Diretor, uso e ocupação do solo e regras locais do município da obra.',url:''},
    ]
  },
  arquitetura:{
    appliesTo:['casa_nova','predio_residencial','comercial_novo','reforma','ampliacao'],
    applicabilityNote:'O nível de detalhamento muda conforme o porte. Uma reforma simples pode ter escopo reduzido; obra nova e prédio normalmente exigem desenvolvimento mais completo.',
    steps:['Registrar programa de necessidades e restrições do cliente.','Desenvolver implantação e estudo preliminar.','Validar solução antes de avançar.','Consolidar anteprojeto, níveis, fachadas e decisões principais.','Compatibilizar arquitetura com estrutura e instalações.','Produzir detalhamentos necessários à execução e registrar alterações finais.'],
    sources:[
      {label:'CAU/BR — RRT',detail:'Registro de responsabilidade técnica para atividades de Arquitetura e Urbanismo.',url:RRT},
      {label:'ABNT NBR 16636',detail:'Elaboração e desenvolvimento de serviços técnicos especializados de projetos arquitetônicos e urbanísticos — consultar edição vigente.',url:ABNT},
      {label:'ABNT NBR 6492',detail:'Documentação técnica para projetos arquitetônicos e urbanísticos — consultar edição vigente.',url:ABNT},
    ]
  },
  legal:{
    appliesTo:['casa_nova','predio_residencial','comercial_novo','ampliacao'],conditionalFor:['reforma'],
    applicabilityNote:'Obra nova e ampliação normalmente entram no fluxo municipal. Reformas podem ou não exigir aprovação/licença, dependendo do município e do que será alterado.',
    steps:['Identificar quais licenças e documentos o município exige para aquele tipo de intervenção.','Preparar projeto/documentação no padrão municipal.','Providenciar responsabilidade técnica compatível com o escopo.','Protocolar e guardar o número do processo.','Responder exigências e revisões.','Obter a autorização aplicável antes das atividades que dependam dela.'],
    sources:[
      {label:'Lei 6.496/1977 — ART',detail:'Responsabilidade técnica de serviços de engenharia.',url:ART},
      {label:'CAU/BR — RRT',detail:'Responsabilidade técnica de Arquitetura e Urbanismo.',url:RRT},
      {label:'Prefeitura / legislação municipal',detail:'Código de Obras, Plano Diretor, uso do solo e procedimentos variam por município.',url:''},
    ]
  },
  complementares:{
    appliesTo:['casa_nova','predio_residencial','comercial_novo','ampliacao'],conditionalFor:['reforma'],
    applicabilityNote:'A quantidade de projetos complementares depende do sistema construtivo, porte, instalações existentes e escopo. Em reforma, só entram os sistemas efetivamente alterados ou afetados.',
    steps:['Definir quais disciplinas são necessárias para o escopo real.','Desenvolver estrutura e fundações quando aplicáveis.','Desenvolver instalações hidráulicas, sanitárias e elétricas afetadas.','Adicionar gás, elevador, solar, SPDA ou outras especialidades quando existirem.','Compatibilizar interferências entre projetos antes da execução.','Emitir responsabilidades técnicas pelos profissionais competentes.'],
    sources:[
      {label:'ABNT NBR 6118',detail:'Projeto de estruturas de concreto — consultar edição vigente.',url:ABNT},
      {label:'ABNT NBR 6122',detail:'Projeto e execução de fundações — consultar edição vigente.',url:ABNT},
      {label:'ABNT NBR 5626',detail:'Sistemas prediais de água fria e água quente — consultar edição vigente.',url:ABNT},
      {label:'ABNT NBR 8160',detail:'Sistemas prediais de esgoto sanitário — consultar edição vigente.',url:ABNT},
      {label:'ABNT NBR 5410',detail:'Instalações elétricas de baixa tensão — consultar edição vigente.',url:ABNT},
    ]
  },
  planejamento:{
    appliesTo:['casa_nova','predio_residencial','comercial_novo','reforma','ampliacao'],
    applicabilityNote:'Toda obra se beneficia de orçamento, prazo e definição de responsabilidades; o nível de controle pode ser simplificado em intervenções pequenas.',
    steps:['Fechar escopo e premissas dos projetos.','Levantar quantitativos e custos.','Definir reserva para incertezas compatível com o nível de definição.','Montar cronograma com dependências e marcos.','Planejar compras e contratações críticas.','Definir responsáveis, critérios de medição e mudanças de escopo.'],
    sources:[
      {label:'Lei 6.496/1977 — ART',detail:'Quando o planejamento/orçamento configurar serviço técnico de engenharia, verificar responsabilidade profissional aplicável.',url:ART},
      {label:'ABNT NBR 12721',detail:'Avaliação de custos unitários e preparo de orçamento de construção — consultar edição vigente.',url:ABNT},
    ]
  },
  mobilizacao:{
    appliesTo:['casa_nova','predio_residencial','comercial_novo','ampliacao'],conditionalFor:['reforma'],
    applicabilityNote:'A mobilização depende de existência de canteiro, trabalhadores, empresas contratadas e riscos da atividade. Reforma pequena pode ter uma estrutura muito mais simples, sem eliminar obrigações que sejam aplicáveis.',
    steps:['Definir acesso, isolamento, circulação, armazenamento e áreas de apoio.','Verificar CNO e demais registros aplicáveis.','Realizar Comunicação Prévia de Obras quando aplicável.','Estruturar o PGR e controles de SST conforme atividades reais.','Planejar instalações provisórias, elétrica temporária, EPI/EPC e integração.','Liberar o início somente com documentos e controles aplicáveis organizados.'],
    sources:[
      {label:'NR-18',detail:'Segurança e saúde no trabalho na indústria da construção.',url:NR18},
      {label:'Receita Federal — CNO',detail:'Cadastro Nacional de Obras e orientações de inscrição/regularização.',url:CNO},
      {label:'NR-35',detail:'Trabalho em altura, quando houver exposição aplicável.',url:NR35},
    ]
  },
  fundacoes:{
    appliesTo:['casa_nova','predio_residencial','comercial_novo','ampliacao'],conditionalFor:['reforma'],
    applicabilityNote:'Aplica-se quando há fundação nova, reforço, contenção ou intervenção que transfira novas cargas ao solo. Reforma sem intervenção estrutural pode não precisar desta etapa.',
    steps:['Confirmar locação, eixos, recuos e níveis.','Validar solução de fundação e dados geotécnicos necessários.','Executar escavação/estacas/blocos/sapatas conforme projeto.','Conferir formas, armaduras, esperas e cobrimentos antes da concretagem.','Registrar concretagem e evidências antes do fechamento.','Liberar avanço somente após as verificações previstas pelo responsável técnico.'],
    sources:[
      {label:'ABNT NBR 6122',detail:'Projeto e execução de fundações — consultar edição vigente.',url:ABNT},
      {label:'ABNT NBR 6118',detail:'Estruturas de concreto — consultar edição vigente.',url:ABNT},
      {label:'NR-18',detail:'Escavações, fundações e medidas de prevenção no canteiro.',url:NR18},
    ]
  },
  estrutura:{
    appliesTo:['casa_nova','predio_residencial','comercial_novo','ampliacao'],conditionalFor:['reforma'],
    applicabilityNote:'Obra nova normalmente terá etapa estrutural. Em reforma, só entra quando há alteração, reforço, demolição ou execução de elementos estruturais.',
    steps:['Confirmar projeto estrutural e versão liberada para obra.','Conferir formas, escoramentos, armaduras, inserts e passagens.','Verificar interfaces com instalações antes de concretar/fechar.','Registrar inspeções e concretagens.','Controlar desforma, cura, reescoramento e eventuais não conformidades conforme projeto/procedimento.','Manter proteção coletiva e condições seguras durante a execução.'],
    sources:[
      {label:'ABNT NBR 6118',detail:'Projeto de estruturas de concreto — consultar edição vigente.',url:ABNT},
      {label:'ABNT NBR 14931',detail:'Execução de estruturas de concreto — consultar edição vigente.',url:ABNT},
      {label:'NR-18',detail:'Requisitos de segurança para etapas da construção, inclusive estruturas.',url:NR18},
    ]
  },
  envoltoria:{
    appliesTo:['casa_nova','predio_residencial','comercial_novo','ampliacao'],conditionalFor:['reforma'],
    applicabilityNote:'Aplica-se quando a obra executa ou altera paredes externas/internas, fachadas, cobertura ou esquadrias. Em reforma localizada, parte desses itens pode ser marcada como não aplicável.',
    steps:['Conferir modulação, prumos, vãos e interfaces com estrutura.','Executar vedações prevendo instalações e juntas necessárias.','Executar cobertura e interfaces de estanqueidade.','Instalar/regular esquadrias e selagens.','Verificar fachadas e pontos críticos de água.','Registrar correções antes de revestimentos definitivos.'],
    sources:[
      {label:'ABNT NBR 15575',detail:'Desempenho de edificações habitacionais — quando aplicável, consultar edição vigente.',url:ABNT},
      {label:'ABNT NBR 10821',detail:'Esquadrias para edificações — consultar edição vigente.',url:ABNT},
      {label:'NR-18 / NR-35',detail:'Proteção contra quedas e trabalho em altura quando aplicáveis.',url:NR18},
    ]
  },
  instalacoes:{
    appliesTo:['casa_nova','predio_residencial','comercial_novo','reforma','ampliacao'],
    applicabilityNote:'Entram apenas os sistemas existentes ou alterados no escopo: água, esgoto, elétrica, dados, gás, climatização e outros.',
    steps:['Confirmar projetos e pontos antes de rasgos/fechamentos.','Executar infraestrutura e passagens preservando estrutura e impermeabilização.','Identificar tubulações, circuitos e quadros.','Realizar ensaios/testes previstos antes do fechamento.','Fotografar trechos que ficarão ocultos.','Registrar as built quando houver mudança em relação ao projeto.'],
    sources:[
      {label:'ABNT NBR 5626',detail:'Sistemas prediais de água fria e água quente — consultar edição vigente.',url:ABNT},
      {label:'ABNT NBR 8160',detail:'Sistemas prediais de esgoto sanitário — consultar edição vigente.',url:ABNT},
      {label:'ABNT NBR 5410',detail:'Instalações elétricas de baixa tensão — consultar edição vigente.',url:ABNT},
    ]
  },
  impermeabilizacao:{
    appliesTo:['casa_nova','predio_residencial','comercial_novo','reforma','ampliacao'],
    applicabilityNote:'Aplica-se onde houver áreas molhadas, enterradas, coberturas, reservatórios ou outros elementos sujeitos à água. Em uma reforma seca, vários itens podem não se aplicar.',
    steps:['Definir áreas e sistemas de impermeabilização.','Preparar base, caimentos, ralos e detalhes.','Executar conforme especificação do sistema.','Proteger pontos críticos e interfaces com instalações.','Realizar ensaio de estanqueidade quando previsto.','Liberar revestimento/proteção somente após inspeção e registro.'],
    sources:[
      {label:'ABNT NBR 9575',detail:'Impermeabilização — seleção e projeto — consultar edição vigente.',url:ABNT},
      {label:'ABNT NBR 9574',detail:'Execução de impermeabilização — consultar edição vigente.',url:ABNT},
    ]
  },
  acabamentos:{
    appliesTo:['casa_nova','predio_residencial','comercial_novo','reforma','ampliacao'],
    applicabilityNote:'Quase toda obra tem alguma etapa de acabamento, mas os itens dependem do escopo contratado e das escolhas do cliente.',
    steps:['Fechar amostras, especificações e paginações.','Confirmar bases prontas e condições para receber acabamento.','Executar revestimentos, pintura, forros, louças, metais e equipamentos conforme escopo.','Conferir alinhamentos, juntas, níveis e interfaces.','Corrigir não conformidades antes da vistoria final.','Registrar garantias e manuais dos equipamentos instalados.'],
    sources:[
      {label:'ABNT NBR 15575',detail:'Critérios de desempenho para edificações habitacionais, quando aplicável.',url:ABNT},
      {label:'Especificações de fabricantes',detail:'Procedimentos de aplicação/instalação dos materiais efetivamente usados na obra.',url:''},
    ]
  },
  externas:{
    appliesTo:['casa_nova','predio_residencial','comercial_novo','ampliacao'],conditionalFor:['reforma'],
    applicabilityNote:'Só se aplica ao que estiver no escopo: acessos, muros, drenagem, calçadas, paisagismo, estacionamento e interfaces com a rua.',
    steps:['Confirmar cotas externas e drenagem final.','Executar redes e elementos que ficarão enterrados.','Executar acessos, calçadas, muros e pavimentos previstos.','Compatibilizar paisagismo com redes e manutenção.','Conferir acessibilidade e transições quando aplicáveis.','Registrar acabamentos e pontos ocultos externos.'],
    sources:[
      {label:'ABNT NBR 9050',detail:'Acessibilidade a edificações, mobiliário, espaços e equipamentos urbanos — consultar edição vigente.',url:ABNT},
      {label:'Legislação municipal',detail:'Regras de calçada, acesso, drenagem e interface com logradouro variam por município.',url:''},
    ]
  },
  conclusao:{
    appliesTo:['casa_nova','predio_residencial','comercial_novo','ampliacao'],conditionalFor:['reforma'],
    applicabilityNote:'A regularização final depende do que foi licenciado e das exigências locais. Reformas sem processo municipal podem ter encerramento documental diferente.',
    steps:['Executar vistoria interna e lista de pendências.','Conferir documentos, projetos atualizados e responsabilidades técnicas.','Providenciar vistorias/atendimentos de órgãos quando exigidos.','Solicitar Habite-se, certidão ou documento municipal equivalente quando aplicável.','Atualizar/encerrar obrigações fiscais e cadastrais da obra.','Organizar documentação para averbação quando cabível.'],
    sources:[
      {label:'Receita Federal — construção civil',detail:'CNO, Sero, aferição e certidão de regularidade da obra.',url:CNO},
      {label:'Prefeitura / legislação municipal',detail:'Habite-se, certidão de conclusão e procedimentos variam por município.',url:''},
      {label:'Lei 6.496/1977 — ART',detail:'Responsabilidade técnica dos serviços de engenharia envolvidos.',url:ART},
    ]
  },
  entrega:{
    appliesTo:['casa_nova','predio_residencial','comercial_novo','reforma','ampliacao'],
    applicabilityNote:'Mesmo em obra pequena, vale entregar registro do que foi executado, garantias e orientações de manutenção proporcionais ao escopo.',
    steps:['Fechar pendências e aceite do cliente.','Organizar projetos finais e as built disponíveis.','Consolidar fotos de elementos ocultos e memória do imóvel.','Entregar garantias, notas, contatos e manuais de equipamentos.','Registrar orientações básicas de operação e manutenção.','Arquivar documentos para futuras reformas, manutenção ou venda do imóvel.'],
    sources:[
      {label:'ABNT NBR 14037',detail:'Manual de uso, operação e manutenção das edificações — consultar edição vigente.',url:ABNT},
      {label:'ABNT NBR 5674',detail:'Gestão de manutenção de edificações — consultar edição vigente.',url:ABNT},
      {label:'ABNT NBR 16280',detail:'Gestão de reformas em edificações — referência importante para intervenções futuras.',url:ABNT},
    ]
  },
}

export function workKind(profile:any):WorkKind{
  const value=String(profile?.kind||'casa_nova') as WorkKind
  return WORK_KIND_LABELS[value]?value:'casa_nova'
}

export function stageApplicability(stageKey:string,profile:any){
  const guide=STAGE_GUIDES[stageKey]
  const kind=workKind(profile)
  if(!guide)return {status:'review' as const,label:'Avaliar conforme escopo'}
  if(guide.appliesTo.includes(kind))return {status:'applies' as const,label:'Geralmente se aplica a esta obra'}
  if(guide.conditionalFor?.includes(kind))return {status:'conditional' as const,label:'Depende do escopo desta obra'}
  return {status:'review' as const,label:'Pode não se aplicar'}
}
