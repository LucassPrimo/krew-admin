import type { Campo } from './registry'

/**
 * Coerção: string de formulário → valor de coluna.
 *
 * Vive fora de `mutate.ts` de propósito. É função pura, guiada pelo tipo que o
 * registry declarou, e não tem nada a ver com conexão de banco — separá-la
 * significa que ela pode ser testada sem que um teste unitário precise de
 * credencial de produção no ambiente.
 */
/** Converte o que veio do formulário (string) para o tipo que a coluna espera. */
export function coagir(campo: Campo, bruto: string): unknown {
  const valor = bruto.trim()

  // Vazio vira NULL, não string vazia: a diferença importa em coluna nullable
  // com CHECK, onde '' é recusado e NULL é o "sem valor" legítimo.
  if (valor === '') return null

  switch (campo.tipo) {
    case 'inteiro': {
      const n = Number.parseInt(valor, 10)
      if (!Number.isFinite(n)) throw new Error('Número inteiro inválido.')
      if (campo.min !== undefined && n < campo.min) throw new Error(`Mínimo ${campo.min}.`)
      if (campo.max !== undefined && n > campo.max) throw new Error(`Máximo ${campo.max}.`)
      return n
    }
    case 'numero':
    case 'dinheiro': {
      // Aceita "1.234,56" (como a pessoa digita) e "1234.56" (como cola de outra tela).
      const normal = valor.includes(',') ? valor.replace(/\./g, '').replace(',', '.') : valor
      const n = Number(normal)
      if (!Number.isFinite(n)) throw new Error('Número inválido.')
      if (campo.min !== undefined && n < campo.min) throw new Error(`Mínimo ${campo.min}.`)
      if (campo.max !== undefined && n > campo.max) throw new Error(`Máximo ${campo.max}.`)
      return n
    }
    case 'booleano':
      return valor === 'true' || valor === 'on' || valor === '1'
    case 'enum':
      if (!campo.opcoes?.includes(valor)) throw new Error(`Valor fora das opções: ${valor}`)
      return valor
    case 'uuid':
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor)) {
        throw new Error('UUID inválido.')
      }
      return valor
    case 'data':
    case 'ts': {
      const d = new Date(valor)
      if (Number.isNaN(d.getTime())) throw new Error('Data inválida.')
      return d.toISOString()
    }
    case 'json':
      try {
        return JSON.parse(valor)
      } catch {
        throw new Error('JSON inválido.')
      }
    default:
      return valor
  }
}
