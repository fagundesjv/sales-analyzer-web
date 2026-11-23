# Web V2 em homologação privada

O arquivo REVISION identifica os fontes e configurações do pacote por SHA-256. O endpoint /healthz retorna esse identificador.

A interface compilada, o BFF e o servidor HTTP Node formam uma única imagem. O Web é o único processo que o navegador acessa. A API recebe os pedidos por http://sa-v2-api:4331 na rede Docker dedicada ao BFF. GoTrue, bancos, worker e provedor de WhatsApp ficam nas redes administradas pelo Backend. O contrato de sessão, a autorização por empresa e a chave de serviço são os mesmos do Web integrado em desenvolvimento.

## Preparar o artefato na máquina de build

Com Node 24 e as dependências do projeto instaladas, execute `npm run package:privado`. O comando informa o diretório do contexto Docker e o arquivo tar.gz correspondente em .artifacts. O build usa uma cópia temporária dos fontes permitidos e variáveis explícitas. A imagem contém apenas HTML, scripts, estilos, fontes, os recursos de marca necessários e dois módulos Node. O servidor reconhece a marca da compilação integrada antes de atender. A raiz e /portal/ servem a mesma interface. A demonstração estática continua com seu build próprio.

Para a página de entrada pública, execute `NEXT_PUBLIC_SALES_ACCESS_MODE=public npm run package:privado`. O build padrão mantém o texto de homologação privada. Cada modo recebe uma revisão diferente no pacote compilado.

Para preparar a imagem x86_64 fora da VPS, execute a partir do diretório do contexto Docker informado pelo comando anterior:

```sh
docker buildx build --platform linux/amd64 --load -t sales-analyzer-web:v2-private .
docker image save -o sales-v2-web-amd64.tar sales-analyzer-web:v2-private
```

O pacote de fontes compilados também permite montar a imagem no destino com uma cópia de arquivos sobre a base Node. A VPS não precisa instalar dependências JavaScript nem executar o compilador do Next.

## Iniciar com a API privada

O orquestrador fornece a imagem, compose.web.yaml, a rede Docker já criada pelo Backend e a chave exclusiva do BFF em arquivo privado fora do contexto de build. O Web se conecta apenas à rede indicada por SA_BFF_NETWORK, que deve conter o serviço da API com o alias sa-v2-api, conforme deploy/stage/compose.yaml do Backend. Use um projeto Docker distinto para o Web. O Compose injeta apenas a chave e a URL da API no ambiente de serviço em tempo de execução a partir de bff.env. O arquivo fica com o operador. O processo roda como usuário node, com filesystem somente leitura e limite de memória de 128 MiB.

No diretório do pacote:

```sh
# Se a imagem veio da máquina de build
docker load -i /caminho/privado/sales-v2-web-amd64.tar
# Ajuste para o nome da rede da homologação e para o arquivo privado do BFF
export SA_BFF_NETWORK=sa-v2-stage_bff
export SA_WEB_BIND_PORT=4319
export SA_WEB_PUBLIC_PORT=4349
docker compose --env-file /caminho/privado/bff.env -f compose.web.yaml config --quiet
docker compose --env-file /caminho/privado/bff.env -f compose.web.yaml up -d --no-build --pull never --wait
```

O contêiner escuta na porta interna 4319. A publicação do host é 127.0.0.1:4319. SA_WEB_BIND_PORT controla a publicação no host da VPS. SA_WEB_PUBLIC_PORT indica a porta que o navegador vê no computador do operador pelo túnel. Host e Origin precisam corresponder ao endereço visível no navegador. O BFF valida a origem em mutações e usa cookie HttpOnly com SameSite=Strict. A API autoriza empresa e papel dentro da transação. O healthcheck GET /healthz indica que o Web conseguiu carregar o HTML integrado e a configuração local. O teste de login e o diagnóstico verificam as dependências de aplicação.

Para publicar o Web atrás de um proxy HTTPS, configure `SA_WEB_ORIGIN=https://v2.salesanalyzer.app` no ambiente do Compose. O valor deve conter somente esquema e host, sem barra final, caminho ou parâmetros. O proxy encaminha o cabeçalho Host original e termina o TLS antes de acessar a porta local do Web. O healthcheck usa esse mesmo Host no pedido HTTP interno. Nesse modo, o cookie de sessão também recebe Secure, inclusive ao sair ou expirar. Sem SA_WEB_ORIGIN, o acesso local por túnel mantém a origem HTTP derivada de SA_WEB_PUBLIC_PORT.

Na VPS onde o Traefik usa a rede `host` e o Docker provider, mantenha `compose.web.yaml` e adicione `compose.traefik.yaml` no mesmo comando `docker compose`, depois de definir `SA_WEB_IMAGE=sales-analyzer-web:v2-public`. O override exige essa imagem, fixa `SA_WEB_ORIGIN=https://v2.salesanalyzer.app`, mantém o Web apenas na rede `bff` já configurada, declara uma rota exclusiva para `v2.salesanalyzer.app` no entrypoint `websecure` e usa o resolver ACME `letsencrypt`. A label `traefik.docker.network` seleciona a rede BFF para o Docker provider encontrar o IP do Web. Caso o entrypoint HTTPS tenha outro nome, configure `SA_TRAEFIK_ENTRYPOINT`. A porta local publicada por `compose.web.yaml` permanece vinculada a `127.0.0.1`; o Traefik alcança a porta interna 4319 pelo IP do Web na bridge BFF. Use somente o `bff.env` do backend de produção. Nenhuma label pública é adicionada aos serviços do backend ou do Stage.

```sh
export SA_WEB_IMAGE=sales-analyzer-web:v2-public
docker compose --env-file /caminho/privado/bff.env -f compose.web.yaml -f compose.traefik.yaml config --quiet
docker compose --env-file /caminho/privado/bff.env -f compose.web.yaml -f compose.traefik.yaml up -d --no-build --pull never --wait
```

## Acesso pelo túnel

Na máquina do operador, use seu destino SSH autorizado e mantenha o túnel aberto:

```sh
ssh -N -L 127.0.0.1:4349:127.0.0.1:4319 usuario@host-da-homologacao
```

Abra http://127.0.0.1:4349/. A porta de origem do túnel corresponde a SA_WEB_PUBLIC_PORT e a porta de destino a SA_WEB_BIND_PORT. O deploy, o acesso à VPS e a inspeção dos serviços existentes pertencem ao orquestrador.

## Repetir somente em Docker local

Com o Backend V2 local e seu GoTrue ativos, carregue a mesma imagem linux/amd64 usada no destino. Use o compose do pacote e o arquivo bff.env local gerado pelo Backend. Exporte SA_BFF_NETWORK=sales-analyzer-v2-local_bff, SA_API_URL=http://api:4331, SA_WEB_BIND_PORT=4351 e SA_WEB_PUBLIC_PORT=4351 para conviver com o Web dev em 4319. Após `up`, no repositório Web, execute `SA_WEB_URL=http://127.0.0.1:4351 npm run test:v2-integrada`. Para desligar apenas o Web desse projeto, use `docker compose --env-file /caminho/privado/bff.env -f compose.web.yaml down`. Os volumes e serviços do Backend pertencem a outro projeto.
