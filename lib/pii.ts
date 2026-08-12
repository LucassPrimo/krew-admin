/**
 * Máscara de dado sensível.
 *
 * A regra do §9 do plano: nada de documento, conta bancária, telefone ou
 * e-mail aparece inteiro sem um ato deliberado. Isso não é paranoia estética —
 * é o que separa "abri o painel" de "vazei a base". Uma tela de listagem com
 * 300 CPFs à mostra é um print de WhatsApp de distância de virar incidente.
 *
 * As funções aqui também são usadas ANTES de gravar na auditoria: o log
 * registra o que mudou, e não deve virar um segundo lugar onde o CPF de alguém
 * passa a existir em texto claro.
 */

export type TipoPii = 'documento' | 'bancario' | 'telefone' | 'email'

function soDigitos(v: string) {
  return v.replace(/\D/g, '')
}

/** CPF `123.456.789-01` → `•••.•••.•••-01`. Mantém os 2 últimos: o suficiente
 *  para conferir com o cliente no telefone sem exibir o documento. */
export function mascararDocumento(valor: string | null | undefined): string {
  if (!valor) return '—'
  const d = soDigitos(valor)
  if (d.length < 4) return '••••'
  if (d.length <= 11) return `•••.•••.•••-${d.slice(-2)}`
  return `••.•••.•••/••••-${d.slice(-2)}`
}

/** Telefone: mantém DDD e os 2 últimos dígitos. */
export function mascararTelefone(valor: string | null | undefined): string {
  if (!valor) return '—'
  const d = soDigitos(valor)
  if (d.length < 6) return '••••'
  const ddd = d.length >= 10 ? d.slice(-11, -9) || d.slice(0, 2) : d.slice(0, 2)
  return `(${ddd}) •••••-••${d.slice(-2)}`
}

/** E-mail: `lucas@krew.com.br` → `lu•••@krew.com.br`. O domínio fica visível
 *  porque quase sempre é o que importa para diagnosticar entrega de e-mail. */
export function mascararEmail(valor: string | null | undefined): string {
  if (!valor) return '—'
  const [usuario, dominio] = valor.split('@')
  if (!dominio) return '••••'
  const visivel = usuario.slice(0, 2)
  return `${visivel}${'•'.repeat(Math.max(3, usuario.length - 2))}@${dominio}`
}

/** Dados bancários (jsonb): some com agência/conta/pix, preserva o banco. */
export function mascararBancario(valor: unknown): string {
  if (!valor || typeof valor !== 'object') return '—'
  const obj = valor as Record<string, unknown>
  const banco = typeof obj.banco === 'string' ? obj.banco : 'banco não informado'
  const campos = Object.keys(obj).filter((k) => k !== 'banco').length
  return `${banco} · ${campos} campo${campos === 1 ? '' : 's'} oculto${campos === 1 ? '' : 's'}`
}

export function mascarar(tipo: TipoPii, valor: unknown): string {
  switch (tipo) {
    case 'documento':
      return mascararDocumento(valor as string)
    case 'telefone':
      return mascararTelefone(valor as string)
    case 'email':
      return mascararEmail(valor as string)
    case 'bancario':
      return mascararBancario(valor)
  }
}
