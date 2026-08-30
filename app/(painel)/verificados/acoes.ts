'use server'

import { headers } from 'next/headers'
import { revalidatePath, updateTag } from 'next/cache'

import { autorizarEscritaSemStepUp, exigirAtor } from '@/lib/auth'
import { tagBio } from '@/lib/bio/consulta'
import { buscarBioPorSlug, definirVerificado } from '@/lib/verificado'

/**
 * As ações do selo de verificado.
 *
 * `autorizarEscritaSemStepUp`, como as da oferta e do CRM: o TOTP a cada 15
 * minutos guarda /dados, onde um clique errado altera o cadastro de um
 * cliente. Ligar um selo reversível, endereçado pelo handle que você mesmo
 * escreveu, não é dessa categoria — ver a nota inteira em `lib/verificado.ts`.
 *
 * A checagem se repete em CADA ação porque Server Action é endpoint HTTP: quem
 * soubesse o nome poderia chamá-la sem passar pela tela.
 */

async function contexto() {
  const h = await headers()
  return {
    ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: h.get('user-agent'),
  }
}

/**
 * Quem é o dono deste handle — antes de conceder.
 *
 * É leitura, então exige só `exigirAtor()`. Existe para a tela mostrar o nome
 * e o e-mail de quem vai receber o selo enquanto você digita: conferir a
 * pessoa ANTES de clicar é o que substitui, aqui, a fricção do código.
 */
export async function acaoConferirHandle(entrada: string) {
  await exigirAtor()
  return buscarBioPorSlug(entrada)
}

export async function acaoDefinirVerificado(entrada: string, ligar: boolean) {
  const permissao = await autorizarEscritaSemStepUp()
  if (!permissao.ok) return { ok: false as const, erro: permissao.texto }

  const r = await definirVerificado(entrada, ligar, {
    atorId: permissao.ator.id,
    ...(await contexto()),
  })

  if (r.ok) {
    // A bio pública é cacheada por slug (`lib/bio/consulta.ts`); sem derrubar
    // a tag, o selo só apareceria no minuto seguinte do `revalidate`.
    updateTag(tagBio(r.pagina.slug))
    revalidatePath('/verificados')
    revalidatePath(`/pessoas/${r.pagina.user_id}`)
  }
  return r
}
