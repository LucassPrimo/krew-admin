import { FormularioNovaOferta } from './formulario'

export const dynamic = 'force-dynamic'

/**
 * A rota de criar oferta — uma casca de servidor em volta do formulário.
 *
 * Ela existe só para LER a URL. O formulário é Client Component, e ler os
 * parâmetros lá dentro com `useSearchParams` obrigaria a embrulhar a tela num
 * `Suspense` para o build não reclamar de prerender. Aqui os valores chegam
 * como props comuns, e o formulário não precisa saber que veio do CRM.
 */
export default async function NovaOferta({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string; nome?: string; slug?: string }>
}) {
  const { lead, nome, slug } = await searchParams

  return (
    <FormularioNovaOferta
      leadId={lead}
      nomeInicial={nome ?? ''}
      slugInicial={(slug ?? '').toLowerCase().replace(/[^a-z0-9._-]/g, '')}
    />
  )
}
