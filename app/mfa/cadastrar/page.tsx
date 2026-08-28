'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { supabaseBrowser } from '@/lib/supabase-browser'

/**
 * Cadastro do fator TOTP — uma vez, no primeiro acesso.
 *
 * Se o fator for perdido, a saída é SQL manual no Supabase. É deliberado: um
 * caminho de recuperação por dentro do painel seria uma porta que dispensa o
 * segundo fator, ou seja, exatamente o que o segundo fator existe para evitar.
 */
export default function CadastrarMFA() {
  const router = useRouter()
  const [qr, setQr] = useState<string | null>(null)
  const [segredo, setSegredo] = useState<string | null>(null)
  const [fatorId, setFatorId] = useState<string | null>(null)
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    const supabase = supabaseBrowser()
    supabase.auth.mfa
      .enroll({ factorType: 'totp', friendlyName: `painel-${Date.now()}` })
      .then(({ data, error }) => {
        if (error || !data) {
          setErro(error?.message ?? 'Não foi possível iniciar o cadastro.')
          return
        }
        setQr(data.totp.qr_code)
        setSegredo(data.totp.secret)
        setFatorId(data.id)
      })
  }, [])

  async function confirmar(e: React.FormEvent) {
    e.preventDefault()
    if (!fatorId) return
    setErro(null)

    const supabase = supabaseBrowser()
    const { data: desafio } = await supabase.auth.mfa.challenge({ factorId: fatorId })
    if (!desafio) {
      setErro('Não foi possível confirmar.')
      return
    }

    const { error } = await supabase.auth.mfa.verify({
      factorId: fatorId, challengeId: desafio.id, code: codigo.trim(),
    })
    if (error) {
      setErro('Código inválido. Confira o relógio do celular.')
      return
    }

    router.replace('/')
    router.refresh()
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={confirmar} className="w-full max-w-sm">
        <h1 className="mb-1 text-xl font-medium">Cadastrar o segundo fator</h1>
        <p className="mb-6 text-sm text-texto-fraco">
          Leia o código no seu app autenticador. Guarde o segredo fora deste
          computador — se você perder o fator, só SQL manual recupera o acesso.
        </p>

        {qr && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="QR code do TOTP" className="mb-4 rounded-md bg-white p-2" width={200} height={200} />
        )}

        {segredo && (
          <p className="mb-4 break-all font-mono text-xs text-texto-fraco">{segredo}</p>
        )}

        <input
          inputMode="numeric" required maxLength={6} value={codigo}
          onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
          placeholder="000000"
          className="w-full rounded-md border border-borda bg-painel px-3 py-2 text-center font-mono text-lg tracking-[0.5em] outline-none focus:border-acento"
        />

        {erro && <p className="mt-3 text-sm text-perigo">{erro}</p>}

        <button
          type="submit" disabled={codigo.length !== 6}
          className="mt-4 w-full rounded-md bg-acento px-3 py-2 text-sm font-medium text-fundo disabled:opacity-50"
        >
          Confirmar
        </button>
      </form>
    </main>
  )
}
