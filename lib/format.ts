/**
 * Formatação de exibição. pt-BR fixo — é ferramenta interna, não tem i18n.
 */

const dinheiro = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const numero = new Intl.NumberFormat('pt-BR')

export function brl(valor: unknown): string {
  const n = typeof valor === 'string' ? Number(valor) : (valor as number)
  if (n == null || Number.isNaN(n)) return '—'
  return dinheiro.format(n)
}

/** Centavos, como `budget_cents` e `min_budget_cents` guardam. */
export function brlCentavos(valor: unknown): string {
  const n = typeof valor === 'string' ? Number(valor) : (valor as number)
  if (n == null || Number.isNaN(n)) return '—'
  return dinheiro.format(n / 100)
}

export function num(valor: unknown): string {
  const n = typeof valor === 'string' ? Number(valor) : (valor as number)
  if (n == null || Number.isNaN(n)) return '—'
  return numero.format(n)
}

export function data(valor: unknown): string {
  if (!valor) return '—'
  const d = valor instanceof Date ? valor : new Date(String(valor))
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function dataHora(valor: unknown): string {
  if (!valor) return '—'
  const d = valor instanceof Date ? valor : new Date(String(valor))
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** "há 3 dias" — para colunas de última atividade, onde a distância importa
 *  mais que a data exata. */
export function desde(valor: unknown): string {
  if (!valor) return '—'
  const d = valor instanceof Date ? valor : new Date(String(valor))
  if (Number.isNaN(d.getTime())) return '—'

  const segundos = Math.floor((Date.now() - d.getTime()) / 1000)
  if (segundos < 60) return 'agora'
  const minutos = Math.floor(segundos / 60)
  if (minutos < 60) return `há ${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `há ${horas} h`
  const dias = Math.floor(horas / 24)
  if (dias < 30) return `há ${dias} d`
  const meses = Math.floor(dias / 30)
  if (meses < 12) return `há ${meses} mês${meses === 1 ? '' : 'es'}`
  return `há ${Math.floor(meses / 12)} ano${meses < 24 ? '' : 's'}`
}

/** "em 3 dias" / "há 3 dias" — como `desde`, mas para datas que também podem
 *  estar no futuro (vencimento de assinatura, prazo). */
export function relativo(valor: unknown): string {
  if (!valor) return '—'
  const d = valor instanceof Date ? valor : new Date(String(valor))
  if (Number.isNaN(d.getTime())) return '—'

  const diffMs = d.getTime() - Date.now()
  const futuro = diffMs >= 0
  const segundos = Math.floor(Math.abs(diffMs) / 1000)

  if (segundos < 60) return futuro ? 'em instantes' : 'agora'
  const minutos = Math.floor(segundos / 60)
  if (minutos < 60) return futuro ? `em ${minutos} min` : `há ${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return futuro ? `em ${horas} h` : `há ${horas} h`
  const dias = Math.floor(horas / 24)
  if (dias < 30) return futuro ? `em ${dias} d` : `há ${dias} d`
  const meses = Math.floor(dias / 30)
  if (meses < 12) return futuro ? `em ${meses} mês${meses === 1 ? '' : 'es'}` : `há ${meses} mês${meses === 1 ? '' : 'es'}`
  const anos = Math.floor(meses / 12)
  return futuro ? `em ${anos} ano${anos === 1 ? '' : 's'}` : `há ${anos} ano${anos === 1 ? '' : 's'}`
}

/** Uuid encurtado para caber em tabela sem virar sopa de letra. */
export function idCurto(valor: unknown): string {
  const s = String(valor ?? '')
  return s.length > 12 ? `${s.slice(0, 8)}…` : s
}
