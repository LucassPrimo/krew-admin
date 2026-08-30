'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BadgeCheck, Loader2 } from 'lucide-react'
import { useEffect, useState, useTransition } from 'react'

import { Badge, Card, Vazio } from '@/components/ui'
import type { BioParaSelo } from '@/lib/verificado'
import { acaoConferirHandle, acaoDefinirVerificado } from './acoes'

/**
 * Conceder o selo em dois gestos: escrever o handle e clicar.
 *
 * A conferência acontece ENQUANTO você digita, e é ela que faz o trabalho que
 * o código do autenticador não fazia: o TOTP provava que era você, nunca que
 * era a pessoa certa. Ver o nome e o e-mail do dono antes do clique é a única
 * checagem que evita o erro que realmente acontece aqui, que é verificar o
 * @fulano errado.
 *
 * Por isso o botão só acende quando o handle existe: sem página encontrada não
 * há o que conceder, e um botão ativo que devolve erro é fricção sem
 * informação.
 */
export function Verificador({ lista }: { lista: BioParaSelo[] }) {
  const router = useRouter()
  const [pendente, startTransition] = useTransition()

  const [handle, setHandle] = useState('')
  const [achado, setAchado] = useState<BioParaSelo | null>(null)
  const [conferindo, setConferindo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [feito, setFeito] = useState<string | null>(null)

  // Um respiro de 400 ms entre teclas: conferir a cada caractere seria uma
  // consulta por letra para responder a mesma pergunta uma vez.
  useEffect(() => {
    const texto = handle.trim()
    if (!texto) {
      setAchado(null)
      return
    }
    setConferindo(true)
    const t = setTimeout(() => {
      acaoConferirHandle(texto)
        .then(setAchado)
        .finally(() => setConferindo(false))
    }, 400)
    return () => clearTimeout(t)
  }, [handle])

  function definir(entrada: string, ligar: boolean) {
    setErro(null)
    setFeito(null)
    startTransition(async () => {
      const r = await acaoDefinirVerificado(entrada, ligar)
      if (!r.ok) {
        setErro(r.erro)
        return
      }
      setFeito(
        !r.mudou
          ? `@${r.pagina.slug} já estava ${ligar ? 'verificado' : 'sem selo'}.`
          : ligar
            ? `@${r.pagina.slug} agora está verificado.`
            : `O selo de @${r.pagina.slug} foi removido.`,
      )
      if (ligar) {
        setHandle('')
        setAchado(null)
      }
      router.refresh()
    })
  }

  const campo =
    'h-10 w-full rounded-md border border-borda bg-fundo px-3 text-sm outline-none focus:border-acento'

  return (
    <>
      <Card className="mb-4">
        <h2 className="mb-1 text-sm font-medium">Conceder o selo</h2>
        <p className="mb-3 text-xs text-texto-fraco">
          Escreva o handle da página — <code className="font-mono">@fulano</code>,{' '}
          <code className="font-mono">bekrew.com/@fulano</code> ou a URL inteira. Não
          pede o código do autenticador: o selo é reversível e fica registrado na
          auditoria de qualquer forma.
        </p>

        <div className="flex gap-2">
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && achado && !achado.bio_verificado) {
                e.preventDefault()
                definir(achado.slug, true)
              }
            }}
            placeholder="@fulano"
            className={`${campo} font-mono`}
            autoFocus
          />
          <button
            type="button"
            onClick={() => achado && definir(achado.slug, true)}
            disabled={pendente || !achado || achado.bio_verificado}
            className="flex shrink-0 items-center gap-1.5 rounded-md bg-acento px-3 py-1.5 text-sm font-medium text-fundo disabled:opacity-40"
          >
            {pendente ? <Loader2 className="size-4 animate-spin" /> : <BadgeCheck className="size-4" />}
            Verificar
          </button>
        </div>

        <div className="mt-2 min-h-[1.25rem] text-xs">
          {conferindo && <span className="text-texto-fraco">conferindo…</span>}
          {!conferindo && handle.trim() && !achado && (
            <span className="text-perigo">Nenhuma página com esse handle.</span>
          )}
          {!conferindo && achado && (
            <span className="text-texto-fraco">
              <Link href={`/pessoas/${achado.user_id}`} className="text-acento hover:underline">
                {achado.nome ?? '(sem nome)'}
              </Link>
              {achado.email ? ` · ${achado.email}` : ''}
              {!achado.bio_ativo && ' · página fora do ar'}
              {achado.bio_verificado && ' · já verificado'}
            </span>
          )}
        </div>

        {erro && <p className="mt-2 text-xs text-perigo">{erro}</p>}
        {feito && <p className="mt-2 text-xs text-ok">{feito}</p>}
      </Card>

      <Card>
        <h2 className="mb-1 text-sm font-medium">Com selo ({lista.length})</h2>
        <p className="mb-3 text-xs text-texto-fraco">
          Tirar o selo é o mesmo gesto ao contrário — e some da página pública na
          leitura seguinte.
        </p>

        {lista.length === 0 ? (
          <Vazio>Ninguém verificado ainda.</Vazio>
        ) : (
          <table className="densa">
            <thead>
              <tr><th>Handle</th><th>Pessoa</th><th>No ar</th><th /></tr>
            </thead>
            <tbody>
              {lista.map((b) => (
                <tr key={b.id}>
                  <td className="font-mono text-xs">@{b.slug}</td>
                  <td>
                    <Link href={`/pessoas/${b.user_id}`} className="hover:underline">
                      {b.nome ?? '(sem nome)'}
                    </Link>
                  </td>
                  <td>{b.bio_ativo ? <Badge tom="ok">sim</Badge> : <Badge tom="perigo">não</Badge>}</td>
                  <td className="text-right">
                    <button
                      type="button"
                      onClick={() => definir(b.slug, false)}
                      disabled={pendente}
                      className="text-xs text-texto-fraco hover:text-perigo disabled:opacity-40"
                    >
                      remover selo
                    </button>
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
