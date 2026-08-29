import Link from 'next/link'
import { ChevronRight, Search } from 'lucide-react'

import { Aviso, Card, Metrica, Vazio } from '@/components/ui'
import { escritaLigada } from '@/lib/env'
import { data, numero, relativo } from '@/lib/format'
import { ROTULO, crmInstalado, listarLeads, montarFunil, type Estagio, type Lead } from '@/lib/crm'
import { Cabecalho } from './cabecalho'
import { Etapa } from './etapa'

export const dynamic = 'force-dynamic'

/**
 * O CRM: a fila de criadores antes de eles virarem clientes.
 *
 * A tela responde três perguntas, de cima para baixo, na ordem da urgência:
 * com quem eu falo HOJE, onde a prospecção está perdendo gente, e de onde vem
 * lead que aceita. É a mesma ordem da Visão geral — o que exige ação primeiro,
 * o que mede o negócio depois.
 *
 * As colunas "Link criado?", "Enviado" e "Aceito" da planilha viraram UMA, o
 * estágio, lido de `bio_ofertas` a cada consulta. Ver `lib/crm.ts`.
 */

type Filtro = { q?: string; estagio?: string; fonte?: string; hoje?: string }

/** Troca um parâmetro preservando os outros — os filtros se somam. */
function comFiltro(atual: Filtro, mudanca: Filtro): string {
  const p = new URLSearchParams()
  for (const [chave, valor] of Object.entries({ ...atual, ...mudanca })) {
    if (valor) p.set(chave, valor)
  }
  const busca = p.toString()
  return busca ? `/crm?${busca}` : '/crm'
}

function vencido(l: Lead): boolean {
  if (!l.proximo_contato || l.estagioEfetivo === 'aceito' || l.estagioEfetivo === 'perdido') {
    return false
  }
  return new Date(l.proximo_contato) <= new Date(new Date().toDateString())
}

/** Uma aba do filtro. Link e não botão: o estado do filtro mora na URL. */
function Aba({
  href, ativa, children, quantos,
}: {
  href: string
  ativa: boolean
  children: React.ReactNode
  quantos: number
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
        ativa
          ? 'border-borda-forte bg-painel-2 text-texto'
          : 'border-borda text-texto-fraco hover:border-borda-forte hover:text-texto'
      }`}
    >
      {children}
      <span className="tabular-nums opacity-60">{quantos}</span>
    </Link>
  )
}

export default async function CRM({ searchParams }: { searchParams: Promise<Filtro> }) {
  const filtro = await searchParams
  const [instalado, todos] = await Promise.all([crmInstalado(), listarLeads()])
  const funil = montarFunil(todos)

  const paraHoje = todos.filter(vencido)
  const abertos = todos.filter((l) => l.estagioEfetivo !== 'aceito' && l.estagioEfetivo !== 'perdido')
  const aceitos = todos.filter((l) => l.estagioEfetivo === 'aceito')

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
  const filtrando = Boolean(filtro.q || filtro.estagio || filtro.fonte || filtro.hoje)

  return (
    <>
      <Cabecalho
        podeCriar={instalado && escritaLigada}
        fontes={funil.fontes.map((f) => f.fonte).filter((f) => f !== 'sem fonte')}
      />

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

      {instalado && (
        <>
          <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metrica rotulo="Na fila" valor={numero(abertos.length)} nota="nem aceitos nem perdidos" />
            <Metrica
              rotulo="Follow-up vencido" valor={numero(paraHoje.length)}
              nota="falar hoje" alerta={paraHoje.length > 0}
            />
            <Metrica rotulo="Aceitos" valor={numero(aceitos.length)} nota="viraram conta" />
            <Metrica
              rotulo="Conversão"
              valor={funil.total > 0 ? `${Math.round((aceitos.length / funil.total) * 100)}%` : '—'}
              nota={`de ${numero(funil.total)} leads`}
            />
          </section>

          <div className="mb-4 grid gap-4 lg:grid-cols-2">
            {/* ----------------------------------------------------------
                O funil como BARRAS, e não como seis caixas de número: o
                que a tela precisa mostrar é a queda entre dois degraus, e
                caixas do mesmo tamanho escondem exatamente isso. É a mesma
                peça da "Ativação" na Visão geral, que responde à mesma
                pergunta sobre o produto.
                ---------------------------------------------------------- */}
            <Card>
              <h2 className="mb-1 text-sm font-medium">Funil</h2>
              <p className="mb-3 text-xs text-texto-fraco">
                Quantos leads ALCANÇARAM cada etapa — um aceito também foi
                contatado um dia. A maior queda entre duas barras é onde a
                prospecção perde gente.
              </p>

              {funil.total === 0 ? (
                <Vazio>Nenhum lead ainda.</Vazio>
              ) : (
                <table className="densa">
                  <tbody>
                    {funil.etapas.map((e, i) => {
                      const anterior = i === 0 ? null : funil.etapas[i - 1].alcancaram
                      const caiu = anterior === null ? 0 : anterior - e.alcancaram
                      return (
                        <tr key={e.estagio}>
                          <td className="whitespace-nowrap">
                            <Link
                              href={comFiltro(filtro, { estagio: e.estagio, hoje: '' })}
                              className="hover:underline"
                            >
                              {ROTULO[e.estagio]}
                            </Link>
                          </td>
                          <td className="w-10 text-right tabular-nums">{e.alcancaram}</td>
                          <td className="w-full">
                            <div className="h-1.5 rounded-full bg-painel-2">
                              <div
                                className="h-1.5 rounded-full bg-acento"
                                style={{ width: `${(e.alcancaram / funil.total) * 100}%` }}
                              />
                            </div>
                          </td>
                          <td className="w-16 whitespace-nowrap text-right text-texto-fraco">
                            {caiu > 0 ? `−${caiu}` : ''}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}

              {funil.perdidos > 0 && (
                <p className="mt-3 text-xs text-texto-fraco">
                  <Link
                    href={comFiltro(filtro, { estagio: 'perdido', hoje: '' })}
                    className="text-acento hover:underline"
                  >
                    {funil.perdidos} perdido{funil.perdidos > 1 ? 's' : ''}
                  </Link>{' '}
                  — fora das barras, mas contados no degrau que alcançaram.
                </p>
              )}
            </Card>

            <Card>
              <h2 className="mb-1 text-sm font-medium">Por fonte</h2>
              <p className="mb-3 text-xs text-texto-fraco">
                De onde vem lead que aceita — a pergunta que decide onde procurar
                o próximo.
              </p>

              {funil.fontes.length === 0 ? (
                <Vazio>Nenhum lead ainda.</Vazio>
              ) : (
                <table className="densa">
                  <thead>
                    <tr>
                      <th>Fonte</th><th className="text-right">Leads</th>
                      <th className="text-right">Aceitos</th><th className="text-right">Conversão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {funil.fontes.map((f) => (
                      <tr key={f.fonte}>
                        <td>
                          <Link
                            href={comFiltro(filtro, { fonte: f.fonte })}
                            className="hover:underline"
                          >
                            {f.fonte}
                          </Link>
                          {f.perdidos > 0 && (
                            <span className="ml-1.5 text-xs text-texto-fraco">
                              {f.perdidos} perdido{f.perdidos > 1 ? 's' : ''}
                            </span>
                          )}
                        </td>
                        <td className="text-right tabular-nums">{numero(f.total)}</td>
                        <td className="text-right tabular-nums">{numero(f.aceitos)}</td>
                        <td className="text-right tabular-nums">
                          {Math.round((f.aceitos / f.total) * 100)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </div>
        </>
      )}

      <Card>
        {/* ------------------------------------------------------------------
            O filtro é uma fileira de abas e uma busca — não um formulário com
            três selects e um botão "filtrar". Cada aba já traz o número, então
            a barra também RESPONDE ("tem sete parados em negociando") em vez
            de só perguntar. O estado mora na URL: dá para mandar "olha os do
            Link School parados" por link, e o botão voltar funciona.
            ------------------------------------------------------------------ */}
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <Aba
            href={comFiltro({}, { q: filtro.q })}
            ativa={!filtro.estagio && filtro.hoje !== '1' && !filtro.fonte}
            quantos={todos.length}
          >
            Todos
          </Aba>
          <Aba
            href={comFiltro(filtro, { hoje: '1', estagio: '' })}
            ativa={filtro.hoje === '1'}
            quantos={paraHoje.length}
          >
            Falar hoje
          </Aba>

          <span aria-hidden className="mx-1 h-4 w-px bg-borda" />

          {funil.etapas.map((e) => (
            <Aba
              key={e.estagio}
              href={comFiltro(filtro, { estagio: e.estagio, hoje: '' })}
              ativa={filtro.estagio === e.estagio}
              quantos={e.parados}
            >
              {ROTULO[e.estagio]}
            </Aba>
          ))}
          {funil.perdidos > 0 && (
            <Aba
              href={comFiltro(filtro, { estagio: 'perdido', hoje: '' })}
              ativa={filtro.estagio === 'perdido'}
              quantos={funil.perdidos}
            >
              {ROTULO.perdido}
            </Aba>
          )}

          {/* A busca leva os outros filtros em campos escondidos: buscar
              dentro de "Link School" não deve jogar você de volta para a
              lista inteira. */}
          <form method="get" className="ml-auto flex items-center gap-1.5">
            {filtro.estagio && <input type="hidden" name="estagio" value={filtro.estagio} />}
            {filtro.fonte && <input type="hidden" name="fonte" value={filtro.fonte} />}
            {filtro.hoje && <input type="hidden" name="hoje" value={filtro.hoje} />}
            <div className="flex h-8 items-center gap-1.5 rounded-full border border-borda bg-fundo px-3 focus-within:border-borda-forte">
              <Search className="size-3.5 shrink-0 text-texto-fraco" strokeWidth={1.5} />
              <input
                name="q" defaultValue={filtro.q ?? ''} placeholder="nome, @, fonte"
                className="w-40 bg-transparent text-xs outline-none placeholder:text-texto-fraco"
              />
            </div>
          </form>
        </div>

        {filtrando && (
          <p className="mb-3 text-xs text-texto-fraco">
            {numero(ordenados.length)} de {numero(todos.length)}
            {filtro.fonte && <> · fonte <span className="text-texto">{filtro.fonte}</span></>}
            {filtro.q && <> · busca <span className="text-texto">{filtro.q}</span></>}
            {' · '}
            <Link href="/crm" className="text-acento hover:underline">limpar</Link>
          </p>
        )}

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
                <th>Lead</th><th>Fonte</th><th>Bio</th><th>Estágio</th>
                <th>Próximo contato</th><th className="text-right">Notas</th><th></th>
              </tr>
            </thead>
            <tbody>
              {ordenados.map((l) => (
                <tr key={l.id}>
                  {/* Nome e @ na MESMA célula: são a mesma pergunta ("quem é
                      essa pessoa?"), e duas colunas separadas obrigavam o olho
                      a atravessar a tabela para juntá-las. */}
                  <td>
                    <Link href={`/crm/${l.id}`} className="font-medium hover:underline">
                      {l.nome}
                    </Link>
                    {l.instagram && (
                      <a
                        href={`https://instagram.com/${l.instagram}`}
                        target="_blank" rel="noreferrer"
                        className="block font-mono text-[11px] text-texto-fraco hover:text-texto"
                      >
                        @{l.instagram}
                      </a>
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
                      <span
                        className="text-texto-fraco"
                        title="Handle pretendido — a oferta ainda não existe"
                      >
                        @{l.handle_pretendido}
                      </span>
                    ) : (
                      <span className="text-texto-fraco">—</span>
                    )}
                  </td>
                  <td><Etapa estagio={l.estagioEfetivo} /></td>
                  <td className="whitespace-nowrap">
                    {l.proximo_contato ? (
                      <span
                        title={data(l.proximo_contato)}
                        className={vencido(l) ? 'text-aviso' : 'text-texto-fraco'}
                      >
                        {vencido(l) && <span className="mr-1.5 inline-block size-1.5 rounded-full bg-aviso align-middle" />}
                        {relativo(l.proximo_contato)}
                      </span>
                    ) : (
                      <span className="text-texto-fraco">—</span>
                    )}
                  </td>
                  <td className="text-right tabular-nums text-texto-fraco">{l.notas || '—'}</td>
                  <td className="w-6">
                    <Link
                      href={`/crm/${l.id}`}
                      aria-label={`Abrir ${l.nome}`}
                      className="text-texto-fraco hover:text-texto"
                    >
                      <ChevronRight className="size-4" strokeWidth={1.5} />
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
