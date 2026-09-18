import Link from 'next/link'

import { Badge, Card, Titulo, Vazio } from '@/components/ui'
import { crmInstalado, listarLeads } from '@/lib/crm'
import { relativo } from '@/lib/format'
import { listarOfertas } from '@/lib/oferta'
import { mascarar } from '@/lib/pii'
import { listarUsers } from '@/lib/users'

export const dynamic = 'force-dynamic'

export default async function Buscar({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = '' } = await searchParams
  const termo = q.trim().toLowerCase()
  const [users, crmOk, todosLeads, todasOfertas] = await Promise.all([
    termo ? listarUsers({ q: termo }) : [],
    crmInstalado(), listarLeads(), listarOfertas(),
  ])
  const casa = (valor: string | null | undefined) => valor?.toLowerCase().includes(termo)
  const leads = termo && crmOk ? todosLeads.filter((l) => [l.nome, l.instagram, l.email, l.whatsapp, l.slug, l.id].some(casa)).slice(0, 30) : []
  const ofertas = termo ? todasOfertas.filter((o) => [o.nome, o.slug, o.email_convite, o.page_id].some(casa)).slice(0, 30) : []
  const total = users.length + leads.length + ofertas.length

  return (
    <>
      <Titulo>Busca global</Titulo>
      <form className="mb-5 flex max-w-2xl gap-2"><input autoFocus name="q" defaultValue={q} placeholder="Nome, @, e-mail, WhatsApp ou ID" className="h-10 flex-1 rounded-md border border-borda bg-painel px-3 text-sm outline-none focus:border-acento"/><button className="rounded-md bg-acento px-4 text-sm font-medium text-fundo">Buscar</button></form>
      {!termo ? <Vazio>Digite algo para buscar em users, leads e ofertas.</Vazio> : total === 0 ? <Vazio>Nenhum registro encontrado para “{q}”.</Vazio> : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card><h2 className="mb-3 text-sm font-medium">Users <span className="text-texto-fraco">{users.length}</span></h2>{users.length === 0 ? <p className="text-xs text-texto-fraco">Nenhum user.</p> : <ul className="space-y-3">{users.map((u) => <li key={u.id}><Link href={`/users/${u.id}`} className="text-sm font-medium text-acento hover:underline">{u.nome ?? '(sem nome)'}</Link><div className="text-xs text-texto-fraco">{u.slug ? `@${u.slug} · ` : ''}{mascarar('email', u.email)}</div></li>)}</ul>}</Card>
          <Card><h2 className="mb-3 text-sm font-medium">Leads <span className="text-texto-fraco">{leads.length}</span></h2>{leads.length === 0 ? <p className="text-xs text-texto-fraco">Nenhum lead.</p> : <ul className="space-y-3">{leads.map((l) => <li key={l.id}><div className="flex items-center gap-2"><Link href={`/crm/${l.id}`} className="text-sm font-medium text-acento hover:underline">{l.nome}</Link><Badge>{l.estagioEfetivo}</Badge></div><div className="text-xs text-texto-fraco">{l.instagram ? `@${l.instagram}` : l.email ?? 'sem contato'}</div></li>)}</ul>}</Card>
          <Card><h2 className="mb-3 text-sm font-medium">Ofertas <span className="text-texto-fraco">{ofertas.length}</span></h2>{ofertas.length === 0 ? <p className="text-xs text-texto-fraco">Nenhuma oferta.</p> : <ul className="space-y-3">{ofertas.map((o) => <li key={o.page_id}><div className="flex items-center gap-2"><Link href={o.aceita_em ? `/users/${o.user_id}` : `/ofertas/${o.page_id}`} className="text-sm font-medium text-acento hover:underline">@{o.slug}</Link><Badge tom={o.aceita_em ? 'ok' : 'aviso'}>{o.aceita_em ? 'aceita' : 'aberta'}</Badge></div><div className="text-xs text-texto-fraco">{o.nome ?? 'sem nome'} · criada {relativo(o.criada_em)}</div></li>)}</ul>}</Card>
        </div>
      )}
    </>
  )
}
