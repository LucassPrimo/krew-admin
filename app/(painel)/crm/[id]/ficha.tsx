'use client'

import { ExternalLink, Loader2 } from 'lucide-react'
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
 * As quatro partes (dados, oferta, anotações, perda) compartilham o mesmo
 * `useTransition` e a mesma faixa de mensagem: quebrá-las em componentes
 * separados daria a cada uma um estado de "salvando" próprio, e dois spinners
 * ao mesmo tempo na mesma tela dizem menos, não mais.
 *
 * Nenhuma delas confia no `podeEscrever` que chega por prop para autorizar
 * nada — ele só apaga botão. Quem autoriza é a Server Action, a cada chamada.
 */

const CAMPO =
  'h-9 w-full rounded-lg border border-borda bg-fundo px-3 text-sm outline-none focus:border-acento'

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
  const [proximo, setProximo] = useState(lead.proximo_contato?.slice(0, 10) ?? '')

  const [nota, setNota] = useState('')
  const [ofertaEscolhida, setOfertaEscolhida] = useState('')
  const [motivoPerda, setMotivoPerda] = useState('')
  const [perdendo, setPerdendo] = useState(false)

  const sujo =
    nome !== lead.nome ||
    instagram !== (lead.instagram ?? '') ||
    fonte !== (lead.fonte ?? '') ||
    email !== (lead.email ?? '') ||
    whatsapp !== (lead.whatsapp ?? '') ||
    handle !== (lead.handle_pretendido ?? '') ||
    estagio !== lead.estagio ||
    proximo !== (lead.proximo_contato?.slice(0, 10) ?? '')

  function rodar(acao: () => Promise<{ ok: boolean; erro?: string }>, sucesso: string) {
    setMsg(null)
    iniciar(async () => {
      const r = await acao()
      setMsg(r.ok ? { tom: 'ok', texto: sucesso } : { tom: 'erro', texto: r.erro ?? 'Falhou.' })
      if (r.ok) router.refresh()
    })
  }

  /** Depois da oferta existir, o estágio vem dela — o seletor manual sai. */
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

      {/* ---------------------------------------------------------------
          A oferta vem PRIMEIRO: é o que decide o que fazer com este lead
          hoje, e o cadastro é consulta.
          --------------------------------------------------------------- */}
      <Card>
        <h2 className="mb-1 text-sm font-medium">A bio</h2>

        {lead.oferta_criada_em ? (
          <>
            <p className="mb-3 text-xs text-texto-fraco">
              Criada {relativo(lead.oferta_criada_em)}
              {lead.convite_enviado_em && ` · convite enviado ${relativo(lead.convite_enviado_em)}`}
              {lead.aceita_em && ` · aceita em ${data(lead.aceita_em)}`}
              {lead.cliques !== null && ` · ${numero(lead.cliques)} clique(s) nos links`}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`https://bekrew.com/@${lead.slug}`}
                target="_blank" rel="noreferrer"
                className="flex items-center gap-1 rounded-full border border-borda px-3 py-1.5 text-xs font-medium hover:border-acento"
              >
                bekrew.com/@{lead.slug}
                <ExternalLink className="size-3" />
              </a>
              <Link
                href={`/ofertas/${lead.page_id}`}
                className="rounded-full border border-borda px-3 py-1.5 text-xs font-medium hover:border-acento"
              >
                editar a oferta
              </Link>
              {podeEscrever && (
                <button
                  type="button" disabled={pendente}
                  onClick={() => rodar(() => acaoVincularOferta(lead.id, null), 'Oferta desvinculada.')}
                  className="text-xs text-texto-fraco hover:text-texto disabled:opacity-50"
                >
                  desvincular
                </button>
              )}
            </div>
            <p className="mt-3 text-xs text-texto-fraco">
              O convite e o aceite se resolvem na tela da oferta. O estágio aqui
              lê de lá — não existe marcar &ldquo;enviado&rdquo; à mão, que é o que
              fazia a planilha divergir.
            </p>
          </>
        ) : (
          <>
            <p className="mb-3 text-xs text-texto-fraco">
              Este lead ainda não tem bio. Criar uma leva você para o fluxo de
              oferta com o nome e o handle já preenchidos, e o vínculo é feito na
              volta.
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
              {ofertasLivres.length > 0 && podeEscrever && (
                <>
                  <select
                    value={ofertaEscolhida} onChange={(e) => setOfertaEscolhida(e.target.value)}
                    className="h-9 rounded-lg border border-borda bg-fundo px-2 text-sm outline-none focus:border-acento"
                  >
                    <option value="">vincular uma oferta que já existe…</option>
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
                    className="h-9 rounded-lg border border-borda-forte px-3 text-sm hover:border-acento disabled:opacity-50"
                  >
                    vincular
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </Card>

      {/* --------------------------- Anotações --------------------------- */}
      <Card>
        <h2 className="mb-1 text-sm font-medium">Anotações</h2>
        <p className="mb-3 text-xs text-texto-fraco">
          Datadas e imutáveis — o histórico é o que responde &ldquo;o que a gente
          combinou mesmo?&rdquo; três semanas depois. Só você vê; o criador nunca
          enxerga isto, nem depois de assumir a conta.
        </p>

        {podeEscrever && (
          <div className="mb-3 flex flex-col gap-2">
            <textarea
              rows={2} value={nota} onChange={(e) => setNota(e.target.value)}
              placeholder="O que aconteceu nesse contato"
              className="w-full resize-none rounded-lg border border-borda bg-fundo px-3 py-2 text-sm outline-none focus:border-acento"
            />
            <button
              type="button" disabled={pendente || !nota.trim()}
              onClick={() =>
                rodar(async () => {
                  const r = await acaoAdicionarNota(lead.id, nota)
                  if (r.ok) setNota('')
                  return r
                }, 'Anotação registrada.')}
              className="flex items-center gap-1.5 self-start rounded-full bg-acento px-3 py-1.5 text-xs font-semibold text-fundo disabled:opacity-50"
            >
              {pendente && <Loader2 className="size-3.5 animate-spin" />}
              Anotar
            </button>
          </div>
        )}

        {notas.length === 0 ? (
          <p className="text-xs text-texto-fraco">Nada anotado ainda.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {notas.map((n) => (
              <li key={n.id} className="rounded-lg border border-borda bg-painel-2 px-3 py-2">
                <div className="text-[11px] text-texto-fraco">{dataHora(n.criada_em)}</div>
                <p className="mt-0.5 whitespace-pre-wrap text-sm">{n.texto}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ----------------------------- Cadastro ----------------------------- */}
      <Card>
        <h2 className="mb-3 text-sm font-medium">Cadastro</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-xs font-medium">Nome</span>
            <input value={nome} onChange={(e) => setNome(e.target.value)} className={CAMPO} />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium">Instagram</span>
            <input
              value={instagram} onChange={(e) => setInstagram(e.target.value)}
              className={`${CAMPO} font-mono text-xs`}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium">Fonte</span>
            <input value={fonte} onChange={(e) => setFonte(e.target.value)} className={CAMPO} />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium">E-mail</span>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className={CAMPO}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium">WhatsApp</span>
            <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className={CAMPO} />
          </label>

          {!estagioDerivado && (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium">Handle pretendido</span>
                <input
                  value={handle}
                  onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                  className={`${CAMPO} font-mono text-xs`}
                />
              </label>

              <label className="flex flex-col gap-1">
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

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium">Próximo contato</span>
            <input
              type="date" value={proximo} onChange={(e) => setProximo(e.target.value)}
              className={CAMPO}
            />
            <span className="text-[11px] text-texto-fraco">
              Vencido, o lead sobe na lista e entra no contador da barra lateral.
            </span>
          </label>
        </div>

        {podeEscrever && (
          <button
            type="button" disabled={pendente || !sujo}
            onClick={() =>
              rodar(() =>
                acaoAtualizarLead(lead.id, {
                  nome, instagram, fonte, email, whatsapp,
                  // Com oferta vinculada os dois campos saem da tela; mandá-los
                  // assim mesmo gravaria o estado velho por cima do atual.
                  ...(estagioDerivado ? {} : { handlePretendido: handle, estagio }),
                  proximoContato: proximo || null,
                }), 'Cadastro salvo.')}
            className="mt-3 flex items-center gap-1.5 rounded-full bg-acento px-3 py-1.5 text-xs font-semibold text-fundo disabled:opacity-50"
          >
            {pendente && <Loader2 className="size-3.5 animate-spin" />}
            Salvar
          </button>
        )}
      </Card>

      {/* ------------------------------ Perda ------------------------------ */}
      {podeEscrever && (
        <Card>
          {lead.perdido_em ? (
            <>
              <h2 className="mb-1 text-sm font-medium">Perdido</h2>
              <p className="mb-3 text-xs text-texto-fraco">
                Em {data(lead.perdido_em)} — {lead.motivo_perda}
              </p>
              <button
                type="button" disabled={pendente}
                onClick={() => rodar(() => acaoReabrirLead(lead.id), 'Lead reaberto.')}
                className="rounded-full border border-borda px-3 py-1.5 text-xs font-semibold hover:border-acento disabled:opacity-50"
              >
                Reabrir
              </button>
            </>
          ) : perdendo ? (
            <>
              <h2 className="mb-1 text-sm font-medium">Marcar como perdido</h2>
              <p className="mb-3 text-xs text-texto-fraco">
                O motivo é obrigatório: é ele que, somado por fonte, diz qual
                canal traz gente que não fecha. Nada é apagado, e dá para reabrir.
              </p>
              <input
                autoFocus value={motivoPerda} onChange={(e) => setMotivoPerda(e.target.value)}
                placeholder="não respondeu, foi para concorrente, sem perfil…"
                className={`${CAMPO} mb-3`}
              />
              <div className="flex items-center gap-2">
                <button
                  type="button" disabled={pendente || !motivoPerda.trim()}
                  onClick={() =>
                    rodar(() => acaoMarcarPerdido(lead.id, motivoPerda), 'Lead marcado como perdido.')}
                  className="rounded-full border border-perigo/40 px-3 py-1.5 text-xs font-semibold text-perigo disabled:opacity-50"
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
              className="text-xs text-texto-fraco hover:text-perigo"
            >
              Marcar como perdido
            </button>
          )}
        </Card>
      )}
    </div>
  )
}
