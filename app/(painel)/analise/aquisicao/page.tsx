import { Card, Titulo, Vazio } from '@/components/ui'
import { numero } from '@/lib/format'
import { cadastrosPorDia, comoConheceu, funilOnboarding } from '@/lib/metricas'
import { Barras } from '@/components/graficos'

export const dynamic = 'force-dynamic'

/**
 * Aquisição: de onde vem gente, e onde ela para.
 *
 * O funil de onboarding é a parte que dá dinheiro consertar — o passo onde a
 * maior queda acontece é, literalmente, uma lista de pessoas que quiseram
 * entrar e não conseguiram.
 */
export default async function Aquisicao() {
  const [dias, funil, origens] = await Promise.all([
    cadastrosPorDia(30), funilOnboarding(), comoConheceu(),
  ])

  const total = funil.reduce((s, p) => s + p.contas, 0)

  return (
    <>
      <Titulo>Aquisição</Titulo>

      <Card className="mb-4">
        <h2 className="mb-3 text-sm font-medium">Cadastros por dia (30 dias)</h2>
        <Barras dados={dias.map((d) => ({ rotulo: d.dia, valor: d.total }))} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-1 text-sm font-medium">Funil de onboarding</h2>
          <p className="mb-3 text-xs text-texto-fraco">
            Quantas contas pararam em cada passo. Acúmulo num passo intermediário
            é gente travada, não gente que desistiu do produto.
          </p>
          {funil.length === 0 ? <Vazio>Sem dados.</Vazio> : (
            <table className="densa">
              <thead><tr><th>Passo</th><th>Contas</th><th></th></tr></thead>
              <tbody>
                {funil.map((p) => (
                  <tr key={p.passo}>
                    <td>passo {p.passo}</td>
                    <td className="tabular-nums">{numero(p.contas)}</td>
                    <td className="w-40">
                      <div className="h-1.5 rounded-full bg-painel-2">
                        <div
                          className="h-1.5 rounded-full bg-acento"
                          style={{ width: `${total > 0 ? (p.contas / total) * 100 : 0}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <h2 className="mb-1 text-sm font-medium">Como conheceu</h2>
          <p className="mb-3 text-xs text-texto-fraco">
            Resposta livre do onboarding. Vale ler na mão — o texto costuma
            dizer mais do que a contagem.
          </p>
          {origens.length === 0 ? <Vazio>Sem dados.</Vazio> : (
            <table className="densa">
              <thead><tr><th>Origem</th><th>Contas</th></tr></thead>
              <tbody>
                {origens.map((o) => (
                  <tr key={o.origem}>
                    <td>{o.origem}</td>
                    <td className="tabular-nums">{numero(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  )
}
