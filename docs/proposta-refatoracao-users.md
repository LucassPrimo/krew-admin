# Proposta: reconstrução completa do Admin Krew

> Documento para aprovação. Nenhuma mudança funcional deve ser iniciada antes de alinharmos as decisões no fim deste documento.

## Resumo executivo

Reconstruir o admin como uma ferramenta operacional completa, conectando a jornada inteira:

```text
Lead → contato → oferta de bio → aceite → user → ativação → assinatura → retenção
```

Hoje existem boas telas para quase todos esses assuntos, mas elas funcionam como áreas separadas. A nova arquitetura deve fazer cada etapa levar naturalmente à próxima, manter uma única leitura do estado da pessoa e mostrar ao time o que precisa ser feito agora.

Dentro dessa reconstrução, transformar a área atual de **Pessoas** em **Users**, com dois domínios claramente separados:

- **Users**: pessoas que já assumiram uma conta e usam (ou usaram) o produto.
- **Ofertas de bio**: prospects para quem a Krew montou uma bio, mas que ainda não aceitaram a oferta.

Ao abrir um user, a tela deve funcionar como uma **visão 360 da jornada**: quem é, como chegou, o que já configurou, o que já fez, qual valor já recebeu, onde travou e quais ações o time pode executar com segurança.

Minha recomendação principal é não tentar resolver isso com mais campos na ficha atual. A tela deve ser reorganizada a partir das perguntas operacionais que ela precisa responder.

Este documento é a especificação de produto e implementação para aprovação. A reconstrução deve reaproveitar as regras de negócio, proteções, auditoria e componentes que já funcionam; “recriar” não significa descartar comportamento confiável.

### Estado da implementação

Primeira entrega implementada:

- `/users` é a rota oficial, com redirects de `/usuarios` e `/pessoas`;
- ofertas `oferta+…` e ofertas abertas com e-mail já substituído ficam fora de Users;
- listagem de Users com etapa, produto, plano, origem, atividade e próxima ação;
- ficha 360 inicial com alertas, jornada, produto e timeline comprovável;
- analytics ligado à ficha do User;
- página inicial com fila operacional acionável;
- CRM considera leads sem próxima ação na fila Hoje e abre por padrão como Kanban arrastável;
- Ofertas fica dentro do CRM, com filas abertas, sem convite e sem resposta; contas assumidas saem da área;
- aceite liga CRM e Oferta ao User;
- assinaturas e e-mails possuem filtros operacionais;
- busca global encontra users, leads e ofertas;
- navegação reorganizada em Aquisição, Clientes, Operação, Insights e Plataforma;
- métricas centrais, risco e assinaturas excluem contas de oferta.

Próximas entregas previstas neste documento: responsável do lead, atividades tipadas, mesclagem de duplicados, eventos explícitos de jornada e permissões administrativas por papel. Essas partes exigem evolução do schema `admin_crm` e devem entrar com migration própria, sem alterar silenciosamente um banco já instalado.

---

## Arquitetura proposta para todo o admin

### 1. Início — Central de operação

A página inicial deixa de ser apenas um painel de números e passa a responder: **o que o time precisa fazer hoje?**

Blocos recomendados:

- **Caixa de entrada operacional**: follow-ups vencidos, ofertas aguardando envio, convites sem resposta, trials terminando, pagamentos atrasados, falhas de e-mail e problemas de integridade;
- **Funil do negócio**: leads, ofertas criadas, convites enviados, aceites, users ativados e pagantes;
- **Saúde do produto**: novos users, ativação, uso recente, users em risco e cancelamentos;
- **Receita**: trials, assinantes, atrasos e cancelamento agendado;
- **Atalhos**: novo lead, importar leads, criar oferta, buscar user e consultar auditoria.

Cada número deve abrir a lista já filtrada que o explica. Nenhuma métrica deve terminar em uma tela sem ação.

### 2. Aquisição

- **CRM** — prospecção e relacionamento antes do aceite;
- **Ofertas de bio** — produção, envio e aceite da oferta;
- **Aquisição** — análise de fontes e conversão.

### 3. Clientes

- **Users** — contas reais, jornada, produto, plano e suporte;
- **Assinaturas** — carteira financeira e exceções;
- **Verificados** — fila e histórico do selo.

### 4. Comunicação e operação

- **E-mails** — entregabilidade, falhas e reenvios permitidos;
- **Auditoria** — quem fez o quê, quando e por quê;
- **Integridade** — inconsistências acionáveis com caminho de resolução.

### 5. Insights

- **Aquisição** — origem e conversão;
- **Ativação** — tempo até primeiro valor e gargalos;
- **Uso** — adoção das funcionalidades;
- **Retenção** — coortes, risco, churn e reativação;
- **Receita** — trials, pagamentos e evolução da base paga.

### 6. Plataforma

- **Dados** — explorador técnico;
- **SQL** — console restrito;
- **Configuração operacional** — regras e estados que hoje dependem de ambiente ou instalação manual.

Dados e SQL permanecem ferramentas de diagnóstico. Eles não devem ser necessários para concluir tarefas comuns do CRM, suporte ou operação.

---

## Navegação principal proposta

```text
Início

Aquisição
  CRM
  Ofertas de bio

Clientes
  Users
  Assinaturas
  Verificados

Operação
  E-mails
  Integridade
  Auditoria

Insights
  Aquisição
  Ativação e uso
  Retenção
  Receita

Plataforma
  Dados
  SQL
```

A busca global deve encontrar lead, oferta, user, handle, e-mail e IDs. O resultado precisa indicar o tipo do registro para não confundir um prospect com um cliente.

---

## 1. O problema atual

O projeto já começou a troca de nome:

- `/pessoas` redireciona para `/usuarios`;
- `/pessoas/[id]` redireciona para `/usuarios/[id]`;
- a navegação lateral já mostra **Usuários**.

Mas a separação ainda é incompleta:

1. A listagem de `/usuarios` parte de `profiles`, portanto inclui as contas-fantasma criadas para ofertas de bio.
2. O filtro tenta distinguir registros por `account_type` (`regular` e `fax`), mas as contas-fantasma já nascem com um e-mail interno no formato `oferta+handle@bekrew.com`. Esse prefixo deve ser a regra simples de exclusão da listagem de Users.
3. A ficha atual é um cadastro estático. Ela mostra nome, contato, handle, onboarding e assinatura, mas não conta a jornada.
4. “Onboarding 3” e “Assinatura active” são dados técnicos sem interpretação operacional.
5. Analytics da bio fica em uma tela separada, sem contexto sobre adoção do produto, propostas, campanhas, assinatura ou suporte.
6. Links antigos para `/pessoas` ainda aparecem em partes do painel, como verificados e relatórios.

### Consequência

Hoje é difícil responder rapidamente:

- Este registro é user ou ainda é prospect?
- O user chegou a entrar no produto?
- Terminou o onboarding?
- Publicou a bio e adicionou conteúdo?
- Recebeu ou respondeu propostas?
- Está ativo, travado ou abandonou?
- Está em trial, pagando, inadimplente ou cancelado?
- Qual é a próxima melhor ação do time?

---

## 2. Definições de domínio

### User

Uma pessoa que pode ser tratada como cliente/usuário do produto. Para esta refatoração:

- conta criada normalmente: é user;
- conta com e-mail interno iniciado por `oferta+`: **não aparece em Users**;
- quando a pessoa assume a conta e passa a usar seu e-mail real: passa a ser user;
- oferta apagada: não aparece em nenhum dos dois lugares, preservando apenas a auditoria.

Essa definição usa o prefixo técnico criado especificamente para as contas de oferta. Não recomendo usar `account_type` para separar oferta de user: tipo de conta descreve capacidades/persona e pode mudar.

### Regra operacional aplicada

O e-mail atual da conta é a fonte de verdade desta separação. `oferta+handle@bekrew.com` significa oferta; qualquer e-mail real significa User. `bio_ofertas.aceita_em` continua como histórico, mas não impede uma pessoa que já está usando a própria conta de aparecer em Users.

### Oferta de bio

É um prospect com uma página pronta criada pela Krew. Mesmo que tecnicamente exista um `auth.user`, `profile`, organização e assinatura, isso é uma implementação interna para a demonstração funcionar — não significa que a pessoa já seja user.

### Transição

```text
Prospect no CRM
      ↓
Oferta de bio criada
      ↓
Convite enviado
      ↓
Oferta aceita
      ↓
User em trial
      ↓
Ativação e uso recorrente
      ↓
Assinante / churn / reativação
```

Quando a conta deixa de usar o e-mail interno, ela passa a aparecer em Users. O histórico em `bio_ofertas` continua sendo usado para mostrar o marcador **Origem: oferta de bio**.

---

## 3. Nova arquitetura de navegação

### Menu principal

- **CRM**: leads e prospecção antes da oferta.
- **Ofertas de bio**: ofertas abertas e seu processo de aceite.
- **Users**: contas reais e ofertas já aceitas.
- **Verificados**: operação específica do selo, idealmente acessível também dentro do user.

### Rotas propostas

- `/users` — listagem e busca.
- `/users/[id]` — visão 360.
- `/users/[id]/bio` — configuração e conteúdo da bio, se o painel precisar editar users reais.
- `/users/[id]/analytics` — análise detalhada da bio.
- `/ofertas` — somente ofertas abertas por padrão.
- `/ofertas/[pageId]` — edição e operação da oferta.
- `/ofertas/[pageId]/analytics` — analytics da oferta.

Como o produto hoje está em português mas o pedido define “users”, eu usaria **Users** tanto no texto quanto na URL. Durante a migração, `/usuarios/*` e `/pessoas/*` devem redirecionar para `/users/*` para não quebrar favoritos e links internos.

---

## 4. Tela `/users`: encontrar quem precisa de atenção

A listagem não deve ser apenas uma tabela de cadastros. Ela deve funcionar como uma fila operacional.

### Busca

Buscar por:

- nome;
- e-mail;
- WhatsApp;
- `@handle`;
- user ID.

Manter e-mail e WhatsApp mascarados na listagem.

### Filtros úteis

- **Status de uso**: novo, ativando, ativo, em risco, inativo;
- **Onboarding**: não começou, em andamento, concluído;
- **Plano**: free, trial, ativo, inadimplente, cancelado;
- **Origem**: orgânico, oferta de bio, convite, importação ou desconhecida;
- **Tipo de conta**: creator, marca/agência e demais tipos reais do banco;
- **Bio**: sem bio, rascunho/inativa, publicada;
- **Período**: cadastro ou última atividade;
- **Verificado**: sim/não.

### Colunas recomendadas

1. **User** — avatar, nome, handle e contato mascarado.
2. **Etapa atual** — “Configurando bio”, “Ativo”, “Em risco”, etc.
3. **Produto** — pequenos sinais: bio publicada, links, propostas, campanhas.
4. **Plano** — free/trial/ativo/cancelado e dias restantes quando aplicável.
5. **Última atividade** — data relativa e qual foi o último evento relevante.
6. **Próxima ação** — sugestão curta: “concluir onboarding”, “trial termina em 2 dias”, “sem atividade há 30 dias”.

### Visões rápidas

- Todos;
- Novos nos últimos 7 dias;
- Ativando;
- Trials terminando;
- Em risco;
- Pagantes;
- Cancelados;
- Sem atividade.

Essas visões podem começar como filtros salvos no front-end. Não é necessário criar um sistema genérico de segmentos na primeira versão.

---

## 5. Tela `/users/[id]`: visão 360 da jornada

### Cabeçalho

Mostrar imediatamente:

- avatar, nome, `@handle` e ID copiável;
- etapa atual da jornada;
- plano e situação da assinatura;
- última atividade;
- origem do user;
- links para abrir a bio pública e analytics;
- ações administrativas disponíveis.

Exemplo de leitura: **“Ativo · Pro · entrou há 2 horas · origem: oferta de bio aceita em 12/09”**.

### Bloco “O que importa agora”

Um resumo calculado com no máximo três itens, por exemplo:

- Trial termina em 2 dias e ainda não publicou a bio.
- Recebeu 4 propostas, mas não respondeu nenhuma.
- Não há atividade há 21 dias.

O objetivo é transformar dados em decisão, sem obrigar o operador a interpretar dez tabelas.

### Jornada visual

Exibir os marcos principais, com data e estado:

1. Conta criada;
2. Primeiro acesso;
3. Onboarding iniciado;
4. Onboarding concluído;
5. Bio publicada;
6. Primeiro link adicionado;
7. Primeira visita na bio;
8. Primeira proposta recebida;
9. Primeira campanha/proposta respondida;
10. Trial iniciado;
11. Assinatura iniciada, cancelada ou reativada.

Um marco sem data deve aparecer como **ainda não aconteceu**, e não desaparecer. Isso deixa o bloqueio visível.

### Abas da ficha

#### Visão geral

- resumo “o que importa agora”;
- progresso da jornada;
- saúde/engajamento;
- últimos eventos;
- atalhos para as áreas detalhadas.

#### Produto

- estado da bio: ativa, handle, verificação, headline, links e redes;
- quantidade de links, marcas e redes configuradas;
- propostas recebidas/enviadas e seus estados;
- campanhas e participações;
- documentos e pendências relevantes;
- organizações das quais participa e seu papel.

#### Analytics

- resumo de visitas, visitantes e cliques;
- evolução recente;
- links mais clicados;
- origem do tráfego;
- botão para o painel analítico completo.

#### Plano e cobrança

- plano atual;
- início/fim do trial;
- status da assinatura;
- histórico de mudanças conhecido;
- alertas de expiração ou inconsistência.

#### Histórico

Uma timeline unificada e cronológica com eventos relevantes do produto e ações administrativas. Exemplos:

- cadastrou-se;
- aceitou oferta de bio;
- concluiu etapa do onboarding;
- publicou/desativou a bio;
- adicionou link;
- recebeu proposta;
- iniciou/cancelou assinatura;
- teve dado alterado pelo painel;
- selo concedido/removido.

Filtros: produto, assinatura, proposta/campanha e administração.

#### Dados e segurança

- dados pessoais mascarados;
- revelação auditada de dado sensível;
- IDs técnicos;
- organização e vínculos;
- atalhos para linhas relacionadas no explorador de dados;
- auditoria das ações administrativas.

---

## 6. Ações administrativas

As ações devem ficar agrupadas e explicar seu impacto. Sugestão:

### Ações comuns

- abrir bio pública;
- abrir analytics;
- copiar ID, e-mail mascarado ou handle;
- abrir registros relacionados;
- conceder/remover selo;
- reenviar comunicação permitida.

### Ações sensíveis

- revelar dado pessoal;
- alterar assinatura/trial;
- editar dados do perfil;
- desativar bio;
- operar como o user, se isso existir no futuro.

Continuar exigindo step-up, motivo e auditoria nas ações sensíveis. A ficha pode exibir as ações, mas não deve criar atalhos que contornem as proteções atuais.

### “Entrar como user”

Não recomendo implementar impersonação nesta primeira refatoração. É uma capacidade poderosa, com risco de segurança e rastreabilidade. Primeiro a tela deve responder a jornada apenas com leitura e ações explícitas/auditadas. Se ainda houver necessidade, impersonação vira um projeto separado.

---

## 7. Como calcular a etapa do user

Começar com regras transparentes, sem uma pontuação opaca.

Ordem sugerida:

1. **Cancelado** — assinatura cancelada e sem reativação.
2. **Em risco** — já foi ativado, mas está sem evento relevante por um período definido.
3. **Ativo** — teve evento relevante recente e concluiu os marcos mínimos.
4. **Ativando** — entrou/onboarding avançou, mas ainda não atingiu ativação.
5. **Novo** — conta real criada recentemente e quase sem atividade.

### Definição inicial de ativação

Para um creator, considerar ativado quando:

- onboarding concluído; e
- bio ativa; e
- ao menos um conteúdo útil configurado (link, rede ou marca); e
- ocorreu uma visita, clique ou ação relevante no produto.

Essa regra deve ficar numa função única, testada e documentada. Depois dos primeiros dados, podemos ajustar o conceito de ativação sem reescrever a UI.

### Última atividade

Não usar apenas `profiles.updated_at`, pois edição automática não significa uso. A data deve vir do evento humano mais recente entre as fontes confiáveis disponíveis. Se o banco ainda não registra login e eventos de produto de forma suficiente, a interface deve dizer **“atividade não mensurada”**, em vez de inventar precisão.

---

## 8. Modelo de dados e consultas

### Separação de Users e ofertas

Regra principal da listagem de Users:

```sql
where lower(u.email) not like 'oferta+%@bekrew.com'
```

Assim:

- conta com e-mail interno de oferta fica somente em `/ofertas`;
- conta assumida com e-mail real aparece em `/users`;
- user comum aparece em `/users`;
- a origem por oferta continua disponível por meio da linha de `bio_ofertas`.

O vínculo em `bio_ofertas` continua disponível para identificar a origem e reconstruir a jornada, mas não decide em qual lista a conta aparece.

Antes de implementar, precisamos validar se um user pode ter mais de uma `proposal_page` ou mais de uma oferta. As consultas atuais usam joins sem garantir uma única linha e podem duplicar users na listagem.

### Camada de leitura

Criar uma camada explícita, por exemplo:

- `lib/users/listar.ts` — busca, filtros, paginação e resumo;
- `lib/users/detalhe.ts` — identidade e estado atual;
- `lib/users/jornada.ts` — marcos e timeline;
- `lib/users/estado.ts` — regras de etapa, ativação e alertas.

Evitar SQL grande diretamente em `page.tsx`. A página deve compor blocos de domínio e estados de carregamento.

### Performance

- Paginação por cursor, não `limit 100` fixo.
- Índices para filtros realmente usados.
- Agregados em lote; nunca uma consulta por user.
- Carregar a ficha em blocos independentes quando uma fonte mais pesada não for essencial.
- Não varrer `link_bio_events` cru a cada abertura; usar as funções/agregações de analytics existentes.

### Eventos que podem estar faltando

Para uma jornada confiável, verificar se existem datas/eventos para:

- primeiro e último login;
- início e conclusão do onboarding;
- publicação da bio;
- criação do primeiro conteúdo;
- primeiro uso de propostas/campanhas;
- mudanças da assinatura.

Se essas datas não existirem, há duas opções:

1. inferir marcos passados com o primeiro `created_at` disponível e marcá-los como inferidos;
2. criar um log de eventos de jornada para registrar os próximos eventos com precisão.

Eu faria ambos: backfill conservador para histórico e eventos explícitos daqui para frente.

---

## 9. Migração proposta em fases

### Fase 1 — Separação correta e nomenclatura

- criar `/users`;
- excluir e-mails `oferta+…@bekrew.com` da consulta;
- usar o e-mail atual como marcador operacional de oferta ou User;
- manter ofertas aceitas, identificando sua origem;
- corrigir navegação e todos os links internos de `/pessoas` e `/usuarios`;
- manter redirects legados;
- adicionar paginação e filtros básicos.

**Resultado:** Users passa a significar users de verdade.

### Fase 2 — Visão 360 útil

- novo cabeçalho e resumo de estado;
- blocos de identidade, produto, plano e origem;
- marcos da jornada;
- últimos eventos;
- analytics resumido;
- links para detalhes existentes.

**Resultado:** suporte/operação entende a situação sem abrir várias telas.

### Fase 3 — Inteligência operacional

- etapa calculada: novo, ativando, ativo, em risco, inativo/cancelado;
- alertas “o que importa agora”;
- visões rápidas e segmentos operacionais;
- timeline unificada;
- ações administrativas contextualizadas.

**Resultado:** a área deixa de ser consulta e vira ferramenta de operação.

### Fase 4 — Instrumentação que faltar

- registrar eventos ausentes;
- backfill dos marcos inferíveis;
- medir ativação, tempo até valor e retenção por origem;
- revisar os critérios com dados reais.

**Resultado:** jornada historicamente confiável e mensurável.

---

## 10. Critérios de aceite

- Nenhuma conta com e-mail `oferta+…@bekrew.com` aparece em `/users`.
- Uma conta que já usa e-mail real aparece em `/users` mesmo se `aceita_em` estiver atrasado.
- Toda oferta aberta continua acessível em `/ofertas`.
- Uma oferta aceita passa a aparecer em `/users` sem perder o histórico de origem.
- Links antigos de `/pessoas/*` e `/usuarios/*` continuam funcionando por redirect.
- A lista não duplica user que tenha mais de uma relação associada.
- Busca e filtros preservam mascaramento de PII.
- A ficha responde, sem consultar outra tela: quem é, de onde veio, etapa atual, plano, última atividade e próximos bloqueios.
- Datas inferidas são identificadas como inferidas.
- Ausência de telemetria aparece como ausência, não como “nunca usou”.
- Ações sensíveis continuam protegidas e auditadas.
- Consultas da lista são paginadas e não fazem N+1.

---

## 11. Decisões para aprovação

Antes de implementar, proponho aprovar estas decisões:

1. **Nome e rota:** usar `Users` e `/users`, mantendo redirects de `/usuarios` e `/pessoas`.
2. **Separação:** e-mail iniciado por `oferta+` identifica uma conta de oferta; e-mail real identifica um user.
3. **Fonte da separação:** usar exclusivamente o prefixo do e-mail, não `account_type` nem o preenchimento manual de `aceita_em`.
4. **Escopo inicial:** executar primeiro as fases 1 e 2; inteligência e nova instrumentação entram depois.
5. **Impersonação:** ficar fora deste projeto inicial.
6. **Ações de edição:** decidir se a primeira versão será somente leitura + atalhos, ou se também permitirá editar dados de users reais.

---

## 12. CRM reconstruído

O CRM deve ser o lugar onde o time começa e termina o trabalho de prospecção. A tela atual já possui estágio derivado da oferta, follow-up, notas, importação, ações em lote e métricas por fonte. A reconstrução deve manter essas regras e melhorar o fluxo operacional.

### Responsabilidade do CRM

O CRM cuida da pessoa até ela aceitar a oferta. Depois do aceite:

- o lead permanece no histórico como **convertido**;
- a operação cotidiana passa para `/users/[id]`;
- CRM e User ficam ligados nos dois sentidos;
- notas comerciais não ficam visíveis para o cliente;
- o funil não perde a atribuição de fonte.

### Pipeline oficial

```text
Novo
  ↓
Contatado
  ↓
Qualificado
  ↓
Negociando
  ↓
Oferta criada
  ↓
Convite enviado
  ↓
Convertido

Saídas: perdido, sem resposta, duplicado ou desqualificado
```

Hoje os três últimos estágios já são derivados da oferta. Isso deve continuar: ninguém marca “convite enviado” manualmente quando o sistema sabe se enviou. Recomendo acrescentar **Qualificado** como estágio manual para distinguir lista bruta de oportunidade real.

### Visões do CRM

Oferecer duas visualizações sobre os mesmos dados:

- **Pipeline**: kanban por estágio, bom para enxergar volume, gargalo e mover etapas manuais;
- **Lista**: busca, filtros, seleção e ações em lote, boa para operação em volume.

O estado dos filtros deve permanecer na URL. A preferência entre lista e pipeline pode ficar salva por operador.

### Fila “Hoje”

Esta deve ser a visão padrão do CRM:

- follow-ups vencidos primeiro;
- contatos agendados para hoje;
- leads novos ainda sem primeiro contato;
- ofertas prontas ainda não enviadas;
- convites enviados sem resposta há X dias;
- leads sem próxima ação definida.

Cada item precisa mostrar uma ação direta: abrir WhatsApp, abrir Instagram, enviar e-mail, registrar contato, reagendar, criar oferta ou marcar desfecho.

### Card/linha do lead

Mostrar somente o necessário para decidir e agir:

- nome e Instagram;
- fonte;
- estágio;
- última interação;
- próxima ação e vencimento;
- responsável;
- oferta vinculada, quando existir;
- sinal de resposta/engajamento;
- atalhos de contato.

### Ficha 360 do lead

Cabeçalho:

- identidade e canais clicáveis;
- estágio e responsável;
- fonte/campanha de origem;
- próxima ação;
- oferta vinculada;
- data desde a última interação.

Corpo:

1. **Próxima ação** — o que, quando e por qual canal;
2. **Timeline comercial** — contatos, notas, mudanças de estágio, oferta, convite e aceite;
3. **Oferta** — status, prévia, visitas/cliques, convite e ações;
4. **Dados do lead** — contatos, fonte, tags, handle pretendido e responsável;
5. **Desfecho** — converter, perder, desqualificar, mesclar duplicado ou reabrir.

### Registro de atividades

Substituir “anotação solta” por atividades tipadas, sem perder texto livre:

- nota;
- ligação;
- WhatsApp;
- Instagram/DM;
- e-mail;
- reunião;
- mudança de estágio;
- oferta criada;
- convite enviado;
- resposta recebida;
- aceite ou perda.

Cada atividade registra autor e horário. Contatos podem opcionalmente já definir o próximo follow-up no mesmo formulário.

### Tarefas e próximos passos

Todo lead aberto deve ter uma destas situações explícitas:

- próxima ação agendada;
- aguardando resposta até uma data;
- sem próxima ação — exibido como pendência;
- encerrado.

Isso elimina leads esquecidos que não aparecem como vencidos porque nunca receberam uma data.

### Responsável pelo lead

Adicionar proprietário/responsável permite operar com mais de uma pessoa no time:

- filtro “meus leads”;
- distribuição manual inicialmente;
- histórico de troca de responsável;
- contadores por responsável;
- permissões futuras sem redesenhar o modelo.

Mesmo que hoje exista um único operador, preparar essa coluna agora evita que todas as filas sejam globais para sempre.

### Criação e importação

Manter a prévia antes de importar, limite em lote e detecção de duplicados. Melhorar com:

- mapeamento visual de colunas;
- normalização de Instagram, telefone e e-mail;
- resultado por linha: criar, atualizar, duplicado ou erro;
- opção segura de atualizar campos vazios de um lead existente;
- atribuição de fonte, responsável, tags e próxima ação para toda a importação;
- relatório final recuperável na auditoria.

### Duplicidade e mesclagem

Detectar duplicados por:

- Instagram normalizado;
- e-mail normalizado;
- WhatsApp normalizado;
- handle da oferta;
- vínculo com user convertido.

Não apagar silenciosamente. Uma ação de **mesclar** deve escolher o registro principal, mover atividades e oferta, preservar fontes alternativas no histórico e auditar a operação.

### Integração CRM → Oferta

Criar oferta a partir do lead deve:

- preencher nome, handle, e-mail, Instagram e contexto já conhecido;
- vincular automaticamente a oferta criada;
- registrar a atividade “oferta criada”;
- sugerir revisão e envio como próxima ação;
- impedir uma segunda oferta aberta para o mesmo lead sem confirmação explícita.

### Integração Oferta → User

No aceite:

- marcar o lead como convertido automaticamente;
- remover follow-ups comerciais pendentes;
- criar o vínculo navegável com o user;
- transferir a atribuição de origem;
- iniciar corretamente o trial;
- trocar o e-mail interno `oferta+…` pelo e-mail real no momento correto;
- registrar o evento na timeline do lead e do user.

O processo não deve depender de um operador marcar manualmente um aceite que o produto consegue detectar. Se hoje não existe um evento confiável de aceite, esta automação precisa ser criada como parte da reconstrução.

### Métricas do CRM

- leads criados por período;
- tempo até primeiro contato;
- follow-ups no prazo;
- conversão entre etapas;
- tempo médio em cada etapa;
- conversão por fonte e responsável;
- ofertas criadas, enviadas e aceitas;
- tempo entre convite e aceite;
- motivos de perda;
- ativação e pagamento por fonte após a conversão.

A conversão não termina no aceite. O CRM precisa mostrar quais fontes trazem users que ativam e pagam, não apenas quem aceita uma página pronta.

---

## 13. Ofertas de bio reconstruídas

Separar a lista em filas operacionais:

- **Rascunhos** — ainda sendo montadas;
- **Prontas para revisar**;
- **Prontas para enviar**;
- **Convite enviado** — aguardando aceite;
- **Sem resposta** — convite antigo que precisa de follow-up;
- **Aceitas** — histórico, com link para o User;
- **Perdidas/expiradas** — encerradas sem apagar histórico.

Hoje a página nasce no ar imediatamente. A reconstrução deve tornar explícitos os estados de produção e publicação para evitar tratar uma oferta incompleta como pronta.

Na ficha da oferta, reunir:

- status e próxima ação;
- lead de origem;
- editor da bio;
- checklist de qualidade;
- prévia pública;
- analytics de abertura/cliques;
- histórico de convites;
- aceite e destino no User;
- ações de encerrar/excluir com as proteções atuais.

Checklist sugerido: identidade, capa/avatar, texto, redes, links, visualização mobile, handle, e-mail do convite e consentimento.

---

## 14. Demais áreas do admin

### Assinaturas

Transformar a página em fila financeira:

- pagamentos atrasados;
- trials terminando sem ativação;
- cancelamento agendado;
- assinatura ativa;
- cancelados recentemente;
- inconsistências entre plano e acesso.

Cada linha abre o User, mostra datas absolutas e relativas e explica qual ação é possível. Qualquer alteração manual de trial/plano exige step-up, motivo e auditoria.

### Verificados

Integrar à ficha do User e manter uma fila própria para volume:

- aguardando análise;
- concedidos recentemente;
- removidos;
- inconsistências;
- motivo e autor de cada decisão.

Links atuais para `/pessoas` devem migrar para `/users`.

### E-mails

Organizar por estado e ação:

- falhas que podem ser reenviadas;
- entregues;
- aguardando processamento;
- destinatários bloqueados/bounce;
- templates e contexto de disparo.

Uma falha deve apontar para seu lead, oferta ou user. Reenvio precisa ser idempotente e auditado.

### Integridade

Cada verificação deve ter:

- gravidade;
- quantidade afetada;
- primeira/última ocorrência;
- explicação do impacto;
- registros afetados;
- correção automática segura ou instrução exata;
- estado: novo, reconhecido, resolvido.

### Auditoria

Busca e filtros por operador, entidade, ação, período e criticidade. Cada evento precisa ligar para o registro atual quando ele ainda existir. Dados sensíveis permanecem protegidos.

### Dados e SQL

Manter como ferramentas avançadas, visualmente separadas da operação. O console deve continuar restrito, com limites, timeout, somente leitura por padrão e auditoria. Tarefas recorrentes nunca devem exigir SQL manual.

### Insights

Unificar definições e períodos. Todas as páginas devem usar as mesmas regras para “user”, “oferta”, “ativado”, “ativo”, “em risco” e “pagante”. Ofertas com `oferta+…` não podem inflar cadastro, onboarding, bio ativa ou retenção de users reais.

---

## 15. Padrões comuns de interface

### Cabeçalho de página

Todas as áreas devem ter:

- título e descrição curta;
- ação primária única;
- filtros relevantes;
- período, quando aplicável;
- indicação da última atualização;
- estado de escrita desligada sem esconder dados.

### Listas

- paginação por cursor;
- ordenação explícita;
- filtros na URL;
- filtros ativos visíveis e removíveis;
- busca com debounce no servidor para bases grandes;
- seleção em lote somente onde existe uma ação segura;
- estados de vazio que explicam como começar;
- colunas adaptadas para desktop e cards úteis no mobile.

### Feedback das ações

- estado de envio;
- sucesso confirmando o que mudou;
- erro traduzido e recuperável;
- atualização otimista apenas quando puder ser revertida;
- proteção contra duplo clique/idempotência;
- confirmação forte para ações destrutivas.

### Estados e nomenclatura

Criar registries únicos para rótulos e cores de:

- estágio do CRM;
- estado da oferta;
- etapa do user;
- assinatura;
- entrega de e-mail;
- severidade de integridade.

Não mostrar enums crus como `active`, `past_due`, `fax` ou números de onboarding sem tradução.

### Acessibilidade e responsividade

- navegação completa por teclado;
- foco visível;
- contraste adequado;
- status não comunicado apenas por cor;
- tabelas com cabeçalhos corretos;
- drawers ou cards no mobile sem esconder ações essenciais;
- loading, erro e vazio definidos para cada bloco.

---

## 16. Arquitetura técnica

### Domínios

Organizar consultas e regras por domínio, não por página:

```text
lib/admin/dashboard
lib/admin/crm
lib/admin/offers
lib/admin/users
lib/admin/subscriptions
lib/admin/communications
lib/admin/insights
```

Server Components fazem leitura; Server Actions pequenas e específicas fazem escrita. Componentes de interface não devem conter SQL nem redefinir regras de estágio.

### Identidade unificada

Criar um resolvedor de identidade capaz de ligar:

- `crm.lead_id`;
- `bio_ofertas.page_id`;
- `proposal_pages.user_id`;
- `auth.users.id`/`profiles.id`;
- organização e assinatura.

Lead, oferta e user continuam entidades diferentes. O resolvedor conecta a jornada sem fundi-las numa tabela ambígua.

### Eventos da jornada

Criar um modelo de eventos administrativos/produto para fatos importantes que hoje são inferidos:

- lead criado e contatado;
- oferta criada/revisada/enviada;
- convite aberto e aceito;
- primeiro login;
- onboarding concluído;
- bio publicada;
- ativação;
- trial iniciado/encerrado;
- assinatura iniciada/cancelada;
- risco e reativação.

Eventos não substituem as tabelas de origem; formam uma timeline confiável e permitem métricas históricas sem depender do estado atual.

### Permissões

Definir papéis administrativos, mesmo que inicialmente todos tenham acesso amplo:

- comercial;
- suporte/operação;
- financeiro;
- administrador técnico.

Permissão deve ser verificada no servidor em toda ação. Esconder botão é apenas interface.

### Observabilidade

- erro com contexto e ID rastreável;
- tempo das consultas críticas;
- ações e falhas de escrita;
- jobs/eventos atrasados;
- contadores da central operacional produzidos por consultas conhecidas e testadas.

---

## 17. Plano de entrega do admin completo

### Etapa 0 — Contratos e métricas

- fechar definições de lead, oferta, user, ativado, ativo e pagante;
- mapear eventos existentes e ausentes;
- documentar estados e transições;
- criar testes das regras atuais antes de mover telas.

### Etapa 1 — Fundação e navegação

- nova arquitetura do menu;
- `/users` como rota oficial;
- busca global por tipo de entidade;
- componentes padrão de cabeçalho, filtros, listas e estados;
- redirects legados;
- separação de ofertas `oferta+…` das métricas de users.

### Etapa 2 — CRM operacional

- fila Hoje;
- lista e pipeline;
- atividade tipada e próxima ação obrigatória;
- responsável;
- duplicidade/mesclagem;
- importação melhorada;
- integração automática com ofertas.

### Etapa 3 — Ofertas e conversão

- estados de produção/envio;
- checklist;
- histórico do convite;
- aceite automático;
- troca correta do e-mail interno;
- handoff completo para User.

### Etapa 4 — Users 360

- listagem de users reais;
- ficha, jornada, timeline e alertas;
- produto, analytics e assinatura;
- ações existentes contextualizadas.

### Etapa 5 — Operação e finanças

- central de operação;
- assinaturas acionáveis;
- e-mails vinculados às entidades;
- integridade com resolução;
- verificados integrado a Users;
- auditoria navegável.

### Etapa 6 — Insights e otimização

- métricas unificadas;
- conversão até ativação/pagamento por origem;
- coortes e retenção;
- performance, índices e agregações;
- refinamento com uso real do time.

Cada etapa deve entrar utilizável. Evitar uma troca total de uma vez: preservar rotas antigas até a nova equivalente estar validada.

---

## 18. Critérios de aceite do admin completo

- A página inicial mostra tarefas reais e cada métrica leva à lista filtrada correspondente.
- Um operador consegue trabalhar os leads do dia sem planilha ou SQL.
- Todo lead aberto tem próxima ação, espera explícita ou desfecho.
- Oferta, lead e user ficam ligados sem duplicar sua responsabilidade.
- O aceite transforma automaticamente a operação comercial em jornada de user.
- Contas `oferta+…` não aparecem em Users nem contaminam métricas de produto.
- O mesmo status possui o mesmo significado e rótulo em todas as telas.
- Nenhuma ação administrativa sensível perde autorização, step-up ou auditoria.
- Listas grandes são paginadas e não fazem N+1.
- Toda tela possui loading, erro, vazio e modo somente leitura.
- Fluxos críticos têm testes de regra e testes de integração.
- Links legados continuam funcionando durante a migração.

---

## 19. Decisões adicionais para aprovação

1. Adotar a arquitetura de navegação por **Aquisição, Clientes, Operação, Insights e Plataforma**.
2. Fazer da página inicial uma **central de tarefas**, não somente um dashboard.
3. Manter CRM e Ofertas separados, mas integrados automaticamente.
4. Adicionar **Qualificado**, responsável e atividades tipadas ao CRM.
5. Ter visualizações de CRM em lista e pipeline.
6. Automatizar o aceite e o handoff Oferta → User.
7. Criar eventos de jornada para não depender apenas de inferências do estado atual.
8. Entregar incrementalmente, preservando proteções e regras existentes.

## Recomendação final

Eu aprovaria a arquitetura completa e iniciaria pelas etapas 0 a 3: contratos, navegação, CRM e conversão das ofertas. Esse trecho resolve o maior problema estrutural — a passagem de prospect para user — e cria a base correta para a ficha 360, métricas, receita e retenção.

Para Users, começaria com **leitura + ações já existentes**, sem edição genérica de perfil nem impersonação. Para o CRM, priorizaria a fila Hoje, próxima ação explícita e automação do vínculo com Oferta/User. Essa combinação torna o admin funcional no trabalho diário antes de expandir análises e capacidades sensíveis.
