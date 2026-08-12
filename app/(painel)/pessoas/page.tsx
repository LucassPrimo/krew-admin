import Link from 'next/link'
import { exigirAdmin } from '@/lib/auth'
import { sqlRo } from '@/lib/db'
import { data, desde } from '@/lib/format'
import { mascararEmail } from '@/lib/pii'
import { Badge, Card, Celula, Linha, Mascarado, Tabela, Vazio } from '@/components/ui'

export const dynamic = 'force-dynamic'

interface Pessoa {
  id: string
  nome: string | null
  email: string
  account_type: string
  onboarding_step: number | null
  cidade: string | null
  estado: string | null
  email_confirmado: Date | null
  ultimo_login: Date | null
  created_at: Date
  slug: string | null
}

export default async function Pessoas({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  await exigirAdmin()
  const { q } = await searchParams
  const termo = (q ?? '').trim()

  // A busca varre nome, e-mail, slug e documento. O documento entra só por
  // dígitos: o CPF costuma estar salvo com pontuação e ser digitado sem, ou o
  // contrário — comparar o texto cru erra justamente quando mais importa, que é
  // no atendimento com a pessoa esperando na linha.
  const digitos = termo.replace(/\D/g, '')
  const like = `%${termo.toLowerCase()}%`

  const pessoas = await sqlRo<Pessoa[]>`
    select
      p.id,
      nullif(btrim(concat_ws(' ', p.full_name, p.sobrenome)), '') as nome,
      u.email,
      p.account_type,
      p.onboarding_step,
      p.cidade,
      p.estado,
      u.email_confirmed_at as email_confirmado,
      u.last_sign_in_at    as ultimo_login,
      p.created_at,
      pp.slug
    from public.profiles p
    join public.admin_auth_users u on u.id = p.id
    left join public.proposal_pages pp on pp.user_id = p.id
    ${
      termo
        ? sqlRo`where (
            lower(coalesce(p.full_name, '') || ' ' || coalesce(p.sobrenome, '')) like ${like}
            or lower(u.email) like ${like}
            or lower(coalesce(pp.slug, '')) like ${like}
            or p.id::text = ${termo}
            ${digitos.length >= 3 ? sqlRo`or regexp_replace(coalesce(p.cpf_cnpj, ''), '\\D', '', 'g') like ${`%${digitos}%`}` : sqlRo``}
          )`
        : sqlRo``
    }
    order by p.created_at desc
    limit 100
  `

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Pessoas</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Busca por nome, e-mail, slug, CPF/CNPJ ou id.
        </p>
      </div>

      {/* GET, não POST: um termo de busca em querystring é conveniente e
          recarregável. Documento nunca vai para a URL — o campo aceita, mas o
          servidor só o usa para comparar, e a URL guarda o que você digitou.
          É o motivo de a busca por documento existir e o RESULTADO continuar
          mascarado. */}
      <form method="get" className="flex gap-2">
        <input
          name="q"
          defaultValue={termo}
          placeholder="Buscar…"
          className="w-full max-w-md rounded-[24px] border-[0.5px] border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none focus-visible:border-[var(--color-accent)]"
        />
        <button
          type="submit"
          className="rounded-full border-[0.5px] border-[var(--color-border-strong)] px-4 py-2 text-sm transition-transform active:translate-y-px active:scale-[0.98]"
        >
          Buscar
        </button>
      </form>

      <Card>
        {pessoas.length === 0 ? (
          <Vazio>{termo ? `Nada encontrado para "${termo}".` : 'Nenhuma pessoa cadastrada.'}</Vazio>
        ) : (
          <Tabela
            cabecalho={['Pessoa', 'E-mail', 'Tipo', 'Onboarding', 'Local', 'Cadastro', 'Último login']}
          >
            {pessoas.map((p) => (
              <Linha key={p.id}>
                <Celula>
                  <Link
                    href={`/pessoas/${p.id}`}
                    className="font-medium text-[var(--color-ink)] hover:text-[var(--color-accent)]"
                  >
                    {p.nome ?? <span className="text-[var(--color-faint)]">sem nome</span>}
                  </Link>
                  {p.slug && (
                    <div className="text-[11px] text-[var(--color-faint)]">/{p.slug}</div>
                  )}
                </Celula>
                <Celula>
                  <Mascarado>{mascararEmail(p.email)}</Mascarado>
                  {!p.email_confirmado && (
                    <div className="mt-0.5">
                      <Badge tom="alerta">não confirmado</Badge>
                    </div>
                  )}
                </Celula>
                <Celula>
                  <Badge tom={p.account_type === 'agency' ? 'info' : 'neutro'}>
                    {p.account_type}
                  </Badge>
                </Celula>
                <Celula>
                  {(p.onboarding_step ?? 0) >= 3 ? (
                    <Badge tom="ok">completo</Badge>
                  ) : (
                    <Badge tom="alerta">{p.onboarding_step ?? 0}/3</Badge>
                  )}
                </Celula>
                <Celula>
                  <span className="text-[var(--color-muted)]">
                    {p.cidade ? `${p.cidade}${p.estado ? `/${p.estado}` : ''}` : '—'}
                  </span>
                </Celula>
                <Celula mono>{data(p.created_at)}</Celula>
                <Celula mono>{desde(p.ultimo_login)}</Celula>
              </Linha>
            ))}
          </Tabela>
        )}
      </Card>
    </div>
  )
}
