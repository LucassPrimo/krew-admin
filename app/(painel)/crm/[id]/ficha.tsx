'use client'

import { ExternalLink, Loader2, Pencil } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Card } from '@/components/ui'
import { ESTAGIOS_MANUAIS, ROTULO, type EstagioManual } from '@/lib/crm-tipos'
import type { Lead, Nota } from '@/lib/crm'
import { data, dataHora, numero, relativo } from '@/lib/format'
import {
  acaoAdicionarNota, acaoAtualizarLead, acaoMarcarPerdido, acaoReabrirLead,
  acaoVincularOferta,
} from '../acoes'

/**
 * A ficha inteira num Client Component só.
 *
 * Duas colunas, e a divisão não é estética: à esquerda o que MUDA (a bio, o
 * histórico da conversa), à direita o que se consulta e raramente se edita (o
 * cadastro, a agenda, a perda). Empilhado numa coluna só, o formulário de
 * cadastro empurrava as anotações para fora da tela — e é nelas que está o
 * motivo de abrir a ficha.
 *
 * As partes compartilham o mesmo `useTransition` e a mesma faixa de mensagem:
 * separá-las daria a cada uma um "salvando" próprio, e dois spinners ao mesmo
 * tempo na mesma tela dizem menos, não mais.
 *
 * Nenhuma delas confia no `podeEscrever` que chega por prop para autorizar
 * nada — ele só apaga botão. Quem autoriza é a Server Action, a cada chamada.
 */

const CAMPO =
  'h-9 w-full rounded-lg border border-borda bg-fundo px-3 text-sm outline-none transition-colors focus:border-borda-forte'

const PILULA =
  'rounded-full border border-borda px-2.5 py-1 text-xs text-texto-fraco transition-colors hover:border-borda-forte hover:text-texto disabled:opacity-40'

/** Data local em ISO. `toISOString()` daria o dia de amanhã depois das 21h. */
function emDias(dias: number): string {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function Ficha({
  lead, notas, ofertasLivres, podeEscrever,
}: {
  lead: Lead
  notas: Nota[]
  ofertasLivres: { page_id: string; slug: string; nome: string | null }[]
  podeEscrever: boolean
}) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [msg, setMsg] = useState<{ tom: 'ok' | 'erro'; texto: string } | null>(null)

  const [nome, setNome] = useState(lead.nome)
  const [instagram, setInstagram] = useState(lead.instagram ?? '')
  const [fonte, setFonte] = useState(lead.fonte ?? '')
  const [email, setEmail] = useState(lead.email ?? '')
  const [whatsapp, setWhatsapp] = useState(lead.whatsapp ?? '')
  const [handle, setHandle] = useState(lead.handle_pretendido ?? '')
  const [estagio, setEstagio] = useState<EstagioManual>(lead.estagio)
  const [editando, setEditando] = useState(false)

  /** Cancelar volta os campos ao que está gravado — senão a edição
   *  abandonada reapareceria na próxima vez que o cartão abrisse. */
  function cancelarEdicao() {
    setNome(lead.nome)
    setInstagram(lead.instagram ?? '')
    setFonte(lead.fonte ?? '')
    setEmail(lead.email ?? '')
    setWhatsapp(lead.whatsapp ?? '')
    setHandle(lead.handle_pretendido ?? '')
    setEstagio(lead.estagio)
    setEditando(false)
  }

  const [nota, setNota] = useState('')
  const [ofertaEscolhida, setOfertaEscolhida] = useState('')
  const [motivoPerda, setMotivoPerda] = useState('')
  const [perdendo, setPerdendo] = useState(false)

  const proximo = lead.proximo_contato?.slice(0, 10) ?? ''
  const vencido =
    Boolean(proximo) &&
    !lead.perdido_em &&
    !lead.aceita_em &&
    new Date(proximo) <= new Date(new Date().toDateString())

  const sujo =
    nome !== lead.nome ||
    instagram !== (lead.instagram ?? '') ||
    fonte !== (lead.fonte ?? '') ||
    email !== (lead.email ?? '') ||
    whatsapp !== (lead.whatsapp ?? '') ||
    handle !== (lead.handle_pretendido ?? '') ||
    estagio !== lead.estagio

  function rodar(acao: () => Promise<{ ok: boolean; erro?: string }>, sucesso: string) {
    setMsg(null)
    iniciar(async () => {
      const r = await acao()
      setMsg(r.ok ? { tom: 'ok', texto: sucesso } : { tom: 'erro', texto: r.erro ?? 'Falhou.' })
      if (r.ok) router.refresh()
    })
  }

  function agendar(dias: number | null) {
    rodar(
      () => acaoAtualizarLead(lead.id, { proximoContato: dias === null ? null : emDias(dias) }),
      dias === null ? 'Follow-up removido.' : 'Follow-up remarcado.',
    )
  }

  /** Depois de a oferta existir, o estágio vem dela — o seletor manual sai. */
  const estagioDerivado = Boolean(lead.oferta_criada_em)

  return (
    <div className="flex flex-col gap-4">
      {msg && (
        <p
          className={`rounded-lg border px-3 py-2 text-sm ${
            msg.tom === 'ok'
              ? 'border-borda-forte text-texto-fraco'
              : 'border-perigo/40 bg-perigo-fundo text-perigo'
          }`}
        >
          {msg.texto}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        {/* ================= coluna do que acontece ================= */}
        <div className="flex flex-col gap-4">
          <Card>
            <h2 className="mb-1 text-sm font-medium">A bio</h2>

            {lead.oferta_criada_em ? (
              <>
                <p className="mb-3 text-xs text-texto-fraco">
                  Criada {relativo(lead.oferta_criada_em)}
                  {lead.convite_enviado_em && ` · convite ${relativo(lead.convite_enviado_em)}`}
                  {lead.aceita_em && ` · aceita em ${data(lead.aceita_em)}`}
                  {lead.cliques !== null && ` · ${numero(lead.cliques)} clique(s) nos links`}
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={`https://bekrew.com/@${lead.slug}`}
                    target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 rounded-full border border-borda bg-painel-2 px-3 py-1.5 font-mono text-xs transition-colors hover:border-borda-forte"
                  >
                    bekrew.com/@{lead.slug}
                    <ExternalLink className="size-3" strokeWidth={1.5} />
                  </a>
                  <Link
                    href={`/ofertas/${lead.page_id}`}
                    className="rounded-full border border-borda px-3 py-1.5 text-xs font-medium transition-colors hover:border-borda-forte"
                  >
                    editar a oferta
                  </Link>
                  {podeEscrever && (
                    <button
                      type="button" disabled={pendente}
                      onClick={() => rodar(() => acaoVincularOferta(lead.id, null), 'Oferta desvinculada.')}
                      className="ml-auto text-xs text-texto-fraco hover:text-texto disabled:opacity-50"
                    >
                      desvincular
                    </button>
                  )}
                </div>

                <p className="mt-3 border-t border-borda pt-3 text-xs text-texto-fraco">
                  O convite e o aceite se resolvem na tela da oferta. O estágio aqui
                  LÊ de lá — não existe marcar &ldquo;enviado&rdquo; à mão, que é o que
                  fazia a planilha divergir do produto.
                </p>
              </>
            ) : (
              <>
                <p className="mb-3 text-xs text-texto-fraco">
                  Este lead ainda não tem bio. Criar uma leva você para o fluxo de
                  oferta com o nome e o handle já preenchidos, e o vínculo é feito
                  na volta.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {podeEscrever && (
                    <Link
                      href={`/ofertas/nova?lead=${lead.id}&nome=${encodeURIComponent(lead.nome)}${
                        handle ? `&slug=${encodeURIComponent(handle)}` : ''
                      }`}
                      className="rounded-md bg-acento px-3 py-1.5 text-sm font-medium text-fundo"
                    >
                      Criar a oferta
                    </Link>
                  )}
                  {podeEscrever && ofertasLivres.length > 0 && (
                    <>
                      <select
                        value={ofertaEscolhida} onChange={(e) => setOfertaEscolhida(e.target.value)}
                        className="h-9 max-w-56 rounded-lg border border-borda bg-fundo px-2 text-xs outline-none focus:border-borda-forte"
                      >
                        <option value="">ou vincular uma que já existe…</option>
                        {ofertasLivres.map((o) => (
                          <option key={o.page_id} value={o.page_id}>
                            @{o.slug}{o.nome ? ` — ${o.nome}` : ''}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button" disabled={pendente || !ofertaEscolhida}
                        onClick={() =>
                          rodar(() => acaoVincularOferta(lead.id, ofertaEscolhida), 'Oferta vinculada.')}
                        className={PILULA}
                      >
                        vincular
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </Card>

          {/* --------------------------- Anotações ---------------------------
              Linha do tempo com fio e ponto, e não uma pilha de caixas: o que
              se lê aqui é ORDEM ("o que aconteceu desde a última vez"), e
              caixas soltas não têm direção.
              ----------------------------------------------------------------- */}
          <Card>
            <h2 className="mb-1 text-sm font-medium">Anotações</h2>
            <p className="mb-3 text-xs text-texto-fraco">
              Datadas e imutáveis — é o que responde &ldquo;o que a gente combinou
              mesmo?&rdquo; três semanas depois. Só você vê; o criador nunca enxerga
              isto, nem depois de assumir a conta.
            </p>

            {podeEscrever && (
              <div className="mb-4 flex flex-col gap-2">
                <textarea
                  rows={2} value={nota} onChange={(e) => setNota(e.target.value)}
                  placeholder="O que aconteceu nesse contato"
                  className="w-full resize-y rounded-lg border border-borda bg-fundo px-3 py-2 text-sm outline-none transition-colors focus:border-borda-forte"
                />
                <button
                  type="button" disabled={pendente || !nota.trim()}
                  onClick={() =>
                    rodar(async () => {
                      const r = await acaoAdicionarNota(lead.id, nota)
                      if (r.ok) setNota('')
                      return r
                    }, 'Anotação registrada.')}
                  className="flex items-center gap-1.5 self-start rounded-md bg-acento px-3 py-1.5 text-xs font-semibold text-fundo disabled:opacity-40"
                >
                  {pendente && <Loader2 className="size-3.5 animate-spin" />}
                  Anotar
                </button>
              </div>
            )}

            {notas.length === 0 ? (
              <p className="text-xs text-texto-fraco">Nada anotado ainda.</p>
            ) : (
              <ul className="flex flex-col">
                {notas.map((n, i) => (
                  <li key={n.id} className="relative flex gap-3 pb-4 last:pb-0">
                    <div className="relative flex w-3 shrink-0 justify-center">
                      <span className="z-10 mt-1.5 size-1.5 shrink-0 rounded-full bg-borda-forte" />
                      {i < notas.length - 1 && (
                        <span aria-hidden className="absolute top-1.5 bottom-0 w-px bg-borda" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] text-texto-fraco" title={dataHora(n.criada_em)}>
                        {relativo(n.criada_em)}
                      </div>
                      <p className="mt-0.5 whitespace-pre-wrap text-sm">{n.texto}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* ================= coluna do que o lead É ================= */}
        <div className="flex flex-col gap-4">
          <Card>
            <h2 className="mb-1 text-sm font-medium">Próximo contato</h2>
            <p className="mb-3 text-xs text-texto-fraco">
              Vencido, o lead sobe na lista e entra no contador da barra lateral.
            </p>

            <p className={`mb-3 text-sm ${vencido ? 'text-aviso' : ''}`}>
              {proximo ? (
                <>
                  {vencido && <span className="mr-1.5 inline-block size-1.5 rounded-full bg-aviso align-middle" />}
                  {data(proximo)}
                  <span className="ml-1.5 text-xs text-texto-fraco">{relativo(proximo)}</span>
                </>
              ) : (
                <span className="text-texto-fraco">sem data marcada</span>
              )}
            </p>

            {podeEscrever && (
              <div className="flex flex-wrap gap-1.5">
                <button type="button" disabled={pendente} onClick={() => agendar(0)} className={PILULA}>
                  hoje
                </button>
                <button type="button" disabled={pendente} onClick={() => agendar(3)} className={PILULA}>
                  +3 dias
                </button>
                <button type="button" disabled={pendente} onClick={() => agendar(7)} className={PILULA}>
                  +1 semana
                </button>
                <button type="button" disabled={pendente} onClick={() => agendar(30)} className={PILULA}>
                  +1 mês
                </button>
                {proximo && (
                  <button type="button" disabled={pendente} onClick={() => agendar(null)} className={PILULA}>
                    limpar
                  </button>
                )}
              </div>
            )}
          </Card>

          {/* O cadastro nasce FECHADO: é consulta na maior parte das visitas, e
              oito campos abertos empurravam para baixo o que se veio ver. */}
          <Card>
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-medium">Cadastro</h2>
              {podeEscrever && !editando && (
                <button
                  type="button" onClick={() => setEditando(true)}
                  className="flex items-center gap-1 text-xs text-texto-fraco hover:text-texto"
                >
                  <Pencil className="size-3" strokeWidth={1.5} />
                  editar
                </button>
              )}
            </div>

            {!editando ? (
              <dl className="mt-3 flex flex-col gap-2 text-xs">
                {[
                  ['Nome', lead.nome],
                  ['Instagram', lead.instagram ? `@${lead.instagram}` : null],
                  ['Fonte', lead.fonte],
                  ['E-mail', lead.email],
                  ['WhatsApp', lead.whatsapp],
                  [
                    'Handle',
                    lead.slug ? `@${lead.slug}` : lead.handle_pretendido ? `@${lead.handle_pretendido} (pretendido)` : null,
                  ],
                  ['Estágio', ROTULO[lead.estagioEfetivo]],
                  ['Criado', data(lead.criado_em)],
                ].map(([rotulo, valor]) => (
                  <div key={rotulo} className="flex items-baseline justify-between gap-3">
                    <dt className="shrink-0 text-texto-fraco">{rotulo}</dt>
                    <dd className="truncate text-right">
                      {valor ?? <span className="text-texto-fraco">—</span>}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <div className="mt-3 flex flex-col gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium">Nome</span>
                  <input value={nome} onChange={(e) => setNome(e.target.value)} className={CAMPO} />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium">Instagram</span>
                  <input
                    value={instagram} onChange={(e) => setInstagram(e.target.value)}
                    className={`${CAMPO} font-mono text-xs`}
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium">Fonte</span>
                  <input value={fonte} onChange={(e) => setFonte(e.target.value)} className={CAMPO} />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium">E-mail</span>
                  <input
                    type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    className={CAMPO}
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium">WhatsApp</span>
                  <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className={CAMPO} />
                </label>

                {!estagioDerivado && (
                  <>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium">Handle pretendido</span>
                      <input
                        value={handle}
                        onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                        className={`${CAMPO} font-mono text-xs`}
                      />
                    </label>

                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium">Estágio</span>
                      <select
                        value={estagio} onChange={(e) => setEstagio(e.target.value as EstagioManual)}
                        className={CAMPO}
                      >
                        {ESTAGIOS_MANUAIS.map((e) => (
                          <option key={e} value={e}>{ROTULO[e]}</option>
                        ))}
                      </select>
                    </label>
                  </>
                )}

                <div className="flex items-center gap-3">
                  <button
                    type="button" disabled={pendente || !sujo}
                    onClick={() =>
                      rodar(async () => {
                        const r = await acaoAtualizarLead(lead.id, {
                          nome, instagram, fonte, email, whatsapp,
                          // Com oferta vinculada os dois campos saem da tela;
                          // mandá-los assim mesmo gravaria o estado velho por
                          // cima do atual.
                          ...(estagioDerivado ? {} : { handlePretendido: handle, estagio }),
                        })
                        if (r.ok) setEditando(false)
                        return r
                      }, 'Cadastro salvo.')}
                    className="flex items-center gap-1.5 rounded-md bg-acento px-3 py-1.5 text-xs font-semibold text-fundo disabled:opacity-40"
                  >
                    {pendente && <Loader2 className="size-3.5 animate-spin" />}
                    Salvar
                  </button>
                  <button
                    type="button" onClick={cancelarEdicao}
                    className="text-xs text-texto-fraco hover:text-texto"
                  >
                    cancelar
                  </button>
                </div>
              </div>
            )}
          </Card>

          {podeEscrever && (
            <Card>
              {lead.perdido_em ? (
                <>
                  <h2 className="mb-1 text-sm font-medium text-perigo">Perdido</h2>
                  <p className="mb-3 text-xs text-texto-fraco">
                    Em {data(lead.perdido_em)} — {lead.motivo_perda}
                  </p>
                  <button
                    type="button" disabled={pendente}
                    onClick={() => rodar(() => acaoReabrirLead(lead.id), 'Lead reaberto.')}
                    className={PILULA}
                  >
                    reabrir
                  </button>
                </>
              ) : perdendo ? (
                <>
                  <h2 className="mb-1 text-sm font-medium">Marcar como perdido</h2>
                  <p className="mb-3 text-xs text-texto-fraco">
                    O motivo é obrigatório: somado por fonte, é ele que diz qual
                    canal traz gente que não fecha. Nada é apagado, e dá para
                    reabrir.
                  </p>
                  <input
                    autoFocus value={motivoPerda} onChange={(e) => setMotivoPerda(e.target.value)}
                    placeholder="não respondeu, foi para concorrente…"
                    className={`${CAMPO} mb-3`}
                  />
                  <div className="flex items-center gap-3">
                    <button
                      type="button" disabled={pendente || !motivoPerda.trim()}
                      onClick={() =>
                        rodar(() => acaoMarcarPerdido(lead.id, motivoPerda), 'Lead marcado como perdido.')}
                      className="rounded-md border border-perigo/40 px-3 py-1.5 text-xs font-semibold text-perigo disabled:opacity-40"
                    >
                      Confirmar perda
                    </button>
                    <button
                      type="button" onClick={() => setPerdendo(false)}
                      className="text-xs text-texto-fraco hover:text-texto"
                    >
                      cancelar
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button" onClick={() => setPerdendo(true)}
                  className="text-xs text-texto-fraco transition-colors hover:text-perigo"
                >
                  Marcar como perdido
                </button>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
