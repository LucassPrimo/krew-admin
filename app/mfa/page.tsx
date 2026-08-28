'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { supabaseBrowser } from '@/lib/supabase-browser'

/**
 * Verificação do segundo fator (camada 4).
 *
 * Sem isto a sessão fica em `aal1`, e o proxy recusa toda rota do painel. Uma
 * senha vazada sozinha não abre a porta — é o objetivo inteiro desta tela.
 */
export default function VerificarMFA() {
  const router = useRouter()
  const [codigo, setCodigo] = useState('')
  const [fatorId, setFatorId] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    supabaseBrowser().auth.mfa.listFactors().then(({ data }) => {
      const totp = data?.totp?.[0]
      if (!totp) {
        router.replace('/mfa/cadastrar')
        return
      }
      setFatorId(totp.id)
    })
  }, [router])

  async function verificar(e: React.FormEvent) {
    e.preventDefault()
    if (!fatorId) return
    setErro(null)
    setEnviando(true)

    const supabase = supabaseBrowser()
    const { data: desafio, error: erroDesafio } = await supabase.auth.mfa.challenge({ factorId: fatorId })
    if (erroDesafio || !desafio) {
      setErro('Não foi possível iniciar a verificação.')
      setEnviando(false)
      return
    }

    const { error } = await supabase.auth.mfa.verify({
      factorId: fatorId, challengeId: desafio.id, code: codigo.trim(),
    })

    if (error) {
      setErro('Código inválido ou expirado.')
      setEnviando(false)
      return
    }

    // `refresh()` além do replace: o cookie de sessão mudou de nível (aal1 →
    // aal2) e o proxy precisa reler para deixar passar.
    router.replace('/')
    router.refresh()
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={verificar} className="w-full max-w-sm">
        <h1 className="mb-1 text-xl font-medium">Código do autenticador</h1>
        <p className="mb-6 text-sm text-texto-fraco">
          Os 6 dígitos do app no seu celular.
        </p>

        <input
          inputMode="numeric" autoComplete="one-time-code" required
          maxLength={6} value={codigo}
          onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
          className="w-full rounded-md border border-borda bg-painel px-3 py-2 text-center font-mono text-lg tracking-[0.5em] outline-none focus:border-acento"
        />

        {erro && <p className="mt-3 text-sm text-perigo">{erro}</p>}

        <button
          type="submit" disabled={enviando || codigo.length !== 6}
          className="mt-4 w-full rounded-md bg-acento px-3 py-2 text-sm font-medium text-fundo disabled:opacity-50"
        >
          {enviando ? 'Verificando…' : 'Verificar'}
        </button>
      </form>
    </main>
  )
}
