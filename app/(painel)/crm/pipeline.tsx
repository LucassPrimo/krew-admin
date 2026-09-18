import Link from 'next/link'

import { data, relativo } from '@/lib/format'
import { FUNIL, ROTULO, vencido, type Lead } from '@/lib/crm-tipos'

/** Visão do funil; fatos derivados da oferta continuam somente leitura. */
export function Pipeline({ leads }: { leads: Lead[] }) {
  const abertos = leads.filter((l) => l.estagioEfetivo !== 'perdido' && l.estagioEfetivo !== 'aceito')

  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid min-w-[1080px] grid-cols-5 gap-3">
        {FUNIL.filter((e) => e !== 'aceito').map((estagio) => {
          const coluna = abertos.filter((l) => l.estagioEfetivo === estagio)
          return (
            <section key={estagio} className="rounded-lg border border-borda bg-fundo p-2">
              <div className="mb-2 flex items-center justify-between px-1">
                <h2 className="text-xs font-medium">{ROTULO[estagio]}</h2>
                <span className="text-[11px] tabular-nums text-texto-fraco">{coluna.length}</span>
              </div>
              <div className="space-y-2">
                {coluna.length === 0 && <p className="px-1 py-5 text-center text-[11px] text-texto-fraco">vazio</p>}
                {coluna.map((lead) => (
                  <Link key={lead.id} href={`/crm/${lead.id}`} className="block rounded-md border border-borda bg-painel p-3 transition-colors hover:border-borda-forte">
                    <div className="truncate text-sm font-medium">{lead.nome}</div>
                    <div className="mt-0.5 truncate font-mono text-[11px] text-texto-fraco">{lead.instagram ? `@${lead.instagram}` : lead.email ?? 'sem contato'}</div>
                    {lead.fonte && <div className="mt-2 truncate text-[11px] text-texto-fraco">via {lead.fonte}</div>}
                    <div className={`mt-2 text-[11px] ${vencido(lead) || !lead.proximo_contato ? 'text-aviso' : 'text-texto-fraco'}`} title={data(lead.proximo_contato)}>
                      {lead.proximo_contato ? `Contato ${relativo(lead.proximo_contato)}` : 'Sem próxima ação'}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
