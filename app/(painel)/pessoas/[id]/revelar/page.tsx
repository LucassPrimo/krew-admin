'use client'

import Link from 'next/link'
import { use, useState, useTransition } from 'react'

import { revelarCampo } from './acoes'

export default function Revelar({
  params, searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ campo?: string }>
}) {
  const { id } = use(params)
  const { campo } = use(searchParams)
  const alvo = campo ?? 'cpf_cnpj'

  const [motivo, setMotivo] = useState('')
  const [valor, setValor] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, startTransition] = useTransition()

  function pedir() {
    setErro(null)
    startTransition(async () => {
      const r = await revelarCampo(id, alvo, motivo)
      if (r.ok) setValor(r.valor)
      else setErro(r.erro)
    })
  }

  return (
    <div className="max-w-md">
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="text-lg font-medium">Revelar <code className="font-mono">{alvo}</code></h1>
        <Link href={`/pessoas/${id}`} className="text-sm text-texto-fraco hover:text-texto">voltar</Link>
      </div>

      <div className="rounded-lg border border-borda bg-painel p-4">
        <p className="mb-3 text-sm text-texto-fraco">
          Isto fica gravado: quem revelou, de quem, qual campo e por quê. O
          registro é permanente e aparece em /auditoria.
        </p>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs text-texto-fraco">Motivo (mín. 10 caracteres)</span>
          <input
            value={motivo} onChange={(e) => setMotivo(e.target.value)}
            placeholder="ex.: conferir CPF para emissão de nota do cliente"
            className="w-full rounded-md border border-borda bg-fundo px-2 py-1.5 text-sm outline-none focus:border-acento"
          />
        </label>

        <button
          onClick={pedir} disabled={pendente || motivo.trim().length < 10 || valor !== null}
          className="rounded-md bg-acento px-3 py-1.5 text-sm font-medium text-fundo disabled:opacity-40"
        >
          {pendente ? 'Registrando…' : 'Revelar'}
        </button>

        {valor !== null && (
          <p className="mt-4 rounded-md border border-borda-forte bg-fundo px-3 py-2 font-mono text-sm">
            {valor || '(vazio)'}
          </p>
        )}
        {erro && <p className="mt-3 text-sm text-perigo">{erro}</p>}
      </div>
    </div>
  )
}
