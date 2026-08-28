'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'

import { KrewLogo } from '@/components/ui/krew-logo'
import { supabaseBrowser } from '@/lib/supabase-browser'

/**
 * Entrada do painel.
 *
 * Sem cadastro e sem "esqueci a senha" de propósito: a conta é a mesma do app
 * principal, e recuperação de senha acontece lá. Um fluxo de recuperação aqui
 * seria uma segunda porta para a credencial mais poderosa do sistema.
 */
const MOTIVOS: Record<string, string> = {
  sessao: 'Sua sessão expirou ou não chegou ao servidor. Entre de novo.',
}

export default function Login() {
  // `useSearchParams` exige Suspense em página estática — sem ele o build
  // reclama, e a alternativa (tornar a página dinâmica) só para ler um aviso
  // seria pagar caro por pouco.
  return (
    <Suspense fallback={null}>
      <Formulario />
    </Suspense>
  )
}

function Formulario() {
  const router = useRouter()
  const motivo = useSearchParams().get('motivo')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setEnviando(true)

    const { error } = await supabaseBrowser().auth.signInWithPassword({ email, password: senha })

    if (error) {
      // Mensagem genérica: dizer "usuário não existe" confirmaria para quem
      // está tentando adivinhar quais e-mails são de administrador.
      setErro('E-mail ou senha incorretos.')
      setEnviando(false)
      return
    }

    // Sempre para /mfa: o segundo fator é obrigatório, e é o proxy que decide
    // se o caso é verificar ou cadastrar.
    router.replace('/mfa')
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={entrar} className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-start gap-3">
          <KrewLogo className="h-5 w-auto text-texto" />
          <h1 className="text-xl font-medium">Painel interno</h1>
        </div>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs text-texto-fraco">E-mail</span>
          <input
            type="email" required autoComplete="username"
            value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-borda bg-painel px-3 py-2 text-sm outline-none focus:border-acento"
          />
        </label>

        <label className="mb-4 block">
          <span className="mb-1 block text-xs text-texto-fraco">Senha</span>
          <input
            type="password" required autoComplete="current-password"
            value={senha} onChange={(e) => setSenha(e.target.value)}
            className="w-full rounded-md border border-borda bg-painel px-3 py-2 text-sm outline-none focus:border-acento"
          />
        </label>

        {!erro && motivo && MOTIVOS[motivo] && (
          <p className="mb-3 text-sm text-texto-fraco">{MOTIVOS[motivo]}</p>
        )}
        {erro && <p className="mb-3 text-sm text-perigo">{erro}</p>}

        <button
          type="submit" disabled={enviando}
          className="w-full rounded-md bg-acento px-3 py-2 text-sm font-medium text-fundo disabled:opacity-50"
        >
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>

        <p className="mt-4 text-xs text-texto-fraco">
          Recuperação de senha só pelo app principal.
        </p>
      </form>
    </main>
  )
}
