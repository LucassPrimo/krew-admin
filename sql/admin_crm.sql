-- ---------------------------------------------------------------------------
-- CRM de prospecção — schema `admin_crm`
-- ---------------------------------------------------------------------------
-- Rode UMA vez, no SQL Editor do Supabase, com o papel `postgres`.
--
-- Por que fora de `public`: este repositório nunca cria nem altera nada em
-- `public` — as migrations do produto moram no krew-app, e dois históricos no
-- mesmo projeto divergem. Lead de prospecção também não é dado do produto:
-- ninguém no app lê, e o schema separado torna isso uma permissão, não uma
-- convenção. É a mesma decisão de `admin_audit`.
--
-- O painel detecta a ausência deste schema e mostra a instrução na tela em vez
-- de estourar — então rodar isto é o único passo manual.
-- ---------------------------------------------------------------------------

create schema if not exists admin_crm;

create table if not exists admin_crm.leads (
  id uuid primary key default gen_random_uuid(),

  nome text not null,
  -- Handle do Instagram, sem @. É o identificador de verdade da planilha: o
  -- nome se repete, o @ não.
  instagram text,
  -- De onde veio: 'Link School', 'Adam', indicação… Texto livre de propósito —
  -- uma lista fechada obrigaria a alterar o schema a cada canal novo, e o
  -- funil por fonte agrupa por igualdade, que texto resolve.
  fonte text,
  email text,
  whatsapp text,

  -- O handle que a bio VAI ter, anotado antes de a oferta existir. Quando a
  -- oferta é criada com este mesmo handle, o painel vincula sozinho.
  handle_pretendido text,

  -- A oferta de bio deste lead. `public.bio_ofertas.page_id`, SEM chave
  -- estrangeira, de propósito: uma FK daqui para `public` faria este schema
  -- pesar sobre o produto (a exclusão de uma oferta passaria a depender do
  -- CRM) e é exatamente a dependência que a regra do repo evita. A consulta
  -- usa left join; oferta apagada volta a aparecer como lead sem oferta.
  page_id uuid unique,

  -- Só os estágios ANTERIORES à oferta moram aqui. Depois que a oferta existe,
  -- o estágio é derivado de `bio_ofertas` (criada → convite_enviado_em →
  -- aceita_em): guardar de novo aqui seria uma segunda verdade sobre o mesmo
  -- fato, que é o defeito da planilha.
  estagio text not null default 'novo'
    check (estagio in ('novo', 'contatado', 'negociando')),

  -- Perder é a única marca que vence a derivação: dá para perder um lead com
  -- oferta criada e convite enviado, e é justamente o caso que interessa medir.
  perdido_em timestamptz,
  motivo_perda text,

  -- A data do próximo toque. É o que transforma a lista em fila de trabalho:
  -- o badge da barra lateral conta os vencidos.
  proximo_contato date,

  criado_por uuid not null references auth.users(id) on delete restrict,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Um lead por @, que é o defeito que a planilha tem hoje (a mesma pessoa
-- reaparece em duas linhas e as duas contam no funil). `lower()` porque
-- Instagram não distingue maiúscula.
create unique index if not exists leads_instagram_unico
  on admin_crm.leads (lower(instagram)) where instagram is not null;

create index if not exists leads_proximo_contato
  on admin_crm.leads (proximo_contato) where perdido_em is null;

create table if not exists admin_crm.lead_notas (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references admin_crm.leads(id) on delete cascade,
  autor_id uuid not null references auth.users(id) on delete restrict,
  texto text not null check (length(btrim(texto)) > 0),
  criada_em timestamptz not null default now()
);

create index if not exists lead_notas_por_lead
  on admin_crm.lead_notas (lead_id, criada_em desc);

-- ---------------------------------------------------------------------------
-- Grants — camada 7 do painel
-- ---------------------------------------------------------------------------
-- `grant ... on all tables` alcança só o que existe agora. Tabela nova neste
-- schema precisa de grant explícito, igual em `public`.
--
-- Sem DELETE, como em todo o resto do painel: lead errado se marca como
-- perdido, não some. O que sumiu sem rastro não dá para investigar.

grant usage on schema admin_crm to krew_admin_ro, krew_admin_rw;

grant select on all tables in schema admin_crm to krew_admin_ro;
grant select, insert, update on all tables in schema admin_crm to krew_admin_rw;

-- As duas conexões têm BYPASSRLS, mas RLS ligada aqui evita que uma chave
-- anon/service do produto alcance o CRM se algum dia este schema for exposto
-- no PostgREST. Sem policy nenhuma: ninguém além dos papéis do painel entra.
alter table admin_crm.leads enable row level security;
alter table admin_crm.lead_notas enable row level security;
