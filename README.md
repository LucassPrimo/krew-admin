# Krew Admin

Painel interno de administração da Krew. Repositório separado do produto de
propósito: um XSS no app do creator não pode alcançar a aplicação que edita o
dado de todos os clientes.

O plano completo — modelo de ameaça, decisões e o que ainda falta — está em
`KREW_ADMIN_PLANO.md`, um nível acima deste repositório.

---

## As sete camadas

Toda requisição atravessa, nesta ordem:

| # | Camada | Onde |
|---|---|---|
| 1 | Perímetro externo (Vercel Authentication / Cloudflare Access) | antes do Next.js |
| 2 | Sessão Supabase válida | `proxy.ts` + `lib/auth.ts` |
| 3 | `user.id` ∈ `ADMIN_USER_IDS` (variável de ambiente) | `proxy.ts` + `lib/auth.ts` |
| 4 | AAL2 — segundo fator verificado nesta sessão | `proxy.ts` + `lib/auth.ts` |
| 5 | `platform_admins` contém esse id (banco) | `lib/auth.ts` |
| 6 | Escrita: step-up < 15 min + campo no registry + kill switch | `lib/mutate.ts` |
| 7 | Role do Postgres sem GRANT de escrita | banco |

As camadas 3 e 5 são duas listas independentes, e é preciso passar nas **duas**.
Quem comprometer o banco e se inserir em `platform_admins` esbarra na 3; quem
comprometer a Vercel e editar o env esbarra na 5.

A camada 7 é a que mais trabalha na prática: `krew_admin_ro` — usada por ~90% do
código — não tem `INSERT`, `UPDATE` nem `DELETE` em nenhuma tabela. Escrita por
engano não é um bug que este código consegue cometer; o Postgres recusa.

---

## Setup

### 1. Senhas dos roles do banco

Os roles `krew_admin_ro` e `krew_admin_rw` já existem (migration
`20260812032200_admin_audit_e_roles_do_painel.sql`, no repo `krew`), mas nascem
`NOLOGIN` e **sem senha** — para que nenhuma credencial exista em migration, em
repositório ou em log de ferramenta.

Gere duas senhas fortes localmente:

```bash
openssl rand -base64 32   # rode duas vezes, uma para cada role
```

No **SQL Editor da Supabase**, cole (substituindo pelas senhas geradas):

```sql
alter role krew_admin_ro with login password 'SENHA_RO_AQUI';
alter role krew_admin_rw with login password 'SENHA_RW_AQUI';
```

Guarde as duas no gerenciador de senhas. Elas não vão para lugar nenhum além
do `.env.local` e das variáveis de ambiente da Vercel.

### 2. Strings de conexão

Em *Project Settings → Database → Connection string → Transaction pooler*,
copie o formato e troque usuário e senha. O usuário no pooler é
`<role>.<project_ref>`:

```
postgresql://krew_admin_ro.ycjnkjcbteyzeliaayod:SENHA_RO@aws-0-<regiao>.pooler.supabase.com:6543/postgres
postgresql://krew_admin_rw.ycjnkjcbteyzeliaayod:SENHA_RW@aws-0-<regiao>.pooler.supabase.com:6543/postgres
```

### 3. Ambiente local

```bash
cp .env.example .env.local   # preencha
npm install
npm run dev
```

`.env.local` está no `.gitignore`. Nunca versione.

### 4. Primeiro acesso

1. Entre com o e-mail e a senha da sua conta Krew.
2. O painel exige o cadastro de um autenticador TOTP. Use um app em **outro
   dispositivo** — segundo fator no mesmo aparelho da sessão não é segundo fator.
3. Guarde os códigos de recuperação da conta Supabase **fora deste computador**.

Perdeu o autenticador? A recuperação é SQL manual no banco. É deliberado.

### 5. Deploy

- [ ] Repositório **privado** no GitHub
- [ ] Projeto próprio na Vercel (não é o mesmo do app)
- [ ] **Deployment Protection → Vercel Authentication: ligada** (camada 1)
- [ ] Preview Deployments desligados, ou protegidos
- [ ] Variáveis de ambiente marcadas como *Sensitive*
- [ ] Domínio não óbvio, sem link em lugar nenhum

---

## O kill switch

`ADMIN_WRITES_ENABLED=false` derruba toda escrita do painel no próximo deploy,
sem tocar em código. Quando ligado, o cabeçalho mostra `somente leitura` o tempo
todo. É o primeiro botão a apertar se algo cheirar errado.

---

## O registry

`lib/registry.ts` é o que separa este painel de um `UPDATE` solto numa aba do
navegador. Nada é editável por ser uma coluna do banco; é editável por estar
declarado ali, com tipo, limites e aviso quando a mudança tem consequência.

- Tabela fora do registry: **visível, intocável**. A leitura sai da introspecção
  do banco, então as 35 tabelas aparecem em `/dados` desde já.
- Coluna fora do registry: idem.
- `/dados` avisa quantas colunas existem no banco e o registry não conhece.

Para liberar a edição de um campo novo, declare-o no registry **e** confira se o
role `krew_admin_rw` tem GRANT naquela tabela (a lista está na migration).

Não existe `DELETE` pelo painel, em nenhuma tabela. Apagar continua possível —
no SQL Editor, com você olhando.

---

## Auditoria

Três tabelas no schema `admin_audit`, todas append-only por GRANT (os roles têm
`INSERT` e `SELECT`, nunca `UPDATE` ou `DELETE`):

- `mutations` — toda alteração, com antes/depois, motivo obrigatório, IP.
  Gravada na **mesma transação** da alteração: se o log falha, a alteração faz
  rollback.
- `pii_access` — toda revelação de CPF, WhatsApp ou dados bancários. Aqui o
  registro de auditoria **é a autorização**: a tela só exibe o valor se existir
  uma linha gravada nos últimos 2 minutos, por você, para aquele campo. Não há
  como ver sem registrar.
- `sessions` — cada abertura de sessão.

Visível em `/auditoria`, e por registro na própria tela de edição.

---

## Estrutura

```
proxy.ts              camadas 2–4 + CSP com nonce + expiração de sessão
lib/env.ts            ambiente validado no boot (falha fechado)
lib/db.ts             conexão de LEITURA (a única exportada)
lib/mutate.ts         conexão de escrita (privada) + executor auditado
lib/auth.ts           exigirAdmin() — as camadas 2 a 5
lib/registry.ts       o que é editável, e como
lib/pii.ts            máscaras
lib/introspect.ts     leitura genérica do schema
app/(painel)/         tudo que é autenticado
```

---

## O que ainda não existe

Ver `KREW_ADMIN_PLANO.md` para o plano completo. Em aberto:

- `/integridade` — os checks de consistência do §8 (hoje só os 5 do dashboard)
- `/analise/*` — coortes, funil de ativação, retenção (§12)
- Ações operacionais: confirmar e-mail, regenerar token, reenviar e-mail
- "Ver como" (somente leitura)
- Registry das 21 tabelas restantes — as 14 principais já estão
