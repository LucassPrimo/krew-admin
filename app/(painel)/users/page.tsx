import Link from 'next/link'

import { Badge, Card, Titulo, Vazio } from '@/components/ui'
import { data, numero, relativo } from '@/lib/format'
import { mascarar } from '@/lib/pii'
import { listarUsers, type EtapaUser, type FiltrosUsers } from '@/lib/users'

export const dynamic = 'force-dynamic'

const ETAPA: Record<EtapaUser, { rotulo: string; tom: 'neutro' | 'ok' | 'aviso' | 'perigo' }> = {
  novo: { rotulo: 'Novo', tom: 'neutro' },
  ativando: { rotulo: 'Ativando', tom: 'aviso' },
  ativo: { rotulo: 'Ativo', tom: 'ok' },
  em_risco: { rotulo: 'Em risco', tom: 'perigo' },
  inativo: { rotulo: 'Inativo', tom: 'neutro' },
}

function proximaAcao(u: Awaited<ReturnType<typeof listarUsers>>[number]): string {
  if (u.etapa === 'novo') return 'Iniciar ativação'
  if (u.etapa === 'ativando' && !u.bio_ativo) return 'Publicar a bio'
  if (u.etapa === 'ativando' && u.links + u.redes + u.marcas === 0) return 'Configurar conteúdo'
  if (u.etapa === 'em_risco') return 'Entender queda de uso'
  if (u.etapa === 'inativo') return 'Avaliar reativação'
  if (u.trial_ends_at && new Date(u.trial_ends_at) > new Date()) return `Trial ${relativo(u.trial_ends_at)}`
  return 'Acompanhar'
}

function plano(u: Awaited<ReturnType<typeof listarUsers>>[number]): string {
  if (u.status_assinatura === 'active') return 'Pro'
  if (u.status_assinatura === 'past_due') return 'Atrasado'
  if (u.trial_ends_at && new Date(u.trial_ends_at) > new Date()) return 'Trial'
  return 'Free'
}

export default async function Users({ searchParams }: { searchParams: Promise<FiltrosUsers> }) {
  const filtros = await searchParams
  const users = await listarUsers(filtros)

  return (
    <>
      <Titulo>Users</Titulo>
      <p className="-mt-3 mb-4 text-sm text-texto-fraco">
        Contas reais do produto. Ofertas com e-mail interno <code className="font-mono">oferta+…</code> ficam fora.
      </p>

      <form className="mb-4 flex flex-wrap gap-2 rounded-lg border border-borda bg-painel p-3">
        <input
          name="q" defaultValue={filtros.q} placeholder="nome, e-mail, WhatsApp, @ ou ID"
          className="h-9 min-w-64 flex-1 rounded-md border border-borda bg-fundo px-3 text-sm outline-none focus:border-acento"
        />
        <select name="etapa" defaultValue={filtros.etapa ?? 'todos'} className="h-9 rounded-md border border-borda bg-fundo px-2 text-sm">
          <option value="todos">Todas as etapas</option>
          {Object.entries(ETAPA).map(([valor, e]) => <option key={valor} value={valor}>{e.rotulo}</option>)}
        </select>
        <select name="plano" defaultValue={filtros.plano ?? 'todos'} className="h-9 rounded-md border border-borda bg-fundo px-2 text-sm">
          <option value="todos">Todos os planos</option><option value="pago">Pro</option>
          <option value="trial">Trial</option><option value="atrasado">Atrasado</option><option value="free">Free</option>
        </select>
        <select name="origem" defaultValue={filtros.origem ?? 'todos'} className="h-9 rounded-md border border-borda bg-fundo px-2 text-sm">
          <option value="todos">Todas as origens</option><option value="organico">Orgânico</option><option value="oferta">Oferta de bio</option>
        </select>
        <select name="bio" defaultValue={filtros.bio ?? 'todos'} className="h-9 rounded-md border border-borda bg-fundo px-2 text-sm">
          <option value="todos">Qualquer bio</option><option value="ativa">Bio ativa</option>
          <option value="inativa">Bio inativa</option><option value="sem_bio">Sem bio</option>
        </select>
        <button className="h-9 rounded-md bg-acento px-3 text-sm font-medium text-fundo">Filtrar</button>
        <Link href="/users" className="self-center px-1 text-xs text-texto-fraco hover:text-texto">limpar</Link>
      </form>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium">Base real</h2>
          <span className="text-xs text-texto-fraco">{numero(users.length)} resultado(s)</span>
        </div>
        {users.length === 0 ? <Vazio>Nenhum user com esses filtros.</Vazio> : (
          <div className="overflow-x-auto">
            <table className="densa min-w-[940px]">
              <thead><tr><th>User</th><th>Etapa</th><th>Produto</th><th>Plano</th><th>Origem</th><th>Última atividade</th><th>Próxima ação</th></tr></thead>
              <tbody>{users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <Link href={`/users/${u.id}`} className="font-medium text-acento hover:underline">{u.nome ?? '(sem nome)'}</Link>
                    <div className="text-[11px] text-texto-fraco">
                      {u.slug ? `@${u.slug} · ` : ''}{mascarar('email', u.email)}
                    </div>
                  </td>
                  <td><Badge tom={ETAPA[u.etapa].tom}>{ETAPA[u.etapa].rotulo}</Badge></td>
                  <td className="text-xs text-texto-fraco">
                    {u.bio_ativo ? 'bio no ar' : u.slug ? 'bio inativa' : 'sem bio'} · {u.links} links · {u.propostas} propostas
                  </td>
                  <td>{plano(u)}</td>
                  <td>{u.origem === 'oferta' ? 'Oferta de bio' : 'Orgânico'}</td>
                  <td title={data(u.ultima_atividade)} className={u.etapa === 'em_risco' || u.etapa === 'inativo' ? 'text-perigo' : 'text-texto-fraco'}>
                    {u.ultima_atividade ? relativo(u.ultima_atividade) : 'atividade não mensurada'}
                  </td>
                  <td className="text-xs">{proximaAcao(u)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}
