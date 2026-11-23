# Publicação da V2 em v2.salesanalyzer.app

Este roteiro descreve o Web V2 público compilado com o override Traefik e o contrato da API V2 conferido no commit `816a53d`. O Web é publicado em um projeto Docker próprio e atende somente `v2.salesanalyzer.app`; a configuração de `www.salesanalyzer.app` permanece no projeto atual.

## Publicação de 23/11/2026

A revisão `sha256:3fc3c1d8b7c4292c7618d345ea5b2dfebf28287553f34b8ab25ae170d8f5be26` está em produção. A consulta por HTTPS retornou HTTP 200, estado `ok` e essa revisão. As páginas iniciais da V1 e da V2 também responderam com HTTP 200. [Saúde da V2](https://v2.salesanalyzer.app/healthz)

Esta versão inclui os estados de primeiro acesso do catálogo, Pipeline, Uso, Radar, Ganhos e consultas da Zoe. O fluxo Radar → Conversa → Ganho foi testado com respostas locais do contrato da API.

O pacote público padrão compila `NEXT_PUBLIC_SALES_WHATSAPP_SELF_SERVE=disabled`. Assim, os botões de criar e provisionar uma linha nova ficam ocultos e nenhuma dessas rotas é chamada pela interface. O QR Code para **linhas já cadastradas** continua disponível ao gestor pela rota existente de pareamento. A tela de primeiro acesso orienta a configuração assistida e os estados vazios estão descritos em [v2-empty-states.md](v2-empty-states.md).

Somente depois de publicar e verificar `POST /v1/connections` e `POST /v1/connections/{id}/provision`, o provisionamento e o isolamento da credencial administrativa, gere outro pacote com `NEXT_PUBLIC_SALES_WHATSAPP_SELF_SERVE=enabled`. Essa capacidade é definida no build; mudar apenas o ambiente do contêiner não ativa o botão no pacote atual.

Para reproduzir o pacote a partir da raiz do repositório, com Node 24 e as dependências instaladas:

```sh
NEXT_PUBLIC_SALES_ACCESS_MODE=public NEXT_PUBLIC_SALES_WHATSAPP_SELF_SERVE=disabled npm run package:privado
```

O empacotador gera um diretório de contexto Docker e um `.tar.gz`. O nome gerado pode mudar; confira a revisão em `REVISION` e o SHA-256 do arquivo antes de transferir. Para montar uma imagem `linux/amd64` com o contexto já conferido:

```sh
docker buildx build --platform linux/amd64 --load -t sales-analyzer-web:v2-public .artifacts/sales-v2-web-2aC4wv
docker image save -o sales-v2-web-amd64.tar sales-analyzer-web:v2-public
```

## Configuração de execução

O backend deve expor a API `http://sa-v2-api:4331` na rede Docker definida em `SA_BFF_NETWORK`. O perfil `deploy/production/compose.yaml` em preparação atribui o alias `sa-v2-api` somente à API nessa rede `bff`, sem publicar API, GoTrue ou bancos no host. O nome efetivo da rede é `<projeto-backend>_bff`. O Traefik existente roda em rede `host`, e seu Docker provider alcança o Web pelo IP do contêiner nessa bridge BFF. Use somente o `bff.env` do backend de produção, fora do pacote e do repositório, para fornecer `SA_API_URL`, `SA_BFF_NETWORK` e `SA_SERVICE_KEY`. A chave precisa ser a mesma configurada na API. Configure também no ambiente do Compose Web:

```sh
export SA_WEB_IMAGE=sales-analyzer-web:v2-public
export SA_WEB_BIND_PORT=4349
export SA_WEB_PUBLIC_PORT=4349
# Configure somente se o entrypoint HTTPS não se chamar websecure.
# export SA_TRAEFIK_ENTRYPOINT=nome-do-entrypoint-https
```

Configure `V2_WEB_ORIGIN=https://v2.salesanalyzer.app` no ambiente privado do backend. O backend usa essa origem para GoTrue e para o link `/#convite`. O override Traefik fixa `SA_WEB_ORIGIN` no mesmo valor; o Web valida `Host` e `Origin` e emite o cookie de sessão com `Secure`.

No host, após carregar a imagem e disponibilizar `compose.web.yaml` e `compose.traefik.yaml` do pacote:

```sh
docker load -i sales-v2-web-amd64.tar
docker compose --env-file /caminho/privado/bff.env -f compose.web.yaml -f compose.traefik.yaml config --quiet
docker compose --env-file /caminho/privado/bff.env -f compose.web.yaml -f compose.traefik.yaml up -d --no-build --pull never --wait
```

Use um projeto Compose dedicado ao Web. O serviço mantém a porta 4349 vinculada a `127.0.0.1` e continua apenas na rede BFF. O Docker provider do Traefik encontra esse Web na rota `Host(\`v2.salesanalyzer.app\`)`, no entrypoint HTTPS, com o resolver ACME `letsencrypt`. A label `traefik.docker.network` aponta para a bridge BFF; Traefik acessa a porta interna 4319 pelo IP do Web nessa bridge. O override fixa a origem HTTPS da V2 e exige `SA_WEB_IMAGE`. O Traefik preserva o `Host` original por padrão; o Web responderá `403` se receber outro host. O override não adiciona labels públicas a API, GoTrue, bancos, Stage ou fixtures.

Antes de iniciar, confirme que o contêiner Traefik permanece em rede `host`, que o Docker provider está ativo e que a rede BFF do backend de produção contém o alias `sa-v2-api`. Depois de iniciar, confira `https://v2.salesanalyzer.app/healthz`, o certificado TLS e a revisão do pacote. `www.salesanalyzer.app` deve continuar na rota atual.

## Dependências de produção ainda pendentes no perfil Stage

O Compose Stage do commit `816a53d` ainda configura Mailpit para e-mails de convite e recuperação de senha, remetente de exemplo, usuários de teste, análise sintética e atendimento desativado por padrão. Isso permite conferir contrato e interface, mas não entrega acesso e operação real a vendedores externos. O perfil `deploy/production/compose.yaml` está em preparação e precisa ser validado com entrega de e-mail real, identidades e vínculos dos usuários escolhidos, dados comerciais reais, conexão WhatsApp dedicada e atendimento real quando o envio for parte do teste.

## Checklist de homologação pública

1. Abrir `https://v2.salesanalyzer.app/` por HTTPS. Conferir que `/healthz` retorna a revisão acima e que `www.salesanalyzer.app` continua atendendo a V1.
2. Fazer login como gestor real. Conferir empresa e papel exibidos, alternância de empresa autorizada, cookie `sa2_session` com `HttpOnly`, `Secure` e `SameSite=Strict`, e logout com expiração do cookie.
3. Convidar um vendedor selecionado. Conferir entrega na caixa real, link `https://v2.salesanalyzer.app/#convite`, aceite com conta existente ou criação e login do vendedor. Conferir recuperação de senha por e-mail real.
4. Como vendedor, verificar que Radar, lista de conversas e detalhe mostram apenas as linhas atribuídas. Abrir uma oportunidade e registrar `Venda ganha` com valor. Como gestor, confirmar o ganho e conferir o valor em Ganhos e no Dashboard.
5. Se o atendimento real estiver habilitado, conferir o estado da linha, ativar atendimento no contato certo, enviar uma mensagem e confirmar recibo e histórico. Verificar também erro e repetição sem duplicação quando a resposta do provedor atrasar.
6. Repetir login, Radar, conversa, ganho e convite em viewport de celular. Testar expiração de sessão, recarga da página e uma tentativa de acesso a empresa ou conversa sem permissão.

Os testes locais de Host/Origin, cookie HTTPS e HTTP, login, expiração e logout passaram. O pacote público compilou e foi inspecionado localmente em tela estreita e larga. A homologação dos fluxos autenticados em produção requer contas e dados reais no destino.
