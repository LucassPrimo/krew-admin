export interface CidadeAnalytics {
  city: string
  region: string | null
  country: string | null
  eventos: number
}

export const codigoPais = (pais: string | null) => (pais ?? '').trim().toUpperCase()

export function nomePaisAnalytics(pais: string | null, locale: string) {
  const codigo = codigoPais(pais)
  if (!codigo) return ''
  try { return new Intl.DisplayNames([locale], { type: 'region' }).of(codigo) || codigo }
  catch { return codigo }
}

export function filtrarCidades(cidades: CidadeAnalytics[], pais: string, regiao: string) {
  return cidades.filter((c) => (!pais || codigoPais(c.country) === pais)
    && (!regiao || c.region === regiao)).sort((a, b) => b.eventos - a.eventos)
}

export function rotuloCidade(cidade: CidadeAnalytics, locale: string) {
  return [cidade.city, cidade.region, nomePaisAnalytics(cidade.country, locale)].filter(Boolean).join(' · ')
}
