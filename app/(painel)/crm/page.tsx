import Link from 'next/link'

import { Aviso, Badge, Card, Titulo, Vazio } from '@/components/ui'
import { escritaLigada } from '@/lib/env'
import { data, numero, relativo } from '@/lib/format'
import {
  ROTULO, crmInstalado, listarLeads, montarFunil,
  type Estagio, type Lead,
} from '@/lib/crm'
import { NovoLeadBotao } from './novo-lead'

export const dynamic = 'force-dynamic'

/**
 * O CRM: a fila de criadores antes de eles virarem clientes.
 *
 * A tela responde, de cima para baixo, três perguntas em ordem de urgência:
 * com quem eu falo HOJE (os vencidos vêm primeiro), onde a prospecção está
 * perdendo gente (o funil), e de onde vem lead que aceita (as fontes).
 *
 * As colunas "Link criado?", "Enviado" e "Aceito" da planilha não existem como
 * campo: viram uma coluna só, o estágio, lido de `bio_ofertas` a cada
 * consulta. Ver `lib/crm.ts`.
 */

const TOM: Record<Estagio, 'neutro' | 'ok' | 'aviso' | 'perigo'> = {
  novo: 'neutro',
  contatado: 'neutro',
  negociando: 'aviso',
  oferta_criada: 'aviso',
  convite_enviado: 'aviso',
  aceito: 'ok',
  perdido: 'perigo',
}

function vencido(l: Lead): boolean {
  if (!l.proximo_contato || l.estagioEfetivo === 'aceito' || l.estagioEfetivo === 'perdido') {
    return false
  }
  return new Date(l.proximo_contato) <= new Date(new Date().toDateString())
}

export default async function CRM({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estagio?: string; fonte?: string; hoje?: string }>
}) {
  const filtro = await searchParams
  const [instalado, todos] = await Promise.all([crmInstalado(), listarLeads()])
  const funil = montarFunil(todos)

  const termo = (filtro.q ?? '').trim().toLowerCase()
  const leads = todos.filter((l) => {
    if (filtro.estagio && l.estagioEfetivo !== filtro.estagio) return false
    if (filtro.fonte && (l.fonte?.trim() || 'sem fonte') !== filtro.fonte) return false
    if (filtro.hoje === '1' && !vencido(l)) return false
    if (!termo) return true
    return [l.nome, l.instagram, l.fonte, l.slug, l.handle_pretendido, l.email]
      .some((v) => v?.toLowerCase().includes(termo))
  })

  // Os vencidos sobem. A ordem do banco é por criação, que é a certa para
  // "quem chegou por último"; a pergunta desta tela é outra.
  const ordenados = [...leads].sort((a, b) => Number(vencido(b)) - Number(vencido(a)))

  return (
    <>
      <Titulo acao={<NovoLeadBotao
            desabilitado={!instalado || !escritaLigada}
            fontes={funil.fontes.map((f) => f.fonte).filter((f) => f !== 'sem fonte')}
          />}>
        CRM de prospecção
      </Titulo>

      {!instalado && (
        <div className="mb-4">
          <Aviso tom="perigo">
            O schema <code className="font-mono">admin_crm</code> ainda não existe neste
            banco. Rode <code className="font-mono">sql/admin_crm.sql</code> no SQL Editor
            do Supabase, com o papel <code className="font-mono">postgres</code> — é o
            único passo manual, e o painel passa a enxergar na navegação seguinte, sem
            redeploy. O arquivo cria o schema fora de <code className="font-mono">public</code>,
            porque migrations do produto moram no krew-app.
          </Aviso>
        </div>
      )}

      {instalado && !escritaLigada && (
        <div className="mb-4">
          <Aviso>
            A escrita está desligada, então nada pode ser criado ou anotado agora.
            A lista abaixo continua real.
          </Aviso>
        </div>
      )}

      {/* ------------------------------------------------------------------
          O funil. "Alcançaram" e não "estão em": um lead aceito também foi
          contatado um dia, e contar só quem está parado no degrau daria
          conversão acima de 100% entre etapas.
          ------------------------------------------------------------------ */}
      <Card className="mb-4">
        <h2 className="mb-1 text-sm font-medium">Funil</h2>
        <p className="mb-3 text-xs text-texto-fraco">
          Quantos leads alcançaram cada etapa, e quantos estão parados nela agora.
          A porcentagem é sobre a etapa anterior — é ali que a prospecção perde gente.
        </p>

        {funil.total === 0 ? (
          <Vazio>Nenhum lead ainda.</Vazio>
        ) : (
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {funil.etapas.map((e, i) => {
              const anterior = i === 0 ? null : funil.etapas[i - 1].alcancaram
              const taxa = anterior ? Math.round((e.alcancaram / anterior) * 100) : null
              return (
                <Link
                  key={e.estagio}
                  href={`/crm?estagio=${e.estagio}`}
                  className="rounded-lg border border-borda bg-painel-2 p-3 hover:border-borda-forte"
                >
                  <div className="text-xs text-texto-fraco">{ROTULO[e.estagio]}</div>
                  <div className="mt-1 text-xl font-medium tabular-nums">{e.alcancaram}</div>
                  <div className="mt-0.5 text-[11px] text-texto-fraco">
                    {taxa === null ? 'entraram' : `${taxa}% da etapa anterior`}
                    {e.parados > 0 && ` · ${e.parados} parado${e.parados > 1 ? 's' : ''}`}
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {funil.perdidos > 0 && (
          <p className="mt-3 text-xs text-texto-fraco">
            <Link href="/crm?estagio=perdido" className="text-acento hover:underline">
              {funil.perdidos} perdido{funil.perdidos > 1 ? 's' : ''}
            </Link>{' '}
            — fora do funil acima, mas contados no degrau que alcançaram.
          </p>
        )}
      </Card>

      {funil.fontes.length > 0 && (
        <Card className="mb-4">
          <h2 className="mb-3 text-sm font-medium">Por fonte</h2>
          <table className="densa">
            <thead>
              <tr>
                <th>Fonte</th><th>Leads</th><th>Com oferta</th>
                <th>Aceitos</th><th>Perdidos</th><th>Conversão</th>
              </tr>
            </thead>
            <tbody>
              {funil.fontes.map((f) => (
                <tr key={f.fonte}>
                  <td>
                    <Link
                      href={`/crm?fonte=${encodeURIComponent(f.fonte)}`}
                      className="text-acento hover:underline"
                    >
                      {f.fonte}
                    </Link>
                  </td>
                  <td className="tabular-nums">{numero(f.total)}</td>
                  <td className="tabular-nums">{numero(f.ofertas)}</td>
                  <td className="tabular-nums">{numero(f.aceitos)}</td>
                  <td className="tabular-nums text-texto-fraco">{numero(f.perdidos)}</td>
                  <td className="tabular-nums">
                    {Math.round((f.aceitos / f.total) * 100)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Card>
        {/* Filtro em `<form method="get">`: o estado mora na URL, então dá para
            mandar "olha os do Link School parados" para alguém por link, e o
            botão voltar do navegador funciona. Não precisa de JavaScript. */}
        <form method="get" className="mb-3 flex flex-wrap items-center gap-2">
          <input
            name="q" defaultValue={filtro.q ?? ''} placeholder="nome, @, fonte ou handle"
            className="h-9 w-56 rounded-lg border border-borda bg-fundo px-3 text-sm outline-none focus:border-acento"
          />
          <select
            name="estagio" defaultValue={filtro.estagio ?? ''}
            className="h-9 rounded-lg border border-borda bg-fundo px-2 text-sm outline-none focus:border-acento"
          >
            <option value="">todos os estágios</option>
            {(Object.keys(ROTULO) as Estagio[]).map((e) => (
              <option key={e} value={e}>{ROTULO[e]}</option>
            ))}
          </select>
          <select
            name="fonte" defaultValue={filtro.fonte ?? ''}
            className="h-9 rounded-lg border border-borda bg-fundo px-2 text-sm outline-none focus:border-acento"
          >
            <option value="">todas as fontes</option>
            {funil.fontes.map((f) => (
              <option key={f.fonte} value={f.fonte}>{f.fonte}</option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-texto-fraco">
            <input type="checkbox" name="hoje" value="1" defaultChecked={filtro.hoje === '1'} />
            só follow-up vencido
          </label>
          <button
            type="submit"
            className="h-9 rounded-lg border border-borda-forte px-3 text-sm hover:border-acento"
          >
            filtrar
          </button>
          {(filtro.q || filtro.estagio || filtro.fonte || filtro.hoje) && (
            <Link href="/crm" className="text-xs text-texto-fraco hover:text-texto">
              limpar
            </Link>
          )}
        </form>

        {ordenados.length === 0 ? (
          <Vazio>
            {todos.length === 0
              ? 'Nenhum lead ainda. Comece pelo botão "Novo lead".'
              : 'Nenhum lead com esse filtro.'}
          </Vazio>
        ) : (
          <table className="densa">
            <thead>
              <tr>
                <th>Nome</th><th>Instagram</th><th>Fonte</th><th>Bio</th>
                <th>Estágio</th><th>Próximo contato</th><th>Notas</th><th></th>
              </tr>
            </thead>
            <tbody>
              {ordenados.map((l) => (
                <tr key={l.id}>
                  <td>
                    <Link href={`/crm/${l.id}`} className="hover:underline">{l.nome}</Link>
                  </td>
                  <td className="font-mono text-xs">
                    {l.instagram ? (
                      <a
                        href={`https://instagram.com/${l.instagram}`}
                        target="_blank" rel="noreferrer"
                        className="text-acento hover:underline"
                      >
                        @{l.instagram}
                      </a>
                    ) : (
                      <span className="text-texto-fraco">—</span>
                    )}
                  </td>
                  <td className="text-texto-fraco">{l.fonte ?? '—'}</td>
                  <td className="font-mono text-xs">
                    {l.slug ? (
                      <a
                        href={`https://bekrew.com/@${l.slug}`}
                        target="_blank" rel="noreferrer"
                        className="text-acento hover:underline"
                      >
                        @{l.slug}
                      </a>
                    ) : l.handle_pretendido ? (
                      <span className="text-texto-fraco" title="Handle pretendido — a oferta ainda não existe">
                        @{l.handle_pretendido}
                      </span>
                    ) : (
                      <span className="text-texto-fraco">—</span>
                    )}
                  </td>
                  <td>
                    <Badge tom={TOM[l.estagioEfetivo]}>{ROTULO[l.estagioEfetivo]}</Badge>
                  </td>
                  <td className={vencido(l) ? 'text-aviso' : 'text-texto-fraco'}>
                    {l.proximo_contato
                      ? <span title={data(l.proximo_contato)}>{relativo(l.proximo_contato)}</span>
                      : '—'}
                  </td>
                  <td className="tabular-nums text-texto-fraco">{l.notas || '—'}</td>
                  <td>
                    <Link href={`/crm/${l.id}`} className="text-acento hover:underline">
                      abrir
                    </Link>
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
