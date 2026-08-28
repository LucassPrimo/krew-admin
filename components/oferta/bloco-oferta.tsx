'use client'

import { Check, Loader2 } from 'lucide-react'
import { useState, useTransition } from 'react'

import { acaoEnviarConvite, acaoMarcarAceita, acaoSalvarNotas } from '@/app/(painel)/ofertas/acoes'
import { dataHora, relativo } from '@/lib/format'

/**
 * Os controles da OFERTA, dentro da tela de bio.
 *
 * Não veio do krew-app porque não existe lá: no app a página é do criador
 * desde o primeiro dia. Aqui ela nasce sem dono, e este bloco é o que trata
 * disso — convidar a pessoa, marcar quando ela aceitou, e as anotações de
 * venda que só você vê.
 *
 * Segue o formato dos cartões copiados (input `h-10 rounded-lg`, botão pílula
 * com o ✓) para não parecer um enxerto: é mais um bloco da mesma tela.
 */
const CAMPO =
  'h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary'

export function BlocoOferta({
  pageId, emailInicial, conviteEnviadoEm, aceitaEm, notasIniciais,
}: {
  pageId: string
  emailInicial: string | null
  conviteEnviadoEm: string | null
  aceitaEm: string | null
  notasIniciais: string | null
}) {
  const [pendente, startTransition] = useTransition()
  const [email, setEmail] = useState(emailInicial ?? '')
  const [notas, setNotas] = useState(notasIniciais ?? '')
  const [msg, setMsg] = useState<{ tom: 'ok' | 'erro'; texto: string } | null>(null)

  const notasSujas = notas !== (notasIniciais ?? '')

  function rodar(acao: () => Promise<{ ok: boolean; erro?: string }>, sucesso: string) {
    setMsg(null)
    startTransition(async () => {
      const r = await acao()
      setMsg(r.ok ? { tom: 'ok', texto: sucesso } : { tom: 'erro', texto: r.erro ?? 'Falhou.' })
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {aceitaEm ? (
        <p className="text-xs text-muted-foreground">
          Aceita em {dataHora(aceitaEm)}. A conta é do criador — o que você
          mudar aqui em cima já é edição da bio dele.
        </p>
      ) : (
        <>
          {conviteEnviadoEm && (
            <p className="text-xs text-muted-foreground">
              Convite enviado {relativo(conviteEnviadoEm)} para {emailInicial}.
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground">E-mail do criador</label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="para onde o convite vai" className={CAMPO}
            />
            <p className="text-xs text-muted-foreground">
              Enviar troca o e-mail da conta para este e manda o link de definir
              senha. A página, os links e os cliques continuam de pé.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button" disabled={pendente || !email.trim()}
              onClick={() => rodar(() => acaoEnviarConvite(pageId, email.trim()), 'Convite enviado.')}
              className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              {pendente ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
              Enviar convite
            </button>

            <button
              type="button" disabled={pendente}
              onClick={() => rodar(() => acaoMarcarAceita(pageId),
                'Marcada como aceita. Trial de 5 dias concedido.')}
              className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              Marcar como aceita
            </button>
          </div>
        </>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground">Notas de venda</label>
        <textarea
          rows={3} value={notas} onChange={(e) => setNotas(e.target.value)}
          placeholder="Como chegou, com quem falou, o que ficou combinado"
          className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <p className="text-xs text-muted-foreground">
          Só você vê. O criador não enxerga isto nem depois de assumir a conta.
        </p>
      </div>

      <button
        type="button" disabled={pendente || !notasSujas}
        onClick={() => rodar(() => acaoSalvarNotas(pageId, notas), 'Notas salvas.')}
        className="flex items-center gap-1.5 self-start rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
      >
        {pendente ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
        Salvar notas
      </button>

      {msg && (
        <p className={`text-xs ${msg.tom === 'ok' ? 'text-ok' : 'text-destructive'}`}>{msg.texto}</p>
      )}
    </div>
  )
}
