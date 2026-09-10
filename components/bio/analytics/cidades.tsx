'use client'

import { useId, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { GeoBio } from '@/app/actions/bio-analytics'
import { codigoPais, filtrarCidades, nomePaisAnalytics, rotuloCidade } from '@/lib/analytics/cidades'

/** País e região são filtros de exibição; a mesma coleta atende qualquer país. */
export function CidadesAnalytics({ dados, locale, titulo, acessos, vazio }: {
  dados: GeoBio; locale: string; titulo: string; acessos: string; vazio: string
}) {
  const t = useTranslations('bioAnalytics')
  const id = useId()
  const [pais, setPais] = useState('')
  const [regiao, setRegiao] = useState('')
  const paises = [...new Set([
    ...dados.porPais.map((p) => codigoPais(p.country)),
    ...dados.porCidade.map((c) => codigoPais(c.country)),
  ])].filter(Boolean).sort((a, b) => nomePaisAnalytics(a, locale).localeCompare(nomePaisAnalytics(b, locale), locale))
  const paisAtual = paises.includes(pais) ? pais : ''
  const regioes = [...new Set(dados.porCidade.filter((c) => paisAtual && codigoPais(c.country) === paisAtual)
    .map((c) => c.region).filter((r): r is string => Boolean(r)))].sort((a, b) => a.localeCompare(b, locale))
  const regiaoAtual = paisAtual && regioes.includes(regiao) ? regiao : ''
  const linhas = filtrarCidades(dados.porCidade, paisAtual, regiaoAtual)
  const total = linhas.reduce((s, c) => s + c.eventos, 0)
  const visitasPais = dados.porPais.filter((p) => !paisAtual || codigoPais(p.country) === paisAtual)
    .reduce((s, p) => s + p.eventos, 0)

  return <section className="rounded-2xl bg-card p-5 shadow-card">
    <h2 className="text-sm font-bold text-foreground">{titulo}</h2>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <label htmlFor={`${id}-pais`} className="text-xs text-muted-foreground">
        {t('cidadePais')}
        <select id={`${id}-pais`} value={paisAtual} onChange={(e) => { setPais(e.target.value); setRegiao('') }} className="mt-1 block w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground">
          <option value="">{t('cidadeTodosPaises')}</option>
          {paises.map((p) => <option key={p} value={p}>{nomePaisAnalytics(p, locale)}</option>)}
        </select>
      </label>
      <label htmlFor={`${id}-regiao`} className="text-xs text-muted-foreground">
        {t('cidadeRegiao')}
        <select id={`${id}-regiao`} value={regiaoAtual} disabled={!paisAtual || !regioes.length} onChange={(e) => setRegiao(e.target.value)} className="mt-1 block w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground disabled:opacity-50">
          <option value="">{t('cidadeTodasRegioes')}</option>
          {regioes.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </label>
    </div>
    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{t('cidadePrivacidade')}</p>
    {paisAtual && <p className="mt-2 text-xs text-muted-foreground">{nomePaisAnalytics(paisAtual, locale)}: {visitasPais.toLocaleString(locale)} {acessos.toLocaleLowerCase(locale)}</p>}
    {linhas.length === 0 ? <p role="status" className="py-6 text-sm text-muted-foreground">{vazio}</p> : <ul className="mt-4 flex flex-col gap-3">
      {linhas.map((c, i) => <li key={`${c.country}-${c.region}-${c.city}-${i}`} className="flex items-start gap-3 text-sm">
        <span className="min-w-0 flex-1 break-words text-foreground">{rotuloCidade(c, locale)}</span>
        <span className="shrink-0 text-xs tabular-figures text-muted-foreground">{c.eventos.toLocaleString(locale)} · {total > 0 ? Math.round(c.eventos / total * 100) : 0}%</span>
      </li>)}
    </ul>}
  </section>
}
