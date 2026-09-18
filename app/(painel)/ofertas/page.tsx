import Link from 'next/link'

import { Aviso, Badge, Card, Titulo, Vazio } from '@/components/ui'
import { escritaLigada } from '@/lib/env'
import { ofertasDisponiveis } from '@/lib/env'
import { data, numero, relativo } from '@/lib/format'
import { listarOfertas } from '@/lib/oferta'

export const dynamic = 'force-dynamic'

/**
 * As ofertas de bio: páginas prontas para apresentar a criadores que ainda não
 * têm conta.
 *
 * A coluna de cliques é o que transforma isto em ferramenta de venda e não em
 * cadastro: ela responde "ele abriu o link que eu mandei?" — que é a pergunta
 * que decide se você faz o follow-up hoje ou espera.
 */
export default async function Ofertas({ searchParams }: { searchParams: Promise<{ fila?: string }> }) {
  const { fila = 'abertas' } = await searchParams
  const ofertas = await listarOfertas()
  const abertas = ofertas.filter((o) => !o.aceita_em)
  const aceitas = ofertas.filter((o) => o.aceita_em)
  const semConvite = abertas.filter((o) => !o.convite_enviado_em)
  const semResposta = abertas.filter((o) => o.convite_enviado_em && Date.now() - new Date(o.convite_enviado_em).getTime() > 5 * 86400000)
  const exibidas = fila === 'sem_convite' ? semConvite : fila === 'sem_resposta' ? semResposta : abertas

  return (
    <>
      <Titulo
        acao={
          <Link
            href="/ofertas/nova"
            className="rounded-md bg-acento px-3 py-1.5 text-sm font-medium text-fundo"
          >
            Nova oferta
          </Link>
        }
      >
        Ofertas de bio
      </Titulo>

      {!ofertasDisponiveis && (
        <div className="mb-4">
          <Aviso tom="perigo">
            <code className="font-mono">ADMIN_SUPABASE_SERVICE_KEY</code> não está definida.
            Criar a conta e disparar o convite são chamadas da Admin API de Auth,
            que não existem em SQL — sem essa chave, a criação de oferta fica
            indisponível. O resto do painel funciona normalmente.
          </Aviso>
        </div>
      )}

      {!escritaLigada && (
        <div className="mb-4">
          <Aviso>
            A escrita está desligada, então nenhuma oferta pode ser criada ou
            enviada agora. A lista abaixo continua real.
          </Aviso>
        </div>
      )}

      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Filas de ofertas">
        {[
          ['abertas', 'Abertas', abertas.length],
          ['sem_convite', 'Sem convite', semConvite.length],
          ['sem_resposta', 'Sem resposta', semResposta.length],
          ['aceitas', 'Aceitas', aceitas.length],
        ].map(([valor, rotulo, total]) => (
          <Link
            key={String(valor)} href={`/ofertas?fila=${valor}`}
            className={`rounded-full border px-3 py-1.5 text-xs ${fila === valor ? 'border-borda-forte bg-painel-2 text-texto' : 'border-borda text-texto-fraco hover:border-borda-forte'}`}
          >
            {rotulo} <span className="ml-1 tabular-nums opacity-60">{total}</span>
          </Link>
        ))}
      </nav>

      {fila !== 'aceitas' && <Card className="mb-4">
        <h2 className="mb-1 text-sm font-medium">
          {fila === 'sem_convite' ? 'Prontas para enviar' : fila === 'sem_resposta' ? 'Aguardando follow-up' : 'Abertas'} ({exibidas.length})
        </h2>
        <p className="mb-3 text-xs text-texto-fraco">
          A página já está no ar e é buscável como qualquer outra — o visitante
          não vê nenhuma marca de que é uma oferta. O trial de 15 dias só começa
          a contar quando a pessoa aceita.
        </p>

        {exibidas.length === 0 ? (
          <Vazio>Nenhuma oferta nesta fila.</Vazio>
        ) : (
          <table className="densa">
            <thead>
              <tr>
                <th>Handle</th><th>Nome</th><th>Criada</th>
                <th>Convite</th><th>Cliques</th><th></th>
              </tr>
            </thead>
            <tbody>
              {exibidas.map((o) => (
                <tr key={o.page_id}>
                  <td className="font-mono text-xs">
                    <a
                      href={`https://bekrew.com/@${o.slug}`}
                      target="_blank" rel="noreferrer"
                      className="text-acento hover:underline"
                    >
                      @{o.slug}
                    </a>
                  </td>
                  <td>{o.nome ?? '—'}</td>
                  <td className="text-texto-fraco">{relativo(o.criada_em)}</td>
                  <td>
                    {o.convite_enviado_em ? (
                      <span title={o.email_convite ?? ''}>
                        <Badge tom="ok">enviado {relativo(o.convite_enviado_em)}</Badge>
                      </span>
                    ) : (
                      <Badge>não enviado</Badge>
                    )}
                  </td>
                  <td className="tabular-nums">{numero(o.cliques)}</td>
                  <td>
                    <Link href={`/users/${o.user_id}`} className="text-acento hover:underline">abrir user</Link>
                    <Link href={`/ofertas/${o.page_id}`} className="ml-3 text-acento hover:underline">ver oferta</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>}

      {fila === 'aceitas' && <Card>
        <h2 className="mb-3 text-sm font-medium">Aceitas ({aceitas.length})</h2>
        {aceitas.length === 0 ? (
          <Vazio>Nenhuma ainda.</Vazio>
        ) : (
          <table className="densa">
            <thead>
              <tr><th>Handle</th><th>Nome</th><th>Aceita em</th><th></th></tr>
            </thead>
            <tbody>
              {aceitas.map((o) => (
                <tr key={o.page_id}>
                  <td className="font-mono text-xs">@{o.slug}</td>
                  <td>{o.nome ?? '—'}</td>
                  <td className="text-texto-fraco">{data(o.aceita_em)}</td>
                  {/* Aceita continua abrindo: a página existe e às vezes você
                      precisa mexer nela junto com o criador, no telefone. */}
                  <td>
                    <Link href={`/ofertas/${o.page_id}`} className="text-acento hover:underline">
                      abrir
                    </Link>
                    <Link href={`/ofertas/${o.page_id}/analytics`} className="ml-3 text-acento hover:underline">Analytics</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>}
    </>
  )
}
