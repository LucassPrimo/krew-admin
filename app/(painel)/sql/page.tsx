'use client'

import { useState, useTransition } from 'react'

import { rodarConsulta, type ResultadoSQL } from './consulta'

const EXEMPLOS = [
  { rotulo: 'Contas travadas no onboarding', sql: "select id, full_name, onboarding_step, created_at\nfrom profiles where coalesce(onboarding_step,0) < 3\norder by created_at desc" },
  { rotulo: 'Trials vencendo em 3 dias', sql: "select s.user_id, p.full_name, s.trial_ends_at\nfrom subscriptions s left join profiles p on p.id = s.user_id\nwhere s.trial_ends_at between now() and now() + interval '3 days'" },
  { rotulo: 'Bios com mais cliques', sql: "select p.slug, sum(l.cliques) as cliques\nfrom creator_links l join proposal_pages p on p.user_id = l.user_id\ngroup by p.slug order by cliques desc" },
]

export default function ConsoleSQL() {
  const [sql, setSql] = useState('')
  const [resultado, setResultado] = useState<ResultadoSQL | null>(null)
  const [pendente, startTransition] = useTransition()

  function rodar() {
    startTransition(async () => setResultado(await rodarConsulta(sql)))
  }

  return (
    <>
      <div className="mb-4">
        <h1 className="text-lg font-medium">Console SQL</h1>
        <p className="text-sm text-texto-fraco">
          Somente leitura, pela conexão sem permissão de escrita. Teto de 200
          linhas e 5 segundos por consulta.
        </p>
      </div>

      <div className="mb-2 flex flex-wrap gap-2">
        {EXEMPLOS.map((e) => (
          <button
            key={e.rotulo} onClick={() => setSql(e.sql)}
            className="rounded-md border border-borda px-2 py-1 text-xs text-texto-fraco hover:border-acento hover:text-texto"
          >
            {e.rotulo}
          </button>
        ))}
      </div>

      <textarea
        value={sql} onChange={(e) => setSql(e.target.value)} rows={8} spellCheck={false}
        placeholder="select …"
        className="w-full rounded-md border border-borda bg-painel p-3 font-mono text-xs outline-none focus:border-acento"
      />

      <button
        onClick={rodar} disabled={pendente || !sql.trim()}
        className="mt-2 rounded-md bg-acento px-4 py-1.5 text-sm font-medium text-fundo disabled:opacity-50"
      >
        {pendente ? 'Rodando…' : 'Rodar'}
      </button>

      {resultado && !resultado.ok && (
        <p className="mt-4 rounded-md border border-perigo/40 bg-perigo-fundo px-3 py-2 font-mono text-xs text-perigo">
          {resultado.erro}
        </p>
      )}

      {resultado?.ok && (
        <div className="mt-4">
          <p className="mb-2 text-xs text-texto-fraco">
            {resultado.linhas.length} linha(s) em {resultado.ms}ms
            {resultado.truncado && ' — cortado no teto de 200'}
          </p>
          <div className="overflow-x-auto rounded-md border border-borda">
            <table className="densa">
              <thead>
                <tr>{resultado.colunas.map((c) => <th key={c}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {resultado.linhas.map((linha, i) => (
                  <tr key={i}>
                    {resultado.colunas.map((c) => (
                      <td key={c} className="max-w-xs truncate font-mono text-[11px]">
                        {linha[c] === null ? <span className="text-texto-fraco">null</span>
                          : typeof linha[c] === 'object' ? JSON.stringify(linha[c])
                          : String(linha[c])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
