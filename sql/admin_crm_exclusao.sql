-- ---------------------------------------------------------------------------
-- CRM — permitir EXCLUIR leads
-- ---------------------------------------------------------------------------
-- Rode UMA vez, no SQL Editor do Supabase, com o papel `postgres`, DEPOIS de
-- `sql/admin_crm.sql`.
--
-- Por que é um arquivo à parte, e não uma linha a mais no outro
-- ---------------------------------------------------------------------------
-- O schema do CRM nasceu sem `grant delete` de propósito, e a nota original
-- está lá: "lead errado se marca como perdido, não some. O que sumiu sem
-- rastro não dá para investigar."
--
-- A operação pediu a exclusão de verdade, e o motivo é legítimo: lista
-- importada errada, lead de teste, a mesma planilha colada duas vezes. O que
-- mudou junto — e é o que responde à objeção original — é que o painel copia a
-- LINHA INTEIRA para `admin_audit.mutations` antes do `delete`, no MESMO
-- commit (ver `excluirLeads` em `lib/crm.ts`). Se o log falhar, nada some. O
-- que foi apagado continua investigável; o que não dá é desapagar.
--
-- Separado porque isto é uma decisão, não um detalhe de instalação: quem
-- montar outro ambiente escolhe de novo, em vez de herdar o poder por
-- omissão. Enquanto este arquivo não rodar, o painel esconde o botão e explica
-- o que falta — `exclusaoLiberada()` pergunta a permissão ao banco, não a um
-- flag no código.
--
-- As notas do lead somem junto, por `on delete cascade`. Quantas eram fica
-- gravado no detalhe da auditoria, porque depois do commit não há de onde
-- tirar esse número.
-- ---------------------------------------------------------------------------

grant delete on admin_crm.leads to krew_admin_rw;

-- `lead_notas` também, para o caso de um dia a exclusão de uma nota solta
-- passar pelo painel. O cascade de cima não depende deste grant — ele roda com
-- a permissão do dono da tabela —, mas um `delete` explícito em nota
-- precisaria dele.
grant delete on admin_crm.lead_notas to krew_admin_rw;
