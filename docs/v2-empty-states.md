# Estados da interface integrada

A lista de rotas vem de `Workspace` e `IntegratedSales` em `app/v2/integrated-sales.jsx`. Os links são fragmentos na origem da V2. O primeiro acesso mostra uma miniatura da função, uma orientação e a ação disponível ao perfil. Busca, filtro e paginação vazios preservam os controles necessários para recuperar os resultados. O componente compartilhado FirstAccess centraliza a miniatura, o título e a ação principal no painel. No celular, ocupa a área entre as barras de navegação. Estados de listas internas, filtros e erros mantêm a escala do contexto.

| Rota ou contexto | Sem dados ou primeiro acesso | Outros estados e destino da ação |
| --- | --- | --- |
| `#dashboard` | Com zero conversas no resumo, apresenta a análise inicial e a consulta de WhatsApps. Com conversas existentes e fila vazia, oferece abrir Conversas. | Os indicadores aparecem quando há atividade. A troca de versão continua disponível no primeiro acesso. Resumo e fila têm carregamento e erro próprios. |
| `#radar` | Miniatura do Radar. A ação considera a atribuição e a situação do WhatsApp. Com conversas analisadas, uma fila vazia oferece abrir Conversas. | Busca ou situação sem resultado permite limpar filtros. Um cursor vazio permite voltar. |
| `#oportunidades` | Miniatura de negociações. Sem linha, orienta a implantação ou atribuição. Uma linha pronta leva a Diagnósticos. | Mantém filtros, paginação e links para a conversa correspondente. |
| `#resultados` | Miniatura de ganhos e ação para abrir Radar. | Ganho pendente ou confirmado aparece com valor e situação. Página posterior vazia oferece voltar. |
| `#entrada` | O painel inteiro orienta sobre implantação, atribuição, pareamento ou diagnóstico conforme papel e estado da linha. Uma fonte sintética é identificada como exemplo. | Com conversas, volta a caixa com favoritos e Foco da Zoe. Busca vazia permite mostrar todas. |
| `#conversa/:id`, `#entrada/todos/:id` e `/evidencia/:trecho` | Na conversa existente sem mensagens, a indicação é compacta e as ações de atendimento continuam acessíveis. | ID inválido ou conversa indisponível oferece volta à lista. Um trecho que saiu da leitura tem aviso próprio. |
| `#tarefas` | Se as listas de abertos e concluídos estiverem vazias, mostra apenas a agenda ilustrada e a ação de abrir Conversas. Se existirem concluídos, mantém o acesso a eles. | Até hoje e Concluídos têm textos próprios. Até hoje oferece mostrar todos em aberto. |
| `#crm` | Gestor pode criar o primeiro funil. Vendedor recebe orientação de configuração pelo gestor. | Um funil existente sem padrão aparece pelo primeiro item disponível. Etapas vazias são compactas. Um responsável sem cartões recebe uma ação para mostrar toda a equipe. |
| `#alertas` | Antes da análise, orienta sobre o WhatsApp ou o diagnóstico. Com conversas analisadas, o gestor pode revisar as regras e o vendedor pode abrir Conversas. | Limpar filtros recupera a lista. Regras de alerta ficam disponíveis ao gestor. |
| `#diagnosticos`, `#diagnosticos/:id` | Sem linha, a página de primeiro acesso explica a ação de conexão para o perfil. Sem histórico em uma linha, orienta a primeira leitura no formulário. | Leitura em andamento, erro, leitura parcial, resultado zero e leitura indisponível têm estados próprios. Páginas posteriores de conexões ou histórico oferecem retorno. |
| `#chat`, `#chat/radar`, `#zoe` | O editor recebe a primeira pergunta. O histórico vazio usa uma miniatura compacta da Zoe. | O seletor de conversa vazio leva a Conversas. Busca vazia permite limpar. A paginação preserva seleções anteriores. |
| `#zoe/:id[/:cursor]`, `#chat/origem/:id` | Consulta salva ou conversa indisponível oferece abrir uma nova pergunta. | Respostas, fontes e citações continuam no chat. Uma fonte indisponível permite voltar à resposta. |
| `#conexao` | O diretório oferece a integração WhatsApp mesmo antes de conectar a primeira linha. | A ação leva à gestão dos números para gestor e à consulta das linhas para vendedor. |
| `#whatsapps` | Gestor vê orientações de implantação no pacote público. Vendedor recebe instruções sobre atribuição. | Para linhas cadastradas, o gestor pode solicitar QR Code. O vendedor consulta o estado. Uma página vazia posterior permite voltar. |
| `#catalogo` | Com o catálogo inteiro vazio, o gestor pode adicionar o primeiro item e escolher seu tipo no formulário. O vendedor vê a orientação de catálogo. Itens de outro tipo ou arquivados mantêm a navegação necessária. | Busca e disponibilidade podem ser limpas. Itens existentes abrem para edição ou consulta conforme o perfil. |
| `#equipe` | Diretório vazio oferece ao gestor convidar o primeiro vendedor. | Com integrantes, exibe o diretório. Para vendedor, informa a restrição e permite abrir Empresa. |
| `#uso` | Ciclo atual sem execuções tem orientação compacta e acesso a Diagnósticos. Mês anterior sem registros permite voltar ao atual. | Preserva franquia, custo zero, reservas e bloqueios. Período inválido solicita correção. Vendedor tem retorno ao Dashboard. |
| `#plano` | O simulador está disponível com os valores iniciais. Um saldo zero é mostrado como esgotado. | O gestor acessa Uso e a leitura da franquia. Vendedor recebe orientação para consultar o gestor. A simulação comercial acontece no front. |
| `#empresa`, `#ajustes` | Empresa, conta e papel vêm da sessão autenticada. Ajustes abre diretamente a empresa. | Alternância só aparece para quem tem mais de um vínculo. O formulário de convite pode ser aberto a partir da empresa. |
| Entrada sem sessão, `#convite`, `#recuperar` | Formulários de autenticação, aceite e recuperação têm campos próprios. | Códigos inválidos, expiração, envio, conclusão e retorno para entrar são estados de formulário. |
| Endereço desconhecido | Identifica a área como indisponível. | Oferece abrir Radar. |

## Verificação

`tests/v2-empty-states.mjs` serve o pacote compilado com sessões e respostas locais. Exercita gestor e vendedor em 1440 e 390 px, cliques nos destinos, paginação, ausência de permissão, erro com recuperação e retorno a telas preenchidas. `tests/v2-whatsapp-gate.mjs` verifica as permissões efetivas para criação e QR de linhas existentes. As capturas podem ser geradas com `SA_EVIDENCE_DIR`.

As capturas de 1440 × 900 e 390 × 844 permitem comparar Radar, Conversas e Retornos. O teste também cobre a presença exclusiva de retornos concluídos, o catálogo preenchido e a busca sem correspondência.

Os erros de carregamento usam o estado de leitura e oferecem nova tentativa. Falta de permissão do perfil e resposta de recurso inexistente têm orientações próprias. Os detalhes técnicos de integração ficam fora das mensagens de produto.

O histórico da publicação e as revisões ficam em [publicacao-v2.md](publicacao-v2.md).
