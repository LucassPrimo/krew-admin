'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Badge } from '@/components/ui'
import { ehPII, mascarar } from '@/lib/pii'
import type { TabelaAdmin } from '@/lib/registry'
import { salvarEdicao } from './acoes'

/**
 * Edição campo a campo, com diff antes de gravar.
 *
 * Duas fricções deliberadas:
 *
 * - **Você sempre vê o diff.** Nada é gravado sem que o "de → para" tenha
 *   passado pela sua frente. É o passo que pega o erro de digitação que o
 *   formulário aceitou de bom grado.
 * - **Campo perigoso pede confirmação por digitação.** Trocar `org_id` move a
 *   linha de dono; trocar `status` de recebível mexe em dinheiro. Digitar o
 *   nome do campo é o que separa "eu quis fazer isso" de "cliquei errado".
 */
export function Editor({
  tabela, registroId, mapa, linha, rotulos = {},
}: {
  tabela: string; registroId: string; mapa: TabelaAdmin
  linha: Record<string, unknown>
  /**
   * Nome humano de cada coluna que é chave estrangeira, resolvido no servidor.
   * O uuid continua sendo o valor editável — o rótulo existe para você saber o
   * que está prestes a trocar antes de trocar.
   */
  rotulos?: Record<string, { texto: string; href: string }>
}) {
  const router = useRouter()
  const [pendente, startTransition] = useTransition()
  const [rascunho, setRascunho] = useState<Record<string, string>>({})
  const [motivo, setMotivo] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [venceu, setVenceu] = useState(false)
  const pathname = usePathname()

  function original(coluna: string): string {
    const v = linha[coluna]
    if (v === null || v === undefined) return ''
    if (typeof v === 'object') return JSON.stringify(v)
    return String(v)
  }

  // O diff só considera o que REALMENTE mudou: digitar e desfazer não deve
  // gerar linha de auditoria nem update.
  const mudancas = Object.entries(rascunho).filter(([c, v]) => v !== original(c))
  const perigosas = mudancas.filter(([c]) => mapa.colunas[c]?.perigoso)
  const precisaConfirmar = perigosas.length > 0
  const confirmado = !precisaConfirmar || confirmacao.trim() === perigosas[0][0]

  function salvar() {
    setErro(null)
    startTransition(async () => {
      const r = await salvarEdicao(tabela, registroId, Object.fromEntries(mudancas), motivo)
      if (!r.ok) {
        setErro(r.erro)
        // O rascunho fica INTACTO quando o que faltou foi o código: você
        // confirma, volta para esta mesma linha e clica em gravar de novo.
        setVenceu(r.motivo === 'sem_step_up')
        return
      }
      setRascunho({})
      setMotivo('')
      setConfirmacao('')
      setVenceu(false)
      router.refresh()
    })
  }

  const campoCss =
    'w-full rounded-md border border-borda bg-fundo px-2 py-1 font-mono text-xs outline-none focus:border-acento'

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
      <div className="rounded-lg border border-borda bg-painel p-4">
        <table className="densa">
          <tbody>
            {Object.entries(mapa.colunas).map(([coluna, campo]) => {
              const valor = original(coluna)
              const editado = Object.hasOwn(rascunho, coluna) ? rascunho[coluna] : valor
              const mudou = editado !== valor

              return (
                <tr key={coluna}>
                  <td className="w-56 align-middle">
                    <span className="font-mono text-xs">{coluna}</span>
                    <div className="mt-0.5 flex gap-1">
                      {campo.perigoso && <Badge tom="perigo">perigoso</Badge>}
                      {ehPII(coluna) && <Badge tom="aviso">pii</Badge>}
                      {!campo.editavel && <Badge>fixo</Badge>}
                    </div>
                    {campo.nota && (
                      <p className="mt-1 text-[11px] leading-snug text-texto-fraco">{campo.nota}</p>
                    )}
                  </td>
                  <td>
                    {!campo.editavel ? (
                      <span className="font-mono text-xs text-texto-fraco">
                        {ehPII(coluna) ? mascarar(coluna, valor) : valor || '—'}
                      </span>
                    ) : campo.tipo === 'enum' ? (
                      <select
                        value={editado} className={campoCss}
                        onChange={(e) => setRascunho({ ...rascunho, [coluna]: e.target.value })}
                      >
                        <option value="">—</option>
                        {campo.opcoes?.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : campo.tipo === 'booleano' ? (
                      <select
                        value={editado} className={campoCss}
                        onChange={(e) => setRascunho({ ...rascunho, [coluna]: e.target.value })}
                      >
                        <option value="true">true</option>
                        <option value="false">false</option>
                      </select>
                    ) : campo.tipo === 'textarea' ? (
                      <textarea
                        value={editado} rows={3} className={campoCss}
                        onChange={(e) => setRascunho({ ...rascunho, [coluna]: e.target.value })}
                      />
                    ) : (
                      <input
                        value={editado} className={campoCss}
                        onChange={(e) => setRascunho({ ...rascunho, [coluna]: e.target.value })}
                      />
                    )}
                    {rotulos[coluna] && !mudou && (
                      <p className="mt-1 text-[11px] text-texto-fraco">
                        →{' '}
                        <Link href={rotulos[coluna].href} className="text-acento hover:underline">
                          {rotulos[coluna].texto}
                        </Link>
                      </p>
                    )}
                    {mudou && (
                      <p className="mt-1 text-[11px] text-acento">
                        era: <span className="font-mono">{valor || '(vazio)'}</span>
                      </p>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="h-fit rounded-lg border border-borda bg-painel p-4">
        <h2 className="mb-3 text-sm font-medium">
          {mudancas.length === 0 ? 'Nenhuma alteração' : `${mudancas.length} alteração(ões)`}
        </h2>

        {mudancas.length > 0 && (
          <>
            <div className="mb-3 rounded-md bg-fundo p-2 font-mono text-[11px]">
              {mudancas.map(([c, v]) => (
                <div key={c} className="mb-1">
                  <div className="text-texto-fraco">{c}</div>
                  <div className="text-perigo">− {original(c) || '(vazio)'}</div>
                  <div className="text-ok">+ {v || '(vazio)'}</div>
                </div>
              ))}
            </div>

            {precisaConfirmar && (
              <label className="mb-3 block">
                <span className="mb-1 block text-xs text-perigo">
                  Campo perigoso. Digite <code className="font-mono">{perigosas[0][0]}</code> para confirmar.
                </span>
                <input
                  value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)}
                  className={campoCss}
                />
              </label>
            )}

            <label className="mb-3 block">
              <span className="mb-1 block text-xs text-texto-fraco">
                Motivo (mín. 10 caracteres)
              </span>
              <input value={motivo} onChange={(e) => setMotivo(e.target.value)} className={campoCss} />
            </label>

            <button
              onClick={salvar}
              disabled={pendente || motivo.trim().length < 10 || !confirmado}
              className="w-full rounded-md bg-acento px-3 py-2 text-sm font-medium text-fundo disabled:opacity-40"
            >
              {pendente ? 'Gravando…' : 'Gravar'}
            </button>
          </>
        )}

        {erro && (
          <div className="mt-3 text-sm text-perigo">
            <p>{erro}</p>
            {venceu && (
              <Link
                href={`/mfa?voltar=${encodeURIComponent(pathname)}`}
                className="mt-1 inline-block font-medium underline underline-offset-2"
              >
                confirmar o código e voltar para esta linha
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
