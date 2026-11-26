# Central de IA

Entrada administrativa `/#central-ia`, com a conta staff existente. A sessão da empresa não dá acesso à Central. O BFF usa cookie próprio HttpOnly/SameSite Strict, exige mesma origem e encaminha somente as rotas administrativas consumidas pelo painel.

Configure `SA_ADMIN_KEY` somente no runtime do Web (além de `SA_SERVICE_KEY`) e na API. Sem a chave, a Central retorna indisponível. Nunca use variável `NEXT_PUBLIC` para credenciais. O segundo fator existente continua obrigatório quando exigido pela sessão staff.

A biblioteca administrativa permite preparar cadastros e tarifas antes de ativar `SA_AI_CATALOG_ENABLED`. Owner pode cadastrar e editar fornecedores/modelos, registrar uma nova tarifa com fonte e vigência e alterar orçamentos. Reserva/sombra, promoção e reversão ficam desabilitadas até a implantação ativar a execução por catálogo. Viewer e account_manager consultam sem botões de escrita.

Modelos sem tarifa verificada ficam indisponíveis nos seletores. Promoção é validada no backend contra a amostra real da sombra; o painel não aprova candidatos por reputação. Credenciais de fornecedores nunca são preenchidas ou retornadas pela interface: o cadastro contém apenas a referência do arquivo no worker.

Custos ficam separados por `provider_metered`, `local_simulated` e origem sem identificação. Totais do painel consideram apenas o modo selecionado. Reprocessamento só é oferecido para revisão atual que o servidor considera elegível, sem chamada paga, indeterminada ou em voo em suas tentativas.

Verificação: `node --test tests/v2-ai-admin-bff.mjs` e `node tests/v2-ai-admin.mjs <diretório-do-pacote>`. O browser usa dados sintéticos e upstream local; o teste backend correspondente usa API HTTP e worker com papéis SQL reais em banco isolado. Homologação com fornecedores reais é uma etapa distinta.
