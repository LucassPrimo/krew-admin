import Link from 'next/link'
import { notFound } from 'next/navigation'
import { z } from 'zod'

import { Badge, Card, Titulo, Vazio } from '@/components/ui'
import { data, dataHora, relativo } from '@/lib/format'
import { mascarar } from '@/lib/pii'
import { buscarUser, timelineUser } from '@/lib/users'

export const dynamic = 'force-dynamic'

const ROTULO_ETAPA = { novo: 'Novo', ativando: 'Ativando', ativo: 'Ativo', em_risco: 'Em risco', inativo: 'Inativo' }

export default async function UserDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  const [user, eventos] = await Promise.all([buscarUser(id), timelineUser(id)])
  if (!user) notFound()

  const conteudo = user.links + user.redes + user.marcas
  const alertas = [
    !user.bio_ativo ? 'A bio ainda não está publicada.' : null,
    conteudo === 0 ? 'Nenhum link, rede ou marca foi configurado.' : null,
    user.etapa === 'em_risco' ? `Sem atividade relevante ${relativo(user.ultima_atividade)}.` : null,
    user.etapa === 'inativo' ? `User inativo: última atividade ${relativo(user.ultima_atividade)}.` : null,
  ].filter(Boolean) as string[]

  const marcos = [
    { nome: 'Conta criada', feito: true, quando: user.criado_em },
    { nome: 'Onboarding concluído', feito: (user.onboarding_step ?? 0) >= 3, quando: null },
    { nome: 'Bio publicada', feito: Boolean(user.bio_ativo), quando: null },
    { nome: 'Primeiro conteúdo', feito: conteudo > 0, quando: eventos.filter((e) => e.tipo === 'produto').at(-1)?.ocorrido_em ?? null },
    { nome: 'Primeira proposta', feito: user.propostas > 0, quando: null },
    { nome: 'Primeira campanha', feito: user.campanhas > 0, quando: null },
  ]

  return (
    <>
      <Link href="/users" className="mb-3 inline-block text-xs text-texto-fraco hover:text-texto">← Users</Link>
      <Titulo acao={<div className="flex gap-2">{user.slug && <a href={`https://bekrew.com/@${user.slug}`} target="_blank" rel="noreferrer" className="rounded-md border border-borda px-3 py-1.5 text-xs hover:border-borda-forte">Abrir bio</a>} {user.slug && <Link href={`/users/${id}/analytics`} className="rounded-md bg-acento px-3 py-1.5 text-xs font-medium text-fundo">Analytics</Link>}</div>}>
        {user.nome ?? '(sem nome)'}
      </Titulo>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <Badge tom={user.etapa === 'ativo' ? 'ok' : user.etapa === 'em_risco' ? 'perigo' : 'aviso'}>{ROTULO_ETAPA[user.etapa]}</Badge>
        <span className="text-texto-fraco">{user.status_assinatura === 'active' ? 'Pro' : user.trial_ends_at && new Date(user.trial_ends_at) > new Date() ? `Trial ${relativo(user.trial_ends_at)}` : 'Free'}</span>
        <span className="text-texto-fraco">·</span>
        <span className="text-texto-fraco">origem: {user.origem === 'oferta' ? 'oferta de bio' : 'orgânico'}</span>
        <span className="text-texto-fraco">·</span>
        <span className="text-texto-fraco">atividade {user.ultima_atividade ? relativo(user.ultima_atividade) : 'não mensurada'}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-4">
          <Card>
            <h2 className="mb-3 text-sm font-medium">O que importa agora</h2>
            {alertas.length === 0 ? <p className="text-sm text-ok">Nenhum bloqueio evidente na jornada.</p> : (
              <ul className="space-y-2 text-sm">{alertas.slice(0, 3).map((a) => <li key={a} className="rounded-md border border-aviso/30 bg-acento/5 px-3 py-2">{a}</li>)}</ul>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-medium">Jornada</h2>
            <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{marcos.map((m) => (
              <li key={m.nome} className={`rounded-md border p-3 ${m.feito ? 'border-ok/30' : 'border-borda'}`}>
                <div className="text-xs text-texto-fraco">{m.feito ? 'Concluído' : 'Ainda não aconteceu'}</div>
                <div className="mt-1 text-sm font-medium">{m.nome}</div>
                {m.quando && <div className="mt-1 text-[11px] text-texto-fraco">{data(m.quando)}</div>}
              </li>
            ))}</ol>
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-medium">Histórico</h2>
            {eventos.length === 0 ? <Vazio>Nenhum evento comprovável ainda.</Vazio> : (
              <ol className="space-y-3">{eventos.map((e, i) => (
                <li key={`${e.tipo}-${e.ocorrido_em}-${i}`} className="flex gap-3 border-b border-borda pb-3 last:border-0 last:pb-0">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-acento" />
                  <div><div className="text-sm">{e.titulo}</div>{e.detalhe && <div className="text-xs text-texto-fraco">{e.detalhe}</div>}<div className="text-[11px] text-texto-fraco" title={dataHora(e.ocorrido_em)}>{relativo(e.ocorrido_em)}</div></div>
                </li>
              ))}</ol>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <h2 className="mb-3 text-sm font-medium">Identidade</h2>
            <dl className="space-y-2 text-sm">
              <div><dt className="text-xs text-texto-fraco">ID</dt><dd className="break-all font-mono text-[11px]">{user.id}</dd></div>
              <div><dt className="text-xs text-texto-fraco">E-mail</dt><dd>{mascarar('email', user.email)}</dd></div>
              <div><dt className="text-xs text-texto-fraco">WhatsApp</dt><dd>{mascarar('whatsapp', user.whatsapp)}</dd></div>
              <div><dt className="text-xs text-texto-fraco">Handle</dt><dd>{user.slug ? `@${user.slug}` : '—'}</dd></div>
              <div><dt className="text-xs text-texto-fraco">Cadastro</dt><dd title={dataHora(user.criado_em)}>{data(user.criado_em)}</dd></div>
            </dl>
          </Card>
          <Card>
            <h2 className="mb-3 text-sm font-medium">Produto</h2>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-xs text-texto-fraco">Bio</dt><dd>{user.bio_ativo ? 'No ar' : user.slug ? 'Inativa' : 'Sem bio'}</dd></div>
              <div><dt className="text-xs text-texto-fraco">Onboarding</dt><dd>{user.onboarding_step ?? '—'}</dd></div>
              <div><dt className="text-xs text-texto-fraco">Links</dt><dd>{user.links}</dd></div>
              <div><dt className="text-xs text-texto-fraco">Redes</dt><dd>{user.redes}</dd></div>
              <div><dt className="text-xs text-texto-fraco">Marcas</dt><dd>{user.marcas}</dd></div>
              <div><dt className="text-xs text-texto-fraco">Propostas</dt><dd>{user.propostas}</dd></div>
              <div><dt className="text-xs text-texto-fraco">Campanhas</dt><dd>{user.campanhas}</dd></div>
              <div><dt className="text-xs text-texto-fraco">Verificado</dt><dd>{user.bio_verificado ? 'Sim' : 'Não'}</dd></div>
            </dl>
          </Card>
          <Card>
            <h2 className="mb-2 text-sm font-medium">Dados relacionados</h2>
            <p className="mb-3 text-xs text-texto-fraco">Diagnóstico técnico sem misturar edição à visão da jornada.</p>
            <Link href={`/dados/profiles/${user.id}`} className="text-sm text-acento hover:underline">Abrir perfil nos dados</Link>
          </Card>
        </div>
      </div>
    </>
  )
}
