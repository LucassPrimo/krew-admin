import { Aviso, Titulo } from '@/components/ui'
import { escritaLigada } from '@/lib/env'
import { listarVerificadas } from '@/lib/verificado'

import { Verificador } from './verificador'

export const dynamic = 'force-dynamic'

/**
 * O selo de verificado, com tela própria.
 *
 * Ele já era editável em `/dados/proposal_pages`, e continua sendo — o que
 * mudou é o preço: lá o gesto custa achar o id da linha, o código do
 * autenticador e um motivo escrito, porque aquela tela precisa servir também
 * ao campo que transfere uma organização de dono. Conceder selo é operação de
 * toda semana, e cobrar o preço do caso perigoso pelo caso banal é o que faz
 * gente deixar de usar a ferramenta.
 *
 * O que não mudou: a linha em `admin_audit.mutations`, gravada no mesmo commit
 * do update. Ver `lib/verificado.ts` para o raciocínio completo.
 */
export default async function Verificados() {
  const lista = await listarVerificadas()

  return (
    <>
      <Titulo>Verificados</Titulo>

      {!escritaLigada && (
        <div className="mb-4">
          <Aviso>
            A escrita está desligada neste deploy, então nenhum selo pode ser
            concedido ou removido agora. A lista abaixo continua real.
          </Aviso>
        </div>
      )}

      <Verificador lista={lista} />
    </>
  )
}
