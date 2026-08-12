import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { exigirAdmin } from '@/lib/auth'
import { sqlRo } from '@/lib/db'
import { dataHora } from '@/lib/format'
import { MutacaoRecusada, registrarRevelacaoPii } from '@/lib/mutate'
import { Card } from '@/components/ui'

export const dynamic = 'force-dynamic'

/**
 * Revelar um dado sensível — §9 do plano.
 *
 * O desenho que sustenta a promessa: **a linha de auditoria é a autorização**.
 * O valor não é exibido por causa de um parâmetro na URL, e sim porque existe
 * um registro em `admin_audit.pii_access`, gravado nos últimos dois minutos,
 * por este admin, para este campo. Não há como ver sem registrar, porque o
 * registro é a chave — e não um efeito colateral que uma refatoração distraída
 * poderia remover, deixando a tela funcionando.
 *
 * Só campos declarados aqui podem ser revelados. `campo` vem da URL e é usado
 * para montar um `select`; a allowlist é o que impede que ele vire uma sonda
 * pelo resto da tabela.
 */
const CAMPOS: Record<string, { rotulo: string; coluna: string }> = {
  cpf_cnpj: { rotulo: 'CPF/CNPJ', coluna: 'cpf_cnpj' },
  whatsapp: { rotulo: 'WhatsApp', coluna: 'whatsapp' },
  dados_bancarios: { rotulo: 'Dados bancários', coluna: 'dados_bancarios' },
}

/** Janela em que o registro de auditoria autoriza a exibição. */
const VALIDADE_MS = 2 * 60 * 1000

export default async function Revelar({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ campo?: string; token?: string; erro?: string }>
}) {
  const admin = await exigirAdmin()
  const { id } = await params
  const { campo, token, erro } = await searchParams

  const definicao = campo ? CAMPOS[campo] : undefined
  if (!definicao || !campo) notFound()

  const [pessoa] = await sqlRo<{ nome: string | null }[]>`
    select nullif(btrim(concat_ws(' ', full_name, sobrenome)), '') as nome
    from public.profiles where id = ${id}
  `
  if (!pessoa) notFound()

  // Existe autorização válida para exibir?
  let valor: unknown = null
  let registroAuditoria: { ocorrido_em: Date; motivo: string } | null = null

  if (token) {
    const [auditoria] = await sqlRo<{ ocorrido_em: Date; motivo: string }[]>`
      select ocorrido_em, motivo
      from admin_audit.pii_access
      where id = ${token}::bigint
        and ator_id = ${admin.id}
        and tabela = 'profiles'
        and registro_id = ${id}
        and campo = ${campo}
        and ocorrido_em > now() - interval '2 minutes'
    `
    if (auditoria) {
      registroAuditoria = auditoria
      const [linha] = await sqlRo<Record<string, unknown>[]>`
        select ${sqlRo(definicao.coluna)} as valor from public.profiles where id = ${id}
      `
      valor = linha?.valor ?? null
    }
  }

  async function autorizar(formData: FormData) {
    'use server'
    const admin = await exigirAdmin()
    const motivo = String(formData.get('motivo') ?? '')

    try {
      await registrarRevelacaoPii(admin, {
        tabela: 'profiles',
        registroId: id,
        campo: campo!,
        sujeitoUserId: id,
        motivo,
      })
    } catch (e) {
      if (e instanceof MutacaoRecusada) {
        redirect(`/pessoas/${id}/revelar?campo=${campo}&erro=${encodeURIComponent(e.message)}`)
      }
      throw e
    }

    // O id da linha recém-gravada é o que autoriza a exibição.
    const [ultima] = await sqlRo<{ id: string }[]>`
      select id::text from admin_audit.pii_access
      where ator_id = ${admin.id} and registro_id = ${id} and campo = ${campo!}
      order by ocorrido_em desc limit 1
    `
    redirect(`/pessoas/${id}/revelar?campo=${campo}&token=${ultima.id}`)
  }

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div>
        <Link href={`/pessoas/${id}`} className="text-xs text-[var(--color-muted)] hover:underline">
          ← {pessoa.nome ?? 'Pessoa'}
        </Link>
        <h1 className="mt-1 text-xl font-semibold">Revelar {definicao.rotulo}</h1>
      </div>

      {erro && (
        <div className="rounded-[24px] border-[0.5px] border-transparent bg-[var(--color-danger-dim)] px-4 py-3 text-sm text-[var(--color-danger-deep)]">
          {erro}
        </div>
      )}

      {registroAuditoria ? (
        <Card titulo={definicao.rotulo}>
          <div className="tabular rounded-[24px] border-[0.5px] border-transparent bg-[var(--color-accent-dim)] px-4 py-3 text-lg break-all text-[var(--color-accent)]">
            {valor == null
              ? '— (vazio)'
              : typeof valor === 'object'
                ? JSON.stringify(valor, null, 2)
                : String(valor)}
          </div>
          <p className="mt-3 text-xs text-[var(--color-faint)]">
            Registrado em {dataHora(registroAuditoria.ocorrido_em)}. Motivo: “
            {registroAuditoria.motivo}”. Esta exibição expira em 2 minutos —
            recarregar depois disso exige nova justificativa.
          </p>
        </Card>
      ) : (
        <Card titulo="Justificativa">
          <p className="mb-3 text-sm text-[var(--color-muted)]">
            Este dado pertence a outra pessoa. A exibição fica registrada com seu nome,
            o horário e o motivo abaixo — permanentemente.
          </p>
          <form action={autorizar} className="space-y-3">
            <textarea
              name="motivo"
              rows={3}
              required
              minLength={10}
              placeholder="Ex: conferir CNPJ com o cliente no chamado #12, ele reportou nota fiscal recusada."
              className="w-full rounded-[24px] border-[0.5px] border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="btn-krew-cta w-full rounded-full px-3 py-2.5 text-sm font-semibold transition-transform active:translate-y-px active:scale-[0.98]"
            >
              Registrar e exibir
            </button>
          </form>
        </Card>
      )}
    </div>
  )
}
