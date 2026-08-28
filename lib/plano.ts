import { estadoAssinatura, type AssinaturaRow } from '@/lib/assinatura'
// Só o TIPO: `tipos.ts` não importa nada, e é o que permite este módulo
// continuar sendo carregado pelo middleware, que roda em Edge.
import type { BioData } from '@/lib/bio/tipos'

/**
 * Recursos PRO — o primeiro tiering do produto, e ele é FREEMIUM: o resto do
 * app (propostas, contratos, campanhas, financeiro, contador, assistente,
 * agência) continua liberado para todo mundo enquanto `COBRANCA_ATIVA` (em
 * `lib/assinatura.ts`) estiver `false`. Só a bio tem recursos pagos, e são
 * eles que este interruptor liga — de propósito, um switch à parte do gate de
 * tudo-ou-nada, para dar para cobrar só a bio sem travar o app inteiro.
 *
 * Enquanto `PRO_ATIVO` for `false` isto devolve `true` para todo mundo — UI já
 * mostra os selos PRO (é como a pessoa descobre que existe um plano pago), mas
 * nada é bloqueado de fato. `true` liga os gates (limite de links/seções,
 * marca Krew, seguidores, Analytics) sem tocar em nenhum componente.
 */
export const PRO_ATIVO = true

export function ehPro(sub: AssinaturaRow | null | undefined): boolean {
  if (!PRO_ATIVO) return true
  const estado = estadoAssinatura(sub)
  // Trial conta como PRO de propósito: o teste grátis só vende o plano se
  // mostrar o que o plano faz.
  return estado === 'ativa' || estado === 'trial' || estado === 'cancelada_com_prazo'
}

/**
 * Teto da lista da bio no Free: 1 seção (divisor) e 3 links. Pro é ilimitado.
 *
 * Números baixos de propósito — o objetivo não é sufocar quem começa, é dar
 * um motivo concreto e visível (a lista mais rica de exemplo do link da bio
 * sempre tem mais de uma seção) para assinar.
 */
export const LIMITE_LINKS_FREE = 3
export const LIMITE_SECOES_FREE = 1

/**
 * A bio REBAIXADA para Free — o que a página mostra quando o plano cai.
 *
 * O gate de escrita (`atualizarConfigBio`, `criarItemBio`) impede LIGAR recurso
 * pago sem plano, mas não diz nada sobre quem ligou enquanto pagava e parou de
 * pagar: os dados continuam no banco, e sem isto a página seguiria sem a marca
 * Krew, com os seguidores à mostra e a lista inteira — de graça, para sempre.
 *
 * Rebaixa, não apaga. Nada aqui escreve no banco: link nenhum é removido,
 * toggle nenhum é desligado. É uma projeção da leitura, e é o que faz o retorno
 * do pagamento devolver a página exatamente como ela era — sem restaurar nada,
 * sem a pessoa reconfigurar nada. A página continua de pé e funcional; o que
 * some é só o que o plano pagava.
 *
 * Aplicada nas DUAS leituras (`getBioBySlug`, para o visitante, e
 * `getBioDoDono`, para a prévia do editor) de propósito: a prévia existe para
 * mostrar a página real, e uma prévia que ainda exibisse os recursos pagos
 * mentiria justo para quem precisa entender por que a página mudou.
 *
 * Em TypeScript e não em SQL porque a regra do produto mora aqui: `PRO_ATIVO`
 * é um interruptor deste arquivo, e uma cópia da regra dentro da função do
 * banco divergiria dele no dia em que ele mudasse.
 */
export function rebaixarBioParaFree(bio: BioData): BioData {
  // `bio.oferta` sai inteira: é vitrine da Krew, não a página gratuita de um
  // usuário — não há usuário ainda. A conta-fantasma não tem plano porque
  // `criarOferta` zera o trial de propósito, e sem esta linha a página que
  // existe para vender o produto mostrava 3 dos 20 links importados. Ver a
  // migration `20260828140000_oferta_nao_rebaixa`.
  if (!PRO_ATIVO || bio.pro || bio.oferta) return bio

  // Os tetos contam por tipo, como em `criarItemBio`: 3 links e 1 divisor. Os
  // PRIMEIROS de cada, na ordem que o criador arrastou — cortar do fim é o
  // único jeito de o corte ser estável (e reversível) sem tocar em `ordem`.
  let links = 0
  let secoes = 0
  const lista = bio.links.filter((item) => {
    if (item.tipo === 'divisor') return ++secoes <= LIMITE_SECOES_FREE
    return ++links <= LIMITE_LINKS_FREE
  })

  return {
    ...bio,
    links: lista,
    // Seguidores são PRO: some o total da linha do `@handle` e o número de
    // cada rede — os ícones continuam ali, clicáveis, que é o que mantém a
    // página útil.
    seguidoresTotal: null,
    redes: bio.redes.map((r) => (r.followers == null ? r : { ...r, followers: null })),
    // A marca no rodapé volta. Escondê-la é o recurso pago mais direto que
    // existe: quem não paga, exibe.
    esconderMarca: false,
    // O botão de proposta é pago pelo gate geral do app (ver a checagem em
    // `atualizarConfigBio`), e os estados que o liberam são os mesmos de
    // `ehPro` — daí a mesma bandeira decidir os dois aqui.
    mostrarPropostas: false,
  }
}
