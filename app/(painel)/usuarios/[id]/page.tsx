import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirAtor } from '@/lib/auth'
import { dbRO } from '@/lib/db'
import { Card, Titulo, Vazio } from '@/components/ui'
import { data, relativo } from '@/lib/format'
import { mascarar } from '@/lib/pii'

export const dynamic = 'force-dynamic'

type Usuario = {
  id: string
  nome: string | null
  email: string | null
  whatsapp: string | null
  account_type: string
  onboarding_step: number | null
  criado_em: string
  slug: string | null
  status_assinatura: string | null
}

export default async function UsuarioDetail({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await exigirAtor()
  const usuario = await dbRO<Usuario>`
    select p.id, p.full_name as nome, u.email, p.whatsapp, p.account_type,
           p.onboarding_step, p.created_at as criado_em,
           pp.slug, s.status as status_assinatura
    from public.profiles p
    left join public.admin_auth_users u on u.id = p.id
    left join public.proposal_pages pp on pp.user_id = p.id
    left join public.subscriptions s on s.user_id = p.id
    where p.id = ${id}
  `
  if (!usuario) notFound()

  const oferta = await dbRO<any[]>`select * from public.proposal_pages where user_id = ${id}`

  return (
    <>
      <Titulo>Usuário {usuario.nome ?? '(sem nome)'}</Titulo>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <Link href="/usuarios" className="text-sm text-texto-fraco hover:text-texto">voltar</Link>
      </div>
      <Card>
        <dl className="grid grid-cols-2 gap-2">
          <dt className="font-medium text-texto-fraco">ID</dt>
          <dd className="font-mono text-xs text-texto-fraco">{usuario.id}</dd>
          <dt className="font-medium text-texto-fraco">Nome</dt>
          <dd>{usuario.nome ?? '(sem nome)'}</dd>
          <dt className="font-medium text-texto-fraco">E-mail</dt>
          <dd className="text-texto-fraco">{mascarar('email', usuario.email)}</dd>
          <dt className="font-medium text-texto-fraco">Whatsapp</dt>
          <dd className="text-texto-fraco">{mascarar('whatsapp', usuario.whatsapp)}</dd>
          <dt className="font-medium text-texto-fraco">Handle</dt>
          <dd className="font-mono text-xs">{usuario.slug ? `@${usuario.slug}` : '—'}</dd>
          <dt className="font-medium text-texto-fraco">Tipo</dt>
          <dd>{usuario.account_type}</dd>
          <dt className="font-medium text-texto-fraco">Onboarding</dt>
          <dd className="tabular-nums">{usuario.onboarding_step ?? '—'}</dd>
          <dt className="font-medium text-texto-fraco">Assinatura</dt>
          <dd>{usuario.status_assinatura ?? '—'}</dd>
          <dt className="font-medium text-texto-fraco">Cadastro</dt>
          <dd className="text-texto-fraco" title={data(usuario.criado_em)}>{relativo(usuario.criado_em)}</dd>
        </dl>
      </Card>
      {oferta[0] && !oferta[0].aceita_em && (
        <Link href={`/usuarios/${id}/revelar?campo=cpf_cnpj`} className="ml-2 text-xs text-acento hover:underline">revelar</Link>
      )}
      <Link href={`/usuarios/${id}/analytics`} className="text-acento hover:underline mt-4 block">ver analytics da bio</Link>
    </>
  )
}
