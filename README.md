# Krew Admin

Painel interno da Krew. Repositório, deploy e domínio separados do produto;
banco compartilhado com o `krew-app`.

A arquitetura e as decisões estão em `../KREW_ADMIN_PLANO.md`. Este README é o
que você precisa para rodar e publicar.

---

## O que ele faz

| Rota | O que resolve |
|---|---|
| `/` | Visão geral: o que exige ação hoje, depois o que mede o negócio |
| `/crm` | **CRM de prospecção** — a fila de criadores antes de virarem clientes, com funil e follow-up |
| `/ofertas` | **Bio de oferta** — página pronta para apresentar a um criador antes de ele ter conta |
| `/pessoas`, `/pessoas/[id]` | Busca global e a visão 360, onde a maior parte do suporte acontece |
| `/analise/*` | Assinaturas, aquisição, uso do produto e retenção |
| `/dados`, `/dados/[tabela]` | As 45 tabelas de `public`; as 14 do registry são editáveis com diff e auditoria |
| `/integridade` | Health checks: o painel achando o problema antes do cliente ligar |
| `/emails` | Falhas de entrega, com a resposta do provedor |
| `/sql` | Console somente-leitura, 5s e 200 linhas de teto |
| `/auditoria` | Tudo que foi feito aqui dentro, incluindo revelações de PII |

## Segurança, em uma tela

```
Requisição
 ├─ 1. Vercel Deployment Protection        ← antes do Next.js
 ├─ 2. proxy.ts: sessão válida?
 ├─ 3. proxy.ts: id ∈ ADMIN_USER_IDS?      ← lista da Vercel
 ├─ 4. proxy.ts: AAL2 (TOTP nesta sessão)?
 ├─ 5. layout do painel: platform_admins?  ← lista do banco
 ├─ 6. escrita: kill switch + TOTP < 15min + campo no registry
 └─ 7. Postgres: krew_admin_ro sem GRANT de escrita
```

As camadas 3 e 5 são listas independentes de propósito: comprometer a Vercel não
basta, comprometer o SQL não basta.

## Ambiente

`.env.local` (nunca commitado — as duas primeiras abrem o banco de produção):

```
ADMIN_DATABASE_URL_RO=postgres://krew_admin_ro:…      # só SELECT
ADMIN_DATABASE_URL_RW=postgres://krew_admin_rw:…      # INSERT/UPDATE, sem DELETE
ADMIN_USER_IDS=<uuid>[,<uuid>]                        # camada 3
ADMIN_WRITES_ENABLED=false                            # kill switch — só 'true' liga
NEXT_PUBLIC_SUPABASE_URL=…
NEXT_PUBLIC_SUPABASE_ANON_KEY=…
ADMIN_SUPABASE_SERVICE_KEY=…                          # OPCIONAL — só a bio de oferta
```

`ADMIN_SUPABASE_SERVICE_KEY` é opcional: sem ela o painel sobe inteiro e apenas
a criação de oferta fica indisponível, dizendo isso na tela. Ela é necessária
porque criar a conta-fantasma e disparar o convite são chamadas da Admin API de
Auth, que não existem em SQL.

```bash
npm ci
npm run dev        # http://localhost:3000
npm run typecheck
npm test           # guards e executor de mutações
npm run build
```

## Como funciona a bio de oferta

O problema: `proposal_pages.user_id` é `NOT NULL`, `UNIQUE` e FK para
`auth.users`. Não existe página sem dono, e tornar isso nulável obrigaria a
revisar toda a RLS, o `get_bio_by_slug`, os links e o analytics do produto.

A solução: a oferta é uma conta **de verdade**, criada pelo painel — sem senha e
sem e-mail confirmado. O trigger `fn_create_profile_on_signup` já monta perfil,
organização, membership e assinatura; o painel preenche a página e os links. O
que marca aquilo como oferta mora só em `public.bio_ofertas`, que o produto não
lê.

Consequências, todas deliberadas:

- a página **é pública e buscável** como qualquer outra, e o visitante não vê
  nenhuma marca de que é uma oferta;
- o **trial de 5 dias é zerado na criação** e concedido quando você marca a
  oferta como aceita — senão ele queimaria com a página parada esperando
  resposta;
- aceitar é: você envia o convite (troca o e-mail da conta para o do criador),
  ele define a senha e assume a conta. **Nenhum dado migra** — página, links,
  cliques e histórico continuam de pé.

## Como funciona o CRM

Ele substitui a planilha de prospecção — Nome, Instagram, Fonte, o handle da
bio e três colunas de SIM/FALSE: "Link criado?", "Enviado", "Aceito".

**As três colunas não existem aqui.** Elas respondem sobre algo que o banco já
sabe: uma linha em `bio_ofertas` é o link criado, `convite_enviado_em` é o
enviado, `aceita_em` é o aceito. Marcadas à mão, divergem do produto no primeiro
dia corrido — que é o motivo de a planilha ter parado de funcionar. O lead
guarda só o que é dele (quem é, de onde veio, o combinado, quando falar de
novo), aponta para a oferta, e o estágio dali em diante é LIDO dela a cada
consulta:

```
novo → contatado → negociando   |   oferta criada → convite enviado → aceito
        ↑ marcados à mão        |   ↑ lidos de public.bio_ofertas
                    perdido  ← vence os dois, e é reversível
```

O que o painel faz com isso: o funil conta quem ALCANÇOU cada etapa (não quem
está parado nela) e cruza com a fonte, respondendo de onde vem lead que aceita;
o `proximo_contato` vencido sobe o lead na lista e vira o badge da barra
lateral; e "Criar a oferta" na ficha leva para `/ofertas/nova` já preenchido,
vinculando na volta.

### Trazer a planilha

`public/modelo-leads.csv` é o formato de entrada — nove colunas: Nome,
Instagram, Fonte, Handle da bio, E-mail, WhatsApp, Estágio, Próximo contato,
Notas. Ele já vem com os leads que estavam na planilha antiga. Baixe pelo botão
em `/crm/importar`, preencha no Sheets e traga de volta colando (TAB) ou como
CSV (vírgula ou ponto e vírgula, com aspas onde a nota tem vírgula dentro).

O import confere ANTES de gravar: mostra linha a linha o que vai ser criado, o
que já está no CRM (pelo @) e o que tem problema. Quem traz o handle de uma bio
que já existe nasce vinculado a ela. As colunas "Link criado?", "Enviado" e
"Aceito" são ignoradas de propósito — elas vêm da oferta, e reimportá-las
recriaria a divergência que tirou a planilha de serviço.

O parser é o mesmo dos dois lados (`lib/crm-importar.ts`, sem banco): a prévia
que você confere é literalmente o que a gravação vai fazer. Teto de 500 linhas
por leva, e tudo numa transação só.

### O passo manual

O dado mora no schema **`admin_crm`**, fora de `public` — pela regra abaixo, e
porque lead de prospecção não é dado do produto. Rode uma vez, no SQL Editor do
Supabase, com o papel `postgres`:

```
sql/admin_crm.sql
```

Sem ele o painel sobe inteiro e só `/crm` fica indisponível, dizendo isso na
tela. Depois de rodar, a próxima navegação já enxerga — sem redeploy.

Não há DELETE: lead errado se marca como perdido, com motivo. Toda escrita passa
por `admin_audit.mutations` no mesmo commit, como o resto do painel.

## Regra do schema

**Este repositório nunca cria nem altera nada em `public`.** Migrations vivem no
`krew-app`; dois históricos no mesmo projeto Supabase divergem, e a divergência
só aparece quando já doeu.

Uma armadilha que já mordeu: `grant ... on all tables` alcança só o que existia
quando rodou. **Toda tabela nova precisa de grant explícito** para os roles
`krew_admin_*` — o health check "Tabelas que o painel não consegue ler" avisa
quando alguém esquecer.

## Falta você fazer

- [ ] Projeto na Vercel com **Deployment Protection** ligada e **Preview
      Deployments** desligados ou protegidos
- [ ] Domínio não óbvio (`interno.bekrew.com` é melhor que `admin.`), sem link em
      lugar nenhum
- [ ] Variáveis de ambiente marcadas como **Sensitive** na Vercel
- [ ] Cadastrar o TOTP no primeiro acesso e guardar os códigos de recuperação
      **fora do computador**
- [ ] Rodar `sql/admin_crm.sql` no Supabase para ligar o `/crm`
- [ ] Trazer a planilha de prospecção por `/crm/importar`
- [ ] Virar `ADMIN_WRITES_ENABLED=true` quando tiver navegado e confiado no painel
