'use client'

import { useRouter } from 'next/navigation'
import { Check, Copy, Loader2 } from 'lucide-react'
import { useState, useTransition } from 'react'

import { Badge, Card, Vazio } from '@/components/ui'
import { data as formatarData } from '@/lib/format'
import { linkDeAcesso } from '@/lib/marcas-link'
import type { AcessoMarca } from '@/lib/marcas'

import { acaoCancelarAcesso, acaoCriarAcesso } from './acoes'

/**
 * Liberar = gerar o link. O painel não manda e-mail (não tem a chave do
 * Resend): o link sai aqui para o time mandar pelo canal da conversa com a
 * marca. Só funciona com uma conta no MESMO e-mail — o aceite confere.
 */
export function LiberarAcesso({ acessos }: { acessos: AcessoMarca[] }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [copiado, setCopiado] = useState<string | null>(null)
  const [pendente, startTransition] = useTransition()

  function copiar(token: string) {
    navigator.clipboard.writeText(linkDeAcesso(token))
    setCopiado(token)
    setTimeout(() => setCopiado(null), 2000)
  }

  return (
    <Card>
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault()
          setErro(null)
          startTransition(async () => {
            const r = await acaoCriarAcesso(email, nome)
            if (!r.ok) { setErro(r.erro); return }
            setEmail('')
            setNome('')
            copiar(r.valor.token)
            router.refresh()
          })
        }}
      >
        <input
          required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome da marca"
          className="h-9 rounded-md border border-borda bg-transparent px-3 text-sm sm:w-56"
        />
        <input
          required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail de quem vai administrar"
          className="h-9 flex-1 rounded-md border border-borda bg-transparent px-3 text-sm"
        />
        <button
          type="submit" disabled={pendente}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-texto px-4 text-sm font-medium text-fundo disabled:opacity-50"
        >
          {pendente && <Loader2 className="size-3.5 animate-spin" />}
          Gerar link de acesso
        </button>
      </form>
      {erro && <p className="mt-2 text-sm text-perigo">{erro}</p>}
      <p className="mt-2 text-xs text-texto-fraco">
        O link vale 30 dias e só pode ser aceito por uma conta com este e-mail. Quem aceita vira administrador da marca.
      </p>

      <div className="mt-4 overflow-x-auto">
        {acessos.length === 0 ? <Vazio>Nenhum acesso liberado ainda.</Vazio> : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-texto-fraco">
              <tr><th className="py-2 pr-3">Marca</th><th className="pr-3">E-mail</th><th className="pr-3">Situação</th><th className="pr-3">Criado</th><th /></tr>
            </thead>
            <tbody>
              {acessos.map((a) => {
                const expirado = a.status === 'pendente' && new Date(a.expires_at) < new Date()
                return (
                  <tr key={a.id} className="border-t border-borda">
                    <td className="py-2 pr-3 font-medium">{a.nome_marca}</td>
                    <td className="pr-3 text-texto-fraco">{a.email}</td>
                    <td className="pr-3">
                      {a.status === 'aceito' ? <Badge tom="ok">aceito</Badge>
                        : a.status === 'cancelado' ? <Badge>cancelado</Badge>
                          : expirado ? <Badge tom="perigo">expirado</Badge>
                            : <Badge tom="aviso">pendente</Badge>}
                    </td>
                    <td className="pr-3 text-texto-fraco">{formatarData(a.created_at)}</td>
                    <td className="whitespace-nowrap text-right">
                      {a.status === 'pendente' && !expirado && (
                        <>
                          <button type="button" onClick={() => copiar(a.token)}
                            className="mr-3 inline-flex items-center gap-1 text-xs text-texto-fraco hover:text-texto">
                            {copiado === a.token ? <Check className="size-3" /> : <Copy className="size-3" />}
                            {copiado === a.token ? 'copiado' : 'copiar link'}
                          </button>
                          <button type="button" disabled={pendente}
                            onClick={() => startTransition(async () => {
                              const r = await acaoCancelarAcesso(a.id)
                              if (!r.ok) setErro(r.erro)
                              router.refresh()
                            })}
                            className="text-xs text-perigo hover:underline">
                            cancelar
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  )
}
