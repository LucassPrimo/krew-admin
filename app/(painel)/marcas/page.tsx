import { Aviso, Badge, Card, Titulo, Vazio } from '@/components/ui'
import { escritaLigada } from '@/lib/env'
import { listarAcessos, listarAssessorias, listarMarcas } from '@/lib/marcas'
import { data as formatarData } from '@/lib/format'

import { LiberarAcesso } from './liberar-acesso'

export const dynamic = 'force-dynamic'

/**
 * Marcas e assessorias — o lado B2B do produto.
 *
 * Marcas: o piloto é por convite (plano 2 §13). Daqui sai o link de acesso;
 * a organização da marca só nasce quando a pessoa aceita no app, com o mesmo
 * e-mail. Marcas que chegaram por convite de um criador também aparecem.
 *
 * Assessorias: leitura, para acompanhar tamanho de carteira e uso.
 */
export default async function Marcas() {
  const [marcas, acessos, assessorias] = await Promise.all([listarMarcas(), listarAcessos(), listarAssessorias()])

  return (
    <>
      <Titulo>Marcas e assessorias</Titulo>

      {!escritaLigada && (
        <div className="mb-4">
          <Aviso>A escrita está desligada neste deploy: dá para ver as listas, mas não liberar nem cancelar acessos.</Aviso>
        </div>
      )}

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-semibold">Liberar acesso ao piloto de marcas</h2>
        <LiberarAcesso acessos={acessos} />
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-semibold">Marcas ({marcas.length})</h2>
        <Card>
          {marcas.length === 0 ? <Vazio>Nenhuma marca ainda.</Vazio> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-texto-fraco">
                  <tr>
                    <th className="py-2 pr-3">Marca</th><th className="pr-3">Responsável</th><th className="pr-3">Membros</th>
                    <th className="pr-3">Campanhas</th><th className="pr-3">Criadores ativos</th><th className="pr-3">Convites</th>
                    <th className="pr-3">Para aprovar</th><th>Criada</th>
                  </tr>
                </thead>
                <tbody>
                  {marcas.map((m) => (
                    <tr key={m.id} className="border-t border-borda">
                      <td className="py-2 pr-3 font-medium">{m.nome}</td>
                      <td className="pr-3 text-texto-fraco">{m.dono_email ?? '—'}</td>
                      <td className="pr-3">{m.membros}</td>
                      <td className="pr-3">{m.projetos}</td>
                      <td className="pr-3">{m.participacoes_aceitas}</td>
                      <td className="pr-3">{m.convites_pendentes}</td>
                      <td className="pr-3">{m.para_aprovar > 0 ? <Badge tom="aviso">{m.para_aprovar}</Badge> : 0}</td>
                      <td className="text-texto-fraco">{formatarData(m.criada_em)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Assessorias ({assessorias.length})</h2>
        <Card>
          {assessorias.length === 0 ? <Vazio>Nenhuma assessoria ainda.</Vazio> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-texto-fraco">
                  <tr><th className="py-2 pr-3">Assessoria</th><th className="pr-3">Responsável</th><th className="pr-3">Equipe</th><th className="pr-3">Criadores</th><th className="pr-3">Campanhas ativas</th><th>Criada</th></tr>
                </thead>
                <tbody>
                  {assessorias.map((a) => (
                    <tr key={a.id} className="border-t border-borda">
                      <td className="py-2 pr-3 font-medium">{a.nome}</td>
                      <td className="pr-3 text-texto-fraco">{a.dono_email ?? '—'}</td>
                      <td className="pr-3">{a.membros}</td>
                      <td className="pr-3">{a.criadores}</td>
                      <td className="pr-3">{a.campanhas_ativas}</td>
                      <td className="text-texto-fraco">{formatarData(a.criada_em)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>
    </>
  )
}
