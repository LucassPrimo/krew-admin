import Link from 'next/link'

import { Card, Titulo, Vazio } from '@/components/ui'
import { dbRO } from '@/lib/db'
import { data, relativo } from '@/lib/format'
import { mascarar } from '@/lib/pii'

export const dynamic = 'force-dynamic'

type Pessoa = {
  id: string; nome: string | null; email: string | null; whatsapp: string | null
  account_type: string; onboarding_step: number | null; criado_em: string
  slug: string | null; status_assinatura: string | null
}

/**
 * Busca global de pessoas.
 *
 * A listagem nunca mostra documento — nem mascarado: CPF não é campo de
 * identificação numa lista, é dado sensível que só faz sentido na visão de uma
 * pessoa, e mesmo lá atrás de uma revelação auditada. E-mail e WhatsApp
 * aparecem mascarados porque são o que você usa para CONFERIR que achou a
 * pessoa certa.
 */
export default async function Pessoas({
  searchParams,
}: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams
  const termo = (q ?? '').trim()

  // Sem termo, mostra as mais recentes em vez de nada: abrir a tela e ver a
  // base viva é mais útil do que um campo vazio pedindo que você adivinhe.
  const pessoas = await dbRO<Pessoa[]>`
    select p.id, p.full_name as nome, u.email, p.whatsapp, p.account_type,
           p.onboarding_step, p.created_at as criado_em,
           pp.slug, s.status as status_assinatura
    from public.profiles p
    left join public.admin_auth_users u on u.id = p.id
    left join public.proposal_pages pp on pp.user_id = p.id
    left join public.subscriptions s on s.user_id = p.id
    ${termo
      ? dbRO`where p.full_name ilike ${'%' + termo + '%'}
             or u.email ilike ${'%' + termo + '%'}
             or pp.slug ilike ${'%' + termo + '%'}
             or p.id::text = ${termo}`
      : dbRO``}
    order by p.created_at desc
    limit 100
  `

  return (
    <>
      <Titulo>Pessoas</Titulo>

      <form className="mb-4">
        <input
          name="q" defaultValue={termo} placeholder="nome, e-mail, handle ou id"
          className="w-full max-w-md rounded-md border border-borda bg-painel px-3 py-2 text-sm outline-none focus:border-acento"
        />
      </form>

      <Card>
        {pessoas.length === 0 ? (
          <Vazio>Nada encontrado.</Vazio>
        ) : (
          <table className="densa">
            <thead>
              <tr>
                <th>Nome</th><th>E-mail</th><th>Handle</th><th>Tipo</th>
                <th>Onboarding</th><th>Assinatura</th><th>Cadastro</th>
              </tr>
            </thead>
            <tbody>
              {pessoas.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/pessoas/${p.id}`} className="text-acento hover:underline">
                      {p.nome ?? '(sem nome)'}
                    </Link>
                  </td>
                  <td className="text-texto-fraco">{mascarar('email', p.email)}</td>
                  <td className="font-mono text-xs">{p.slug ? `@${p.slug}` : '—'}</td>
                  <td>{p.account_type}</td>
                  <td className="tabular-nums">{p.onboarding_step ?? '—'}</td>
                  <td>{p.status_assinatura ?? '—'}</td>
                  <td className="text-texto-fraco" title={data(p.criado_em)}>
                    {relativo(p.criado_em)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  )
}
