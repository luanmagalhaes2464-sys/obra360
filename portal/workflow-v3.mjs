export const STAGES = [
  ['00','terreno','Terreno & viabilidade','Entender lote, restrições e viabilidade antes de projetar.'],
  ['01','arquitetura','Arquitetura & decisões do cliente','Transformar necessidades em solução aprovada, com decisões registradas.'],
  ['02','legal','Projeto legal & Prefeitura','Organizar aprovação municipal, alvarás e exigências.'],
  ['03','complementares','Projetos complementares & compatibilização','Compatibilizar estrutura e instalações antes de executar.'],
  ['04','planejamento','Orçamento, contratos & planejamento','Definir custo, prazo, compras e responsabilidades.'],
  ['05','mobilizacao','Mobilização, CNO & SST','Preparar canteiro, registros e segurança antes de iniciar.'],
  ['06','fundacoes','Terraplenagem, locação & fundações','Executar base da obra com registros antes de ocultar serviços.'],
  ['07','estrutura','Estrutura','Controlar formas, armaduras, concretagens e proteção coletiva.'],
  ['08','envoltoria','Vedações, cobertura & esquadrias','Fechar a edificação com controle geométrico e estanqueidade.'],
  ['09','instalacoes','Instalações','Executar, testar e fotografar sistemas antes do fechamento.'],
  ['10','impermeabilizacao','Impermeabilização & revestimentos','Validar bases, estanqueidade e revestimentos.'],
  ['11','acabamentos','Acabamentos & equipamentos','Concluir escolhas, instalação e qualidade final dos ambientes.'],
  ['12','externas','Áreas externas & paisagismo','Finalizar acessos, drenagem, calçadas, muros e paisagismo.'],
  ['13','conclusao','Vistoria, Habite-se & regularização','Encerrar pendências técnicas, municipais, fiscais e registrais.'],
  ['14','entrega','Entrega & passaporte do imóvel','Entregar memória técnica, garantias, manutenção e aceite.'],
]

const T = (stage,code,discipline,title,detail,role,opts={}) => ({stage,code,discipline,title,detail,role,required:opts.required!==false,priority:opts.priority||'normal',client_action:!!opts.clientAction,when:opts.when||null,source_label:opts.sourceLabel||null,source_url:opts.sourceUrl||null,legal_note:opts.legalNote||null})

const BASE = [
  T('terreno','matricula','prefeitura','Conferir matrícula e titularidade','Validar proprietário, lote, confrontações e informações essenciais antes do projeto.','cliente',{priority:'alta',clientAction:true}),
  T('terreno','iptu','prefeitura','Conferir cadastro imobiliário / IPTU','Checar inscrição, endereço e dados cadastrais utilizados no município.','cliente',{priority:'alta',clientAction:true}),
  T('terreno','zoneamento','arquitetura','Levantar parâmetros urbanísticos','Verificar uso permitido, afastamentos, ocupação, altura e demais condicionantes aplicáveis.','arquiteto',{priority:'critica'}),
  T('terreno','topografia','engenharia','Realizar levantamento topográfico','Criar base confiável de implantação, cotas e movimentação de terra.','engenheiro_civil',{priority:'alta'}),
  T('terreno','sondagem','engenharia','Definir necessidade de sondagem','Avaliar solução de fundações conforme porte, solo e condições do terreno.','engenheiro_civil',{priority:'critica',when:'soil'}),
  T('terreno','restricoes_ambientais','prefeitura','Verificar condicionantes ambientais do lote','Checar árvores, drenagem, APP, cursos d’água ou outras restrições que possam interferir no projeto.','arquiteto',{when:'tree_or_earth'}),
  T('terreno','levantamento_existente','arquitetura','Levantar edificação existente','Registrar medidas, níveis, estrutura aparente, instalações conhecidas e patologias antes da intervenção.','arquiteto',{priority:'alta',when:'renovation'}),

  T('arquitetura','briefing','cliente','Briefing e programa de necessidades','Registrar moradores/usuários, ambientes, prioridades, rotina, estilo, orçamento e expectativas.','cliente',{priority:'alta',clientAction:true}),
  T('arquitetura','referencias','cliente','Reunir referências visuais','Organizar imagens, materiais, ambientes e estilos que ajudam a orientar o projeto.','cliente',{clientAction:true}),
  T('arquitetura','estudo_implantacao','arquitetura','Estudo de implantação','Relacionar terreno, insolação, acessos, orientação, vistas e parâmetros urbanísticos.','arquiteto',{priority:'alta'}),
  T('arquitetura','estudo_preliminar','arquitetura','Estudo preliminar','Produzir solução inicial de planta, volumetria e organização espacial para discussão.','arquiteto',{priority:'critica'}),
  T('arquitetura','aprovacao_estudo','cliente','Aprovar estudo preliminar','Cliente revisa a solução antes do avanço para detalhamento e projeto legal.','cliente',{priority:'critica',clientAction:true}),
  T('arquitetura','anteprojeto','arquitetura','Anteprojeto','Consolidar dimensões, fachadas, níveis, materiais principais e decisões aprovadas.','arquiteto',{priority:'alta'}),
  T('arquitetura','aprovacao_anteprojeto','cliente','Aprovar anteprojeto','Registrar aceite do cliente antes de protocolar ou detalhar.','cliente',{priority:'critica',clientAction:true}),
  T('arquitetura','interiores','arquitetura','Definir interiores e pontos críticos','Compatibilizar layout, mobiliário, bancadas, iluminação, paginações e equipamentos quando fizer parte do escopo.','arquiteto',{required:false}),
  T('arquitetura','decisoes_acabamento','cliente','Planejar decisões de acabamentos','Listar escolhas do cliente com prazo-limite para não travar compras e execução.','cliente',{clientAction:true}),
  T('arquitetura','modelo_apresentacao','arquitetura','Preparar material visual de aprovação','Plantas, vistas, imagens ou modelo necessários para o cliente compreender as decisões.','arquiteto',{required:false}),

  T('legal','projeto_legal','arquitetura','Preparar projeto legal','Adequar a documentação gráfica e informações ao padrão exigido pelo município.','arquiteto',{priority:'critica'}),
  T('legal','rrt_art_projeto','arquitetura','Registrar responsabilidade técnica do projeto','Providenciar RRT/ART conforme escopo e atribuições dos profissionais envolvidos.','arquiteto',{priority:'critica'}),
  T('legal','docs_proprietario','prefeitura','Separar documentos do proprietário e imóvel','Organizar documentos pessoais, matrícula, cadastro e demais itens exigidos no protocolo.','cliente',{clientAction:true,priority:'alta'}),
  T('legal','protocolo_prefeitura','prefeitura','Protocolar aprovação municipal','Enviar o processo pelo canal vigente e registrar número/protocolo no histórico da obra.','arquiteto',{priority:'critica'}),
  T('legal','exigencias_prefeitura','prefeitura','Responder exigências da Prefeitura','Controlar exigências, revisões, prazos e nova submissão até aprovação.','arquiteto',{priority:'critica'}),
  T('legal','alvara_construcao','prefeitura','Obter Alvará / licença para construir','Confirmar autorização municipal antes do início das atividades que dependam dela.','arquiteto',{priority:'critica'}),
  T('legal','demolicao_licenca','prefeitura','Verificar licença de demolição','Checar procedimento municipal e condições de segurança para demolição.','arquiteto',{when:'demolition',priority:'alta'}),
  T('legal','arvore_autorizacao','prefeitura','Verificar autorização para intervenção em árvore','Confirmar autorização municipal/ambiental quando houver supressão ou intervenção.','arquiteto',{when:'tree',priority:'alta'}),
  T('legal','mov_terra_licenca','prefeitura','Verificar autorização para movimentação de terra','Checar necessidade de aprovação específica para cortes, aterros ou contenções.','engenheiro_civil',{when:'earth',priority:'alta'}),

  T('complementares','estrutural','engenharia','Projeto estrutural','Dimensionar e detalhar estrutura compatível com arquitetura e fundações.','engenheiro_civil',{priority:'critica'}),
  T('complementares','fundacoes_projeto','engenharia','Projeto / definição de fundações','Definir solução de fundações com base em projeto, solo e condições da obra.','engenheiro_civil',{priority:'critica'}),
  T('complementares','hidrossanitario','engenharia','Projeto hidrossanitário','Definir água, esgoto, águas pluviais, reservação e pontos técnicos.','engenheiro_civil',{priority:'alta'}),
  T('complementares','eletrico','engenharia','Projeto elétrico','Definir cargas, quadros, circuitos, pontos e infraestrutura elétrica.','engenheiro_eletricista',{priority:'alta'}),
  T('complementares','gas','engenharia','Projeto / definição de gás','Compatibilizar rede, ventilação e requisitos aplicáveis.','profissional_habilitado',{when:'gas',priority:'alta'}),
  T('complementares','elevador','engenharia','Compatibilizar elevador','Reservar poço, casa de máquinas ou requisitos do fabricante e interfaces.','engenheiro_civil',{when:'elevator',priority:'alta'}),
  T('complementares','solar','engenharia','Compatibilizar energia solar','Reservar infraestrutura, orientação e interfaces elétricas/estruturais.','engenheiro_eletricista',{when:'solar'}),
  T('complementares','compatibilizacao','arquitetura','Compatibilizar todos os projetos','Revisar interferências entre arquitetura, estrutura e instalações antes da execução.','arquiteto',{priority:'critica'}),
  T('complementares','executivo','arquitetura','Projeto executivo e detalhamentos','Detalhar o necessário para execução: níveis, esquadrias, áreas molhadas, paginações e pontos críticos.','arquiteto',{priority:'critica'}),

  T('planejamento','orcamento','financeiro','Montar orçamento executivo','Estruturar custos por serviços e etapas usando quantitativos e cotações aplicáveis.','engenheiro_producao',{priority:'critica'}),
  T('planejamento','contingencia','financeiro','Definir reserva de contingência','Separar reserva compatível com incertezas e nível de definição do projeto.','cliente',{clientAction:true,priority:'alta'}),
  T('planejamento','cronograma','gestao','Montar cronograma físico','Sequenciar atividades, dependências, marcos e duração prevista.','engenheiro_producao',{priority:'critica'}),
  T('planejamento','fluxo_caixa','financeiro','Projetar fluxo de caixa da obra','Distribuir necessidade financeira ao longo do cronograma.','engenheiro_producao',{priority:'alta'}),
  T('planejamento','plano_compras','suprimentos','Criar mapa de compras por antecedência','Definir quando cotar e comprar itens críticos conforme o cronograma.','engenheiro_producao',{priority:'alta'}),
  T('planejamento','contratos','gestao','Formalizar escopos de contratados','Definir responsabilidades, medições, exclusões, prazo, qualidade e segurança.','engenheiro_producao',{priority:'alta'}),
  T('planejamento','responsaveis','gestao','Definir responsáveis por frente','Deixar claro quem decide, executa, fiscaliza e aprova cada grupo de atividades.','engenheiro_producao'),

  T('mobilizacao','cno','federal','Verificar inscrição da obra no CNO','Confirmar obrigação, dados cadastrais e registro antes da regularização futura.','cliente',{priority:'alta',clientAction:true}),
  T('mobilizacao','scpo','sst','Verificar Comunicação Prévia de Obras','Avaliar aplicabilidade e realizar comunicação antes do início quando exigida.','engenheiro_seguranca',{priority:'critica'}),
  T('mobilizacao','pgr','sst','Elaborar / validar PGR do canteiro','Organizar riscos, controles, projetos e documentos aplicáveis ao estágio da obra.','engenheiro_seguranca',{priority:'critica'}),
  T('mobilizacao','layout_canteiro','sst','Planejar layout e áreas de vivência','Definir acessos, armazenamento, circulação, instalações provisórias e áreas de apoio.','engenheiro_seguranca',{priority:'alta'}),
  T('mobilizacao','eletrica_temporaria','sst','Validar instalação elétrica temporária','Planejar quadros, proteção, aterramento, cabos e uso seguro no canteiro.','profissional_habilitado',{priority:'alta'}),
  T('mobilizacao','epi_epc','sst','Definir matriz inicial de EPI/EPC','Relacionar controles por atividade, responsáveis e forma de inspeção.','engenheiro_seguranca',{priority:'alta'}),
  T('mobilizacao','integracao','sst','Planejar integração de trabalhadores e contratados','Definir comunicação de riscos, requisitos de entrada e registros necessários.','engenheiro_seguranca',{priority:'alta'}),
  T('mobilizacao','aso_pcmso','sst','Verificar ASO/PCMSO e requisitos ocupacionais','Aplicar conforme vínculos, riscos e responsabilidades das empresas envolvidas.','engenheiro_seguranca',{when:'employees',priority:'alta'}),
  T('mobilizacao','altura_planejamento','sst','Planejar trabalho em altura','Definir controles, acesso e sistema de proteção quando houver exposição aplicável.','engenheiro_seguranca',{when:'height',priority:'critica'}),
  T('mobilizacao','tapume_sinalizacao','sst','Instalar isolamento e sinalização do canteiro','Organizar controle de acesso, riscos ao público e identificação da obra.','engenheiro_seguranca',{priority:'alta'}),

  T('fundacoes','locacao','engenharia','Conferir locação da obra','Validar eixos, recuos, níveis e referências antes de escavar/executar fundações.','engenheiro_civil',{priority:'critica'}),
  T('fundacoes','escavacao','sst','Inspecionar escavações e acessos','Avaliar estabilidade, circulação, isolamento e controles durante a etapa.','engenheiro_seguranca',{priority:'critica'}),
  T('fundacoes','fundacao_armacao','qualidade','Conferir formas e armaduras das fundações','Registrar dimensões, cobrimentos, níveis e interfaces antes da concretagem.','engenheiro_civil',{priority:'critica'}),
  T('fundacoes','foto_fundacao','qualidade','Fotografar fundações antes do fechamento','Criar evidência visual de armaduras, esperas, passagens e detalhes que ficarão ocultos.','engenheiro_civil',{priority:'alta'}),
  T('fundacoes','concretagem_fundacao','qualidade','Registrar concretagem das fundações','Registrar data, elemento, condições, material e ocorrências relevantes.','engenheiro_civil',{priority:'alta'}),
  T('fundacoes','impermeabilizacao_fundacao','qualidade','Verificar impermeabilização e drenagem de fundações','Confirmar solução prevista antes de aterros ou fechamentos.','engenheiro_civil',{priority:'alta'}),
  T('fundacoes','medicao_fundacao','financeiro','Validar medição da etapa de fundações','Comparar serviço executado com escopo contratado antes do pagamento.','engenheiro_civil',{priority:'alta'}),

  T('estrutura','formas','qualidade','Conferir formas e escoramentos','Verificar geometria, níveis, estabilidade e condições antes da concretagem.','engenheiro_civil',{priority:'critica'}),
  T('estrutura','armaduras','qualidade','Conferir armaduras e inserts','Registrar armaduras, esperas, passagens e interferências antes de concretar.','engenheiro_civil',{priority:'critica'}),
  T('estrutura','protecoes_borda','sst','Validar proteção coletiva em bordas e aberturas','Inspecionar guarda-corpos, aberturas, acessos e riscos de queda.','engenheiro_seguranca',{priority:'critica'}),
  T('estrutura','foto_estrutura','qualidade','Fotografar elementos antes da concretagem','Criar registro técnico visual dos elementos que ficarão ocultos.','engenheiro_civil',{priority:'alta'}),
  T('estrutura','concretagem','qualidade','Registrar concretagens','Registrar data, elemento, volume, fornecedor e ocorrências relevantes.','engenheiro_civil',{priority:'alta'}),
  T('estrutura','desforma','qualidade','Controlar desforma e reescoramento','Acompanhar sequência e condições previstas para retirada/redistribuição de escoramentos.','engenheiro_civil'),
  T('estrutura','medicao_estrutura','financeiro','Validar medição da estrutura','Comparar avanço físico e escopo contratado antes da liberação financeira.','engenheiro_civil',{priority:'alta'}),

  T('envoltoria','alvenaria_locacao','qualidade','Conferir locação de paredes e vãos','Validar eixos, prumo, níveis e dimensões antes de avançar.','engenheiro_civil',{priority:'alta'}),
  T('envoltoria','vergas_contravergas','qualidade','Conferir vergas, contravergas e reforços','Registrar execução em vãos e interfaces relevantes.','engenheiro_civil'),
  T('envoltoria','cobertura','qualidade','Executar e testar cobertura','Verificar estrutura, telhas, rufos, calhas, caimentos e estanqueidade.','engenheiro_civil',{priority:'alta'}),
  T('envoltoria','altura_cobertura','sst','Inspecionar trabalho em altura na cobertura','Validar acesso e proteção contra quedas antes e durante os serviços.','engenheiro_seguranca',{priority:'critica'}),
  T('envoltoria','esquadrias','qualidade','Conferir esquadrias e interfaces','Validar medidas, fixação, vedação e compatibilidade com acabamentos.','arquiteto',{priority:'alta'}),
  T('envoltoria','fachadas','arquitetura','Conferir materiais e composição de fachadas','Confirmar padrões aprovados antes da execução em escala.','arquiteto',{clientAction:false}),

  T('instalacoes','hidraulica_exec','qualidade','Executar e conferir hidráulica','Conferir traçados, diâmetros, registros, pontos e compatibilidade.','engenheiro_civil',{priority:'alta'}),
  T('instalacoes','esgoto_exec','qualidade','Executar e conferir esgoto e ventilação','Conferir declividades, caixas, conexões e testes aplicáveis.','engenheiro_civil',{priority:'alta'}),
  T('instalacoes','eletrica_exec','qualidade','Executar e conferir elétrica','Conferir eletrodutos, caixas, circuitos e posições antes do fechamento.','engenheiro_eletricista',{priority:'alta'}),
  T('instalacoes','foto_instalacoes','passaporte','Fotografar instalações ocultas por ambiente','Registrar hidráulica, elétrica, gás e dados antes de fechar paredes, pisos e forros.','engenheiro_civil',{priority:'critica'}),
  T('instalacoes','teste_hidraulico','qualidade','Realizar testes hidrossanitários aplicáveis','Registrar testes antes de ocultar tubulações.','engenheiro_civil',{priority:'alta'}),
  T('instalacoes','gas_exec','qualidade','Executar e testar instalação de gás','Conferir execução e testes conforme projeto e requisitos aplicáveis.','profissional_habilitado',{when:'gas',priority:'critica'}),
  T('instalacoes','solar_infra','qualidade','Executar infraestrutura para solar','Conferir passagens, quadro e interfaces previstas.','engenheiro_eletricista',{when:'solar'}),
  T('instalacoes','elevador_infra','qualidade','Conferir infraestrutura do elevador','Validar poço, energia, acessos e requisitos do fornecedor.','engenheiro_civil',{when:'elevator',priority:'alta'}),
  T('instalacoes','eletrica_sst','sst','Inspecionar riscos elétricos durante instalações','Verificar condições de trabalho e proteção contra contatos/energização indevida.','engenheiro_seguranca',{priority:'alta'}),

  T('impermeabilizacao','bases','qualidade','Liberar bases para impermeabilização','Conferir regularização, caimentos, ralos e condições de aplicação.','engenheiro_civil',{priority:'alta'}),
  T('impermeabilizacao','impermeabilizacao_exec','qualidade','Executar e registrar impermeabilização','Registrar sistema, fabricante, lotes e áreas críticas antes do revestimento.','engenheiro_civil',{priority:'critica'}),
  T('impermeabilizacao','teste_estanqueidade','qualidade','Realizar teste de estanqueidade quando aplicável','Registrar resultado antes da proteção e revestimento final.','engenheiro_civil',{priority:'critica'}),
  T('impermeabilizacao','revestimentos_amostra','cliente','Aprovar amostras e paginações','Cliente valida materiais, juntas e paginação antes de execução em escala.','cliente',{clientAction:true,priority:'alta'}),
  T('impermeabilizacao','revestimentos_exec','qualidade','Inspecionar revestimentos','Verificar base, alinhamento, juntas, caimentos e acabamento.','arquiteto',{priority:'alta'}),

  T('acabamentos','cores','cliente','Aprovar cores e acabamentos finais','Registrar escolhas do cliente antes de compras e aplicação.','cliente',{clientAction:true,priority:'alta'}),
  T('acabamentos','pintura','qualidade','Inspecionar pintura','Conferir preparação, uniformidade e correções.','arquiteto'),
  T('acabamentos','loucas_metais','qualidade','Instalar e testar louças e metais','Conferir fixação, funcionamento, vazamentos e acabamento.','engenheiro_civil'),
  T('acabamentos','marcenaria','arquitetura','Conferir marcenaria e medidas finais','Compatibilizar medidas, ferragens, equipamentos e acabamentos.','arquiteto',{required:false}),
  T('acabamentos','iluminacao','arquitetura','Conferir iluminação e equipamentos','Verificar posições, temperaturas de cor, comandos e equipamentos previstos.','arquiteto'),
  T('acabamentos','check_ambientes','qualidade','Checklist de qualidade por ambiente','Percorrer ambientes registrando pendências visuais e funcionais.','arquiteto',{priority:'alta'}),

  T('externas','drenagem','engenharia','Concluir drenagem externa','Verificar captação, caimentos e lançamento conforme solução prevista.','engenheiro_civil',{priority:'alta'}),
  T('externas','calcadas','arquitetura','Conferir calçadas e acessibilidade','Validar níveis, acessos e interfaces com o espaço público conforme aplicabilidade.','arquiteto',{priority:'alta'}),
  T('externas','muros','qualidade','Concluir muros, portões e fechamentos','Revisar estabilidade, drenagem, funcionamento e acabamento.','engenheiro_civil'),
  T('externas','paisagismo','arquitetura','Executar paisagismo previsto','Conferir espécies, níveis, drenagem e integração com áreas externas.','arquiteto',{required:false}),
  T('externas','piscina','qualidade','Concluir e testar piscina','Validar impermeabilização, equipamentos, drenagem e segurança de uso.','engenheiro_civil',{when:'pool',priority:'alta'}),

  T('conclusao','punchlist','qualidade','Vistoria final e lista de pendências','Inspecionar todos os ambientes e sistemas, com responsável e prazo por correção.','arquiteto',{priority:'critica'}),
  T('conclusao','asbuilt','arquitetura','Consolidar as built','Atualizar alterações relevantes executadas em relação aos projetos.','arquiteto',{priority:'alta'}),
  T('conclusao','habite_se','prefeitura','Solicitar vistoria final / Habite-se ou equivalente','Organizar documentação municipal de conclusão e acompanhar exigências.','arquiteto',{priority:'critica'}),
  T('conclusao','iss_obra','prefeitura','Regularizar ISS da obra quando aplicável','Verificar procedimento municipal, documentos e eventuais valores.','cliente',{clientAction:true,priority:'alta'}),
  T('conclusao','sero','federal','Regularizar obra no Sero','Conferir CNO, aferição, DCTFWeb e certidão aplicável.','cliente',{clientAction:true,priority:'critica'}),
  T('conclusao','cadastro_imobiliario','prefeitura','Atualizar cadastro imobiliário','Providenciar atualização cadastral municipal após conclusão, quando aplicável.','cliente',{clientAction:true,priority:'alta'}),
  T('conclusao','averbacao','prefeitura','Averbar construção na matrícula','Organizar documentação para Registro de Imóveis quando aplicável.','cliente',{clientAction:true,priority:'alta'}),

  T('entrega','dossie','gestao','Entregar dossiê técnico','Reunir projetos finais, responsabilidades, documentos, manuais, notas relevantes e regularização.','engenheiro_producao',{priority:'critica'}),
  T('entrega','passaporte','passaporte','Concluir passaporte técnico do imóvel','Organizar fotos de sistemas ocultos, equipamentos, fornecedores e referências de manutenção.','engenheiro_civil',{priority:'critica'}),
  T('entrega','garantias','passaporte','Cadastrar garantias','Registrar fornecedores, contatos, documentos e vencimentos de garantia.','engenheiro_producao',{priority:'alta'}),
  T('entrega','manual_manutencao','gestao','Criar plano de manutenção','Organizar inspeções e manutenções preventivas dos principais sistemas do imóvel.','engenheiro_civil',{priority:'alta'}),
  T('entrega','orientacao_cliente','cliente','Orientar proprietário sobre uso e manutenção','Apresentar documentos, garantias, registros e cuidados importantes.','engenheiro_civil',{priority:'alta'}),
  T('entrega','aceite_final','cliente','Registrar aceite final do cliente','Registrar entrega, pendências residuais e ciência do proprietário.','cliente',{clientAction:true,priority:'critica'}),
]

function applicable(t,p){
  if(!t.when)return true
  if(t.when==='renovation')return ['reforma','ampliacao'].includes(p.kind)
  if(t.when==='soil')return !!p.earthwork||p.slope==='acentuado'||!!p.basement||Number(p.floors||1)>=2
  if(t.when==='tree_or_earth')return !!p.treeRemoval||!!p.earthwork
  if(t.when==='tree')return !!p.treeRemoval
  if(t.when==='earth')return !!p.earthwork||p.slope==='acentuado'||!!p.basement
  if(t.when==='demolition')return !!p.demolition||['reforma','ampliacao'].includes(p.kind)
  if(t.when==='employees')return !!p.hasEmployees
  if(t.when==='height')return !!p.workAtHeight||Number(p.floors||1)>=2
  if(t.when==='gas')return !!p.gas
  if(t.when==='solar')return !!p.solar
  if(t.when==='elevator')return !!p.elevator
  if(t.when==='pool')return !!p.pool
  return true
}

export function buildWorkflow(profile={}){
  let order=0
  return BASE.filter(t=>applicable(t,profile)).map(t=>({...t,task_order:++order,metadata:{auto:true,when:t.when||null}}))
}
