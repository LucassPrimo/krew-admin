/** Formatação pt-BR. O painel é ferramenta interna: um idioma só, sem i18n. */

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const NUM = new Intl.NumberFormat('pt-BR')
const DATA = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' })
const DATA_HORA = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

export function dinheiro(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return '—'
  const n = typeof valor === 'string' ? Number(valor) : valor
  return Number.isFinite(n) ? BRL.format(n) : '—'
}

/** Centavos, que é como o Chargefy e as propostas guardam. */
export function centavos(valor: number | null | undefined): string {
  return valor === null || valor === undefined ? '—' : BRL.format(valor / 100)
}

export function numero(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return '—'
  const n = typeof valor === 'string' ? Number(valor) : valor
  return Number.isFinite(n) ? NUM.format(n) : '—'
}

export function data(valor: string | Date | null | undefined): string {
  if (!valor) return '—'
  const d = valor instanceof Date ? valor : new Date(valor)
  return Number.isNaN(d.getTime()) ? '—' : DATA.format(d)
}

export function dataHora(valor: string | Date | null | undefined): string {
  if (!valor) return '—'
  const d = valor instanceof Date ? valor : new Date(valor)
  return Number.isNaN(d.getTime()) ? '—' : DATA_HORA.format(d)
}

/**
 * "há 3 dias" / "em 2 meses".
 *
 * Em tela de suporte o relativo responde a pergunta real ("isso é recente?")
 * sem obrigar ninguém a fazer conta de calendário de cabeça. A data absoluta
 * continua no `title` de quem usa isto.
 */
export function relativo(valor: string | Date | null | undefined): string {
  if (!valor) return '—'
  const d = valor instanceof Date ? valor : new Date(valor)
  if (Number.isNaN(d.getTime())) return '—'

  const seg = Math.round((d.getTime() - Date.now()) / 1000)
  const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })
  const faixas: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000], ['month', 2592000], ['day', 86400],
    ['hour', 3600], ['minute', 60], ['second', 1],
  ]
  for (const [unidade, tamanho] of faixas) {
    if (Math.abs(seg) >= tamanho || unidade === 'second') {
      return rtf.format(Math.round(seg / tamanho), unidade)
    }
  }
  return '—'
}
