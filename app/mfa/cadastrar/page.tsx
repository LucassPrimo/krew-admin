import { redirect } from 'next/navigation'
import { criarClienteAuth } from '@/lib/supabase'

/**
 * Cadastro do TOTP. Acontece uma vez, no primeiro acesso.
 *
 * O QR vem do servidor de auth da Supabase como SVG. Ele é convertido para
 * data URI e renderizado em `<img>` em vez de injetado como HTML: nenhum
 * caminho deste painel deveria terminar em `dangerouslySetInnerHTML`, mesmo com
 * origem confiável, porque essa é a linha que separa "confio nesta origem hoje"
 * de um XSS amanhã.
 */
export default async function CadastrarMfa({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams
  const supabase = await criarClienteAuth()

  const { data: fatores } = await supabase.auth.mfa.listFactors()
  // `listFactors()` devolve apenas fatores já verificados. Se existe um, o
  // cadastro está feito e o caminho é a verificação.
  if (fatores?.totp?.length) redirect('/mfa')

  // Cada carregamento desta página cria um fator novo, com nome único. Fica
  // lixo de fatores não verificados se alguém recarregar no meio do cadastro —
  // e é o lado certo do problema: fator não verificado não dá acesso a nada, e
  // reaproveitar um pendente exigiria guardar o segredo em algum lugar entre
  // uma requisição e outra, que é justamente o que não se quer fazer com o
  // segredo do segundo fator.
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: `admin-${Date.now()}`,
  })

  if (error || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <p className="max-w-sm text-sm text-[var(--color-danger)]">
          Não foi possível iniciar o cadastro do segundo fator: {error?.message}
        </p>
      </main>
    )
  }

  const factorId = data.id
  const segredo = data.totp.secret
  const qr = data.totp.qr_code

  const qrSrc = qr?.startsWith('data:')
    ? qr
    : qr
      ? `data:image/svg+xml;base64,${Buffer.from(qr).toString('base64')}`
      : undefined

  async function confirmar(formData: FormData) {
    'use server'

    const codigo = String(formData.get('codigo') ?? '').replace(/\D/g, '')
    const id = String(formData.get('factorId') ?? '')

    const supabase = await criarClienteAuth()
    const { data: desafio, error: erroDesafio } = await supabase.auth.mfa.challenge({
      factorId: id,
    })
    if (erroDesafio || !desafio) redirect('/mfa/cadastrar?erro=1')

    const { error } = await supabase.auth.mfa.verify({
      factorId: id,
      challengeId: desafio.id,
      code: codigo,
    })
    if (error) redirect('/mfa/cadastrar?erro=1')

    redirect('/')
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold">Cadastrar autenticador</h1>
        <p className="mt-2 mb-6 text-sm text-[var(--color-muted)]">
          Use um app autenticador em <strong>outro dispositivo</strong> — se o segundo
          fator mora no mesmo aparelho da sessão, ele deixa de ser um segundo fator.
        </p>

        {erro && (
          <div className="mb-4 rounded-[24px] border-[0.5px] border-transparent bg-[var(--color-danger-dim)] px-4 py-3 text-sm text-[var(--color-danger-deep)]">
            Código inválido. Confira o relógio do dispositivo e tente o próximo.
          </div>
        )}

        {qrSrc && (
          <div className="mb-4 rounded-[24px] border-[0.5px] border-[var(--color-border)] bg-white p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrSrc} alt="QR code do autenticador" className="mx-auto h-44 w-44" />
          </div>
        )}

        {segredo && (
          <div className="mb-4">
            <div className="mb-1 text-xs text-[var(--color-faint)]">
              Ou digite o segredo manualmente:
            </div>
            <code className="tabular block rounded-[24px] border-[0.5px] border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 break-all">
              {segredo}
            </code>
          </div>
        )}

        <form action={confirmar} className="space-y-3">
          <input type="hidden" name="factorId" value={factorId} />
          <input
            name="codigo"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            aria-label="Código de 6 dígitos"
            className="tabular w-full rounded-[24px] border-[0.5px] border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3 text-center text-2xl tracking-[0.4em] outline-none focus-visible:border-[var(--color-accent)]"
          />
          <button
            type="submit"
            className="btn-krew-cta w-full rounded-full px-3 py-2.5 text-sm font-semibold transition-transform active:translate-y-px active:scale-[0.98]"
          >
            Confirmar e ativar
          </button>
        </form>

        <p className="mt-6 text-xs leading-relaxed text-[var(--color-faint)]">
          Guarde os códigos de recuperação da sua conta Supabase fora deste computador.
          Sem o autenticador, recuperar o acesso exige SQL manual no banco.
        </p>
      </div>
    </main>
  )
}
