/**
 * A porta única da importação: você cola o endereço, isto decide quem lê.
 *
 * Existem dois extratores — `importar-linkme.ts` e `importar-linktree.ts` —
 * porque as duas páginas guardam o dado de formas completamente diferentes
 * (âncora raspada de um lado, JSON do Next do outro). O que eles NÃO têm é
 * saída diferente: os dois devolvem `PerfilImportado`, e por isso a tela, o
 * `criarOferta` e o `trazerImagem` continuam sem saber de onde veio o perfil.
 *
 * O handle solto ("fulano", "@fulano") continua sendo link.me: é o que já era
 * o comportamento e o que a caixa de texto sempre aceitou. Para o Linktree
 * pede-se a URL — `linktr.ee/fulano` já basta, com ou sem `https://`.
 */

import { buscarPerfil as buscarNoLinkme } from './importar-linkme'
import { buscarPerfilLinktree } from './importar-linktree'

export type {
  LinkImportado,
  PerfilLinkme as PerfilImportado,
  Plataforma,
  RedeImportada,
} from './importar-linkme'

/** Qual serviço a entrada indica. Só o host decide — texto solto é link.me. */
export function origemDaEntrada(entrada: string): 'linktree' | 'linkme' {
  return /(^|[/.@])linktr\.ee|(^|[/.])linktree\.com/i.test(entrada.trim())
    ? 'linktree'
    : 'linkme'
}

export function buscarPerfil(entrada: string) {
  return origemDaEntrada(entrada) === 'linktree'
    ? buscarPerfilLinktree(entrada)
    : buscarNoLinkme(entrada)
}
