import type { Coluna } from './registry'

/**
 * Formulário HTML devolve tudo como string. O banco não aceita tudo como
 * string. Esta é a fronteira.
 *
 * A conversão é declarada pelo tipo do registry, e não adivinhada pelo formato
 * do texto: adivinhar é como um campo de texto que por acaso contém "123"
 * acaba virando número, e um CEP com zero à esquerda perde o zero no caminho.
 */
export class ValorInvalido extends Error {
  constructor(readonly campo: string, mensagem: string) {
    super(mensagem)
    this.name = 'ValorInvalido'
  }
}

export function converter(campo: string, coluna: Coluna, bruto: FormDataEntryValue | null): unknown {
  // Checkbox ausente do FormData significa desmarcado — não "não informado".
  if (coluna.tipo === 'bool') return bruto === 'on' || bruto === 'true'

  const texto = typeof bruto === 'string' ? bruto.trim() : ''

  // Campo vazio vira NULL, não string vazia. Numa coluna `text` os dois são
  // aceitos pelo banco e significam coisas diferentes na tela — `''` aparece
  // como "preenchido com nada", que é pior que vazio.
  if (texto === '') return null

  switch (coluna.tipo) {
    case 'number':
    case 'money':
    case 'percent': {
      // Aceita "1.234,56" e "1234.56": quem digita valor em português usa
      // vírgula, e recusar isso seria transformar um acerto de campo numa
      // briga com o formulário.
      const normalizado = texto.replace(/\./g, '').replace(',', '.')
      const n = Number(normalizado)
      if (Number.isNaN(n)) throw new ValorInvalido(campo, `"${texto}" não é um número.`)
      if (coluna.min != null && n < coluna.min) {
        throw new ValorInvalido(campo, `Valor mínimo é ${coluna.min}.`)
      }
      if (coluna.max != null && n > coluna.max) {
        throw new ValorInvalido(campo, `Valor máximo é ${coluna.max}.`)
      }
      return n
    }

    case 'enum':
      if (coluna.opcoes && !coluna.opcoes.includes(texto)) {
        throw new ValorInvalido(campo, `"${texto}" não é uma opção válida.`)
      }
      return texto

    case 'json': {
      try {
        return JSON.parse(texto)
      } catch {
        throw new ValorInvalido(campo, 'JSON inválido.')
      }
    }

    case 'uuid':
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(texto)) {
        throw new ValorInvalido(campo, 'Não é um uuid válido.')
      }
      return texto

    case 'date':
      if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
        throw new ValorInvalido(campo, 'Data deve estar em AAAA-MM-DD.')
      }
      return texto

    case 'text':
    case 'textarea':
      if (coluna.max != null && texto.length > coluna.max) {
        throw new ValorInvalido(campo, `Máximo de ${coluna.max} caracteres.`)
      }
      return texto

    default:
      return texto
  }
}

/** Como o valor atual do banco vira o `defaultValue` de um input. */
export function paraInput(coluna: Coluna, valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  if (coluna.tipo === 'json' || coluna.tipo === 'array') return JSON.stringify(valor, null, 2)
  if (coluna.tipo === 'date') {
    const d = valor instanceof Date ? valor : new Date(String(valor))
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
  }
  return String(valor)
}
