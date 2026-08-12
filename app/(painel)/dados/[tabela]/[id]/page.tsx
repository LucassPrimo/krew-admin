import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { exigirAdmin, stepUpValido } from '@/lib/auth'
import { converter, paraInput, ValorInvalido } from '@/lib/coerce'
import { sqlRo } from '@/lib/db'
import { env } from '@/lib/env'
import { dataHora } from '@/lib/format'
import { chavePrimaria, colunasDe, tabelaExiste } from '@/lib/introspect'
import { aplicarMutacao, MutacaoRecusada } from '@/lib/mutate'
import { REGISTRY } from '@/lib/registry'
import { Badge, Card, Celula, Linha, Tabela, Vazio } from '@/components/ui'
import { Valor } from '@/components/valor'

export const dynamic = 'force-dynamic'

/** Texto que precisa ser digitado quando a alteração toca um campo perigoso. */
const FRASE_CONFIRMACAO = 'ALTERAR'

export default async function Registro({
  params,
  searchParams,
}: {
  params: Promise<{ tabela: string; id: string }>
  searchParams: Promise<{ erro?: string; ok?: string }>
}) {
  const admin = await exigirAdmin()
  const { tabela, id } = await params
  const { erro, ok } = await searchParams

  if (!(await tabelaExiste(tabela))) notFound()

  const definicao = REGISTRY[tabela]
  const colunasBanco = await colunasDe(tabela)
  const chave = (await chavePrimaria(tabela)) ?? colunasBanco[0]?.nome

  const [linha] = await sqlRo<Record<string, unknown>[]>`
    select * from ${sqlRo(tabela)} where ${sqlRo(chave)} = ${id}
  `
  if (!linha) notFound()

  const historico = await sqlRo<
    {
      id: string
      ocorrido_em: Date
      antes: Record<string, unknown>
      depois: Record<string, unknown>
      motivo: string
      acao: string
    }[]
  >`
    select id::text, ocorrido_em, antes, depois, motivo, acao
    from admin_audit.mutations
    where tabela = ${tabela} and registro_id = ${id}
    order by ocorrido_em desc
    limit 20
  `

  const editaveis = definicao
    ? Object.entries(definicao.colunas).filter(
        ([nome, c]) => c.editavel && colunasBanco.some((cb) => cb.nome === nome)
      )
    : []

  const podeEscrever = env.ADMIN_WRITES_ENABLED && stepUpValido(admin)

  async function salvar(formData: FormData) {
    'use server'

    // O guard roda de novo aqui: Server Action é um endpoint, e um endpoint que
    // confia na checagem feita durante a renderização da página é um endpoint
    // sem checagem.
    const admin = await exigirAdmin()

    const definicao = REGISTRY[tabela]
    if (!definicao) redirect(`/dados/${tabela}/${id}?erro=${encodeURIComponent('Tabela sem registry.')}`)

    const alteracoes: Record<string, unknown> = {}
    let tocaPerigoso = false

    try {
      for (const [nome, coluna] of Object.entries(definicao.colunas)) {
        if (!coluna.editavel) continue
        // Checkbox desmarcado não aparece no FormData — por isso booleanos são
        // sempre lidos, e os demais só quando presentes.
        if (coluna.tipo !== 'bool' && !formData.has(`campo.${nome}`)) continue

        const valor = converter(nome, coluna, formData.get(`campo.${nome}`))
        alteracoes[nome] = valor

        const atual = linha[nome]
        if (coluna.perigoso && JSON.stringify(atual ?? null) !== JSON.stringify(valor ?? null)) {
          tocaPerigoso = true
        }
      }
    } catch (e) {
      const msg = e instanceof ValorInvalido ? `${e.campo}: ${e.message}` : 'Valor inválido.'
      redirect(`/dados/${tabela}/${id}?erro=${encodeURIComponent(msg)}`)
    }

    if (tocaPerigoso) {
      const confirmacao = String(formData.get('confirmacao') ?? '').trim()
      if (confirmacao !== FRASE_CONFIRMACAO) {
        redirect(
          `/dados/${tabela}/${id}?erro=${encodeURIComponent(
            `Esta alteração toca um campo marcado como perigoso. Digite ${FRASE_CONFIRMACAO} para confirmar.`
          )}`
        )
      }
    }

    try {
      await aplicarMutacao(admin, {
        tabela,
        id,
        alteracoes,
        motivo: String(formData.get('motivo') ?? ''),
      })
    } catch (e) {
      if (e instanceof MutacaoRecusada) {
        redirect(`/dados/${tabela}/${id}?erro=${encodeURIComponent(e.message)}`)
      }
      throw e
    }

    redirect(`/dados/${tabela}/${id}?ok=1`)
  }

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/dados/${tabela}`} className="text-xs text-[var(--color-muted)] hover:underline">
          ← {definicao?.rotulo ?? tabela}
        </Link>
        <h1 className="tabular mt-1 text-lg font-semibold">{id}</h1>
      </div>

      {ok && (
        <div className="rounded-[24px] border-[0.5px] border-transparent bg-[var(--color-ok-dim)] px-4 py-3 text-sm text-[var(--color-ok)]">
          Alteração gravada e registrada na auditoria.
        </div>
      )}
      {erro && (
        <div className="rounded-[24px] border-[0.5px] border-transparent bg-[var(--color-danger-dim)] px-4 py-3 text-sm text-[var(--color-danger-deep)]">
          {erro}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card titulo="Valores atuais">
          <dl className="space-y-0">
            {(definicao
              ? Object.keys(definicao.colunas).filter((c) =>
                  colunasBanco.some((cb) => cb.nome === c)
                )
              : colunasBanco.map((c) => c.nome)
            ).map((c) => (
              <div
                key={c}
                className="flex items-baseline justify-between gap-4 border-b border-[var(--color-border)] py-2 last:border-0"
              >
                <dt className="text-xs text-[var(--color-faint)]">
                  {definicao?.colunas[c]?.rotulo ?? c}
                </dt>
                <dd className="text-right text-sm">
                  <Valor valor={linha[c]} coluna={definicao?.colunas[c]} />
                </dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card titulo={editaveis.length > 0 ? 'Editar' : 'Edição'}>
          {editaveis.length === 0 ? (
            <Vazio>
              Nenhum campo desta tabela é editável pelo painel. Para liberar algum, declare-o
              em <code>lib/registry.ts</code>.
            </Vazio>
          ) : !env.ADMIN_WRITES_ENABLED ? (
            <Vazio>
              A escrita está desligada por <code>ADMIN_WRITES_ENABLED=false</code>.
            </Vazio>
          ) : !podeEscrever ? (
            <div className="space-y-3">
              <p className="text-sm text-[var(--color-muted)]">
                Seu segundo fator foi verificado há mais de 15 minutos. Para gravar
                qualquer alteração, confirme o código de novo.
              </p>
              <Link
                href="/mfa"
                className="btn-krew-cta inline-block rounded-full px-4 py-2 text-sm font-semibold"
              >
                Confirmar código
              </Link>
            </div>
          ) : (
            <form action={salvar} className="space-y-3">
              {editaveis.map(([nome, coluna]) => (
                <div key={nome}>
                  <label
                    htmlFor={`campo.${nome}`}
                    className="mb-1 flex items-center gap-2 text-xs text-[var(--color-muted)]"
                  >
                    {coluna.rotulo ?? nome}
                    {coluna.perigoso && <Badge tom="alerta">perigoso</Badge>}
                    {coluna.pii && <Badge tom="destaque">sensível</Badge>}
                  </label>

                  {coluna.tipo === 'enum' ? (
                    <select
                      id={`campo.${nome}`}
                      name={`campo.${nome}`}
                      defaultValue={paraInput(coluna, linha[nome])}
                      className="w-full rounded-[24px] border-[0.5px] border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm"
                    >
                      <option value="">—</option>
                      {coluna.opcoes?.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : coluna.tipo === 'bool' ? (
                    <input
                      id={`campo.${nome}`}
                      name={`campo.${nome}`}
                      type="checkbox"
                      defaultChecked={linha[nome] === true}
                      className="h-4 w-4 accent-[var(--color-accent)]"
                    />
                  ) : coluna.tipo === 'textarea' || coluna.tipo === 'json' ? (
                    <textarea
                      id={`campo.${nome}`}
                      name={`campo.${nome}`}
                      rows={coluna.tipo === 'json' ? 5 : 3}
                      defaultValue={paraInput(coluna, linha[nome])}
                      className={`w-full rounded-[24px] border-[0.5px] border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm ${coluna.tipo === 'json' ? 'tabular' : ''}`}
                    />
                  ) : (
                    <input
                      id={`campo.${nome}`}
                      name={`campo.${nome}`}
                      type={coluna.tipo === 'date' ? 'date' : 'text'}
                      defaultValue={paraInput(coluna, linha[nome])}
                      className="w-full rounded-[24px] border-[0.5px] border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm"
                    />
                  )}

                  {coluna.nota && (
                    <p className="mt-1 text-[11px] text-[var(--color-faint)]">{coluna.nota}</p>
                  )}
                </div>
              ))}

              <div className="border-t border-[var(--color-border)] pt-3">
                <label htmlFor="motivo" className="mb-1 block text-xs text-[var(--color-muted)]">
                  Motivo da alteração <span className="text-[var(--color-danger)]">*</span>
                </label>
                <textarea
                  id="motivo"
                  name="motivo"
                  rows={2}
                  required
                  minLength={10}
                  placeholder="Ex: cliente reportou CNPJ errado no chamado #12, confirmado por e-mail."
                  className="w-full rounded-[24px] border-[0.5px] border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm"
                />
                <p className="mt-1 text-[11px] text-[var(--color-faint)]">
                  Mínimo de 10 caracteres. Fica gravado para sempre, junto com o que mudou.
                </p>
              </div>

              {editaveis.some(([, c]) => c.perigoso) && (
                <div>
                  <label
                    htmlFor="confirmacao"
                    className="mb-1 block text-xs text-[var(--color-muted)]"
                  >
                    Se alterar um campo perigoso, digite{' '}
                    <code className="text-[var(--color-accent)]">{FRASE_CONFIRMACAO}</code>
                  </label>
                  <input
                    id="confirmacao"
                    name="confirmacao"
                    className="w-full rounded-[24px] border-[0.5px] border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm"
                  />
                </div>
              )}

              <button
                type="submit"
                className="btn-krew-cta w-full rounded-full px-3 py-2.5 text-sm font-semibold transition-transform active:translate-y-px active:scale-[0.98]"
              >
                Gravar alteração
              </button>
            </form>
          )}
        </Card>
      </div>

      <Card titulo="Histórico deste registro">
        {historico.length === 0 ? (
          <Vazio>Nenhuma alteração feita pelo painel.</Vazio>
        ) : (
          <Tabela cabecalho={['Quando', 'Ação', 'Mudança', 'Motivo']}>
            {historico.map((h) => (
              <Linha key={h.id}>
                <Celula mono>{dataHora(h.ocorrido_em)}</Celula>
                <Celula>
                  <Badge tom={h.acao === 'operacional' ? 'info' : 'neutro'}>{h.acao}</Badge>
                </Celula>
                <Celula>
                  <div className="space-y-0.5">
                    {Object.keys(h.depois ?? {}).map((campo) => (
                      <div key={campo} className="tabular text-[11px]">
                        <span className="text-[var(--color-faint)]">{campo}: </span>
                        <span className="text-[var(--color-danger)] line-through">
                          {JSON.stringify(h.antes?.[campo] ?? null)}
                        </span>
                        <span className="text-[var(--color-faint)]"> → </span>
                        <span className="text-[var(--color-ok)]">
                          {JSON.stringify(h.depois?.[campo] ?? null)}
                        </span>
                      </div>
                    ))}
                  </div>
                </Celula>
                <Celula>
                  <span className="text-[var(--color-muted)]">{h.motivo}</span>
                </Celula>
              </Linha>
            ))}
          </Tabela>
        )}
      </Card>
    </div>
  )
}
