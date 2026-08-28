import { getRequestConfig } from 'next-intl/server'

/**
 * O painel é pt-BR e ponto.
 *
 * Sem cookie de idioma, sem lista de locales, sem seletor em tela nenhuma — o
 * krew-app tem oito idiomas porque a bio é pública e o criador escolhe; aqui é
 * ferramenta interna de uma pessoa só.
 *
 * O next-intl continua existindo por um motivo prático: as telas de bio foram
 * COPIADAS do produto e usam `useTranslations`. Mantendo o mecanismo, elas
 * rodam sem uma linha alterada — e voltam para lá do mesmo jeito. Tirá-lo
 * custaria editar cada arquivo copiado, que é exatamente o que a cópia existe
 * para evitar.
 */
/**
 * Mantidos porque arquivos COPIADOS do produto os importam (`lib/types.ts`,
 * `app/actions/proposals.ts`). O painel não troca de idioma — a lista existe
 * para que o código copiado continue compilando sem edição.
 */
export const LOCALES = ['pt-BR', 'en-US', 'es-ES', 'zh-CN', 'fr-FR', 'de-DE', 'ar-SA', 'ja-JP'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'pt-BR'
export const LOCALE_COOKIE = 'krew-locale'

export default getRequestConfig(async () => ({
  locale: 'pt-BR',
  messages: (await import('../messages/pt-BR.json')).default,
}))
