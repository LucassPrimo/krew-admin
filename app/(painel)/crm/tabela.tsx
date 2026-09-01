'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronRight, Loader2, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, useTransition } from 'react'

import { data, relativo } from '@/lib/format'
import { ESTAGIOS_MANUAIS, ROTULO, vencido, type EstagioManual, type Lead } from '@/lib/crm-tipos'
import { Etapa } from './etapa'
import {
  acaoExcluirLeads, acaoMarcarPerdidosEmLote, acaoMoverEstagioEmLote,
} from './acoes'

/**
 * A lista de leads, com seleção em lote.
 *
 * ---------------------------------------------------------------------------
 * Por que ela virou Client Component
 * ---------------------------------------------------------------------------
 * Seleção é estado de interface puro: quais linhas estão marcadas não é
 * pergunta que o banco responde, e mandá-la para a URL (o padrão desta tela
 * para filtro) transformaria "marquei quarenta" num query string gigante que o
 * botão voltar desfaz pela metade. O resto da página continua no servidor — o
 * funil, as métricas e os filtros não mudaram de lado.
 *
 * ---------------------------------------------------------------------------
 * O que "todos" quer dizer
 * ---------------------------------------------------------------------------
 * A caixa do cabeçalho marca **os leads que estão na tela**, ou seja, o que o
 * filtro atual deixou passar — não os do banco inteiro. É a única leitura
 * honesta: você acabou de filtrar "Link School, parados em negociando", e o
 * gesto seguinte é agir sobre ISSO. Um "selecionar todos" que alcançasse o que
 * não está à vista seria a forma mais fácil de apagar a lista errada.
 *
 * A contagem na barra diz o número, sempre — inclusive quando é igual ao total.
 */
export function TabelaLeads({
  leads, podeAgir, podeExcluir,
}: {
  leads: Lead[]
  /** Kill switch e schema instalado: sem isso a barra nem aparece. */
  podeAgir: boolean
  /** O `grant delete` foi rodado neste banco? Ver `sql/admin_crm_exclusao.sql`. */
  podeExcluir: boolean
}) {
  const router = useRouter()
  const [pendente, startTransition] = useTransition()
  const [marcados, setMarcados] = useState<Set<string>>(new Set())
  const [estagio, setEstagio] = useState<EstagioManual>('contatado')
  const [modo, setModo] = useState<'nenhum' | 'perdido' | 'excluir'>('nenhum')
  const [motivo, setMotivo] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [feito, setFeito] = useState<string | null>(null)

  const visiveis = leads.map((l) => l.id)
  const selecionados = visiveis.filter((id) => marcados.has(id))
  const todosMarcados = visiveis.length > 0 && selecionados.length === visiveis.length

  // A caixa do cabeçalho tem TRÊS estados, e o terceiro não existe em HTML sem
  // isto: "alguns marcados" é uma propriedade do elemento (`indeterminate`),
  // não um atributo — só dá para ligá-la por referência.
  const caixaTodos = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (caixaTodos.current) {
      caixaTodos.current.indeterminate =
        selecionados.length > 0 && selecionados.length < visiveis.length
    }
  }, [selecionados.length, visiveis.length])

  // O filtro mudou por baixo (a lista é recarregada pelo servidor): o que saiu
  // da tela sai da seleção. Sem isto, agir depois de trocar de aba mexeria em
  // linhas que você não está mais vendo.
  useEffect(() => {
    setMarcados((atual) => {
      const naTela = new Set(visiveis)
      const sobrou = [...atual].filter((id) => naTela.has(id))
      return sobrou.length === atual.size ? atual : new Set(sobrou)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads])

  function alternar(id: string) {
    setMarcados((atual) => {
      const novo = new Set(atual)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
  }

  function limpar() {
    setMarcados(new Set())
    setModo('nenhum')
    setMotivo('')
    setConfirmacao('')
  }

  /**
   * O caminho comum das três ações: erro fica na barra, sucesso vira frase e
   * limpa a seleção.
   *
   * A seleção some no fim de propósito. Depois de mover quarenta leads, as
   * linhas continuam na tela mas o gesto acabou — manter tudo marcado convida
   * ao segundo clique sem querer, que na exclusão não teria volta.
   */
  function agir<T extends { ok: true }>(
    executar: () => Promise<T | { ok: false; erro: string }>,
    resumo: (r: T) => string,
  ) {
    setErro(null)
    setFeito(null)
    startTransition(async () => {
      const r = await executar()
      if (!r.ok) {
        setErro(r.erro)
        return
      }
      setFeito(resumo(r))
      limpar()
      router.refresh()
    })
  }

  function mover() {
    agir(
      () => acaoMoverEstagioEmLote(selecionados, estagio),
      (r) =>
        `${r.alterados} movido(s) para ${ROTULO[estagio]}` +
        (r.ignorados > 0
          ? ` · ${r.ignorados} ignorado(s): já perdidos, ou com oferta criada — nesses o estágio vem da oferta.`
          : '.'),
    )
  }

  function perder() {
    agir(
      () => acaoMarcarPerdidosEmLote(selecionados, motivo),
      (r) =>
        `${r.alterados} marcado(s) como perdido` +
        (r.ignorados > 0 ? ` · ${r.ignorados} já estava(m) perdido(s).` : '.'),
    )
  }

  function excluir() {
    agir(
      () => acaoExcluirLeads(selecionados),
      (r) => `${r.excluidos} lead(s) excluído(s). A linha inteira ficou na auditoria.`,
    )
  }

  const botao =
    'rounded-md border border-borda px-2 py-1 text-xs hover:border-borda-forte disabled:opacity-40'

  return (
    <>
      {podeAgir && selecionados.length > 0 && (
        <div className="sticky top-0 z-10 mb-3 rounded-md border border-acento/40 bg-acento/5 px-3 py-2">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <strong className="tabular-nums">{selecionados.length}</strong>
            <span className="text-texto-fraco">
              selecionado(s) de {visiveis.length} na tela
            </span>
            <button type="button" onClick={limpar} className="text-xs text-acento hover:underline">
              limpar
            </button>

            <span aria-hidden className="mx-1 h-4 w-px bg-borda" />

            <select
              value={estagio}
              onChange={(e) => setEstagio(e.target.value as EstagioManual)}
              className="h-7 rounded-md border border-borda bg-fundo px-2 text-xs outline-none focus:border-acento"
            >
              {ESTAGIOS_MANUAIS.map((e) => (
                <option key={e} value={e}>{ROTULO[e]}</option>
              ))}
            </select>
            <button type="button" onClick={mover} disabled={pendente} className={botao}>
              {pendente ? <Loader2 className="inline size-3 animate-spin" /> : 'Mover'}
            </button>

            <button
              type="button"
              onClick={() => setModo(modo === 'perdido' ? 'nenhum' : 'perdido')}
              disabled={pendente}
              className={botao}
            >
              Marcar perdido
            </button>

            {!podeExcluir && (
              <span className="ml-auto text-[11px] text-texto-fraco">
                excluir indisponível neste banco — rode{' '}
                <code className="font-mono">sql/admin_crm_exclusao.sql</code>
              </span>
            )}

            {podeExcluir && (
              <button
                type="button"
                onClick={() => setModo(modo === 'excluir' ? 'nenhum' : 'excluir')}
                disabled={pendente}
                className={`${botao} ml-auto flex items-center gap-1 text-perigo hover:border-perigo/60`}
              >
                <Trash2 className="size-3" strokeWidth={1.5} />
                Excluir
              </button>
            )}
          </div>

          {modo === 'perdido' && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="motivo da perda — o funil por fonte lê isto"
                className="h-8 flex-1 rounded-md border border-borda bg-fundo px-2 text-xs outline-none focus:border-acento"
              />
              <button
                type="button" onClick={perder} disabled={pendente || !motivo.trim()}
                className={botao}
              >
                Confirmar perda
              </button>
            </div>
          )}

          {modo === 'excluir' && (
            <div className="mt-2 rounded-md border border-perigo/40 bg-perigo-fundo p-2">
              <p className="mb-2 text-xs text-perigo">
                Isto apaga {selecionados.length} lead(s) e as notas deles. Não tem volta —
                a linha inteira fica em <code className="font-mono">admin_audit.mutations</code>,
                mas o lead não volta de lá. Escreva <code className="font-mono">excluir</code> para confirmar.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={confirmacao}
                  onChange={(e) => setConfirmacao(e.target.value)}
                  className="h-8 w-40 rounded-md border border-borda bg-fundo px-2 font-mono text-xs outline-none focus:border-perigo"
                />
                <button
                  type="button"
                  onClick={excluir}
                  disabled={pendente || confirmacao.trim() !== 'excluir'}
                  className={`${botao} border-perigo/50 text-perigo disabled:opacity-40`}
                >
                  Excluir de vez
                </button>
              </div>
            </div>
          )}

          {erro && <p className="mt-2 text-xs text-perigo">{erro}</p>}
        </div>
      )}

      {feito && !erro && selecionados.length === 0 && (
        <p className="mb-3 text-xs text-ok">{feito}</p>
      )}

      <table className="densa">
        <thead>
          <tr>
            {podeAgir && (
              <th className="w-6">
                <input
                  ref={caixaTodos}
                  type="checkbox"
                  checked={todosMarcados}
                  onChange={() => setMarcados(todosMarcados ? new Set() : new Set(visiveis))}
                  aria-label="Selecionar todos os leads da tela"
                  className="align-middle accent-acento"
                />
              </th>
            )}
            <th>Lead</th><th>Fonte</th><th>Bio</th><th>Estágio</th>
            <th>Próximo contato</th><th className="text-right">Notas</th><th></th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => {
            const marcado = marcados.has(l.id)
            return (
              <tr key={l.id} className={marcado ? 'bg-painel-2' : undefined}>
                {podeAgir && (
                  <td className="w-6">
                    <input
                      type="checkbox"
                      checked={marcado}
                      onChange={() => alternar(l.id)}
                      aria-label={`Selecionar ${l.nome}`}
                      className="align-middle accent-acento"
                    />
                  </td>
                )}
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
            )
          })}
        </tbody>
      </table>
    </>
  )
}
