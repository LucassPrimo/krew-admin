import { redirect } from 'next/navigation'
import { registrarSessao } from '@/lib/mutate'
import { criarClienteAuth } from '@/lib/supabase'

/**
 * Segundo fator — a camada 4 das sete.
 *
 * Existir sessão não basta: ela precisa ter passado pelo TOTP NESTA sessão
 * (`aal2`). É o que faz uma senha vazada, sozinha, não abrir o painel.
 */
export default async function VerificarMfa({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams
  const supabase = await criarClienteAuth()

  const { data: fatores } = await supabase.auth.mfa.listFactors()
  const totp = fatores?.totp?.find((f) => f.status === 'verified')

  // Sem fator confirmado não há o que verificar — o caminho é o cadastro.
  if (!totp) redirect('/mfa/cadastrar')

  async function verificar(formData: FormData) {
    'use server'

    const codigo = String(formData.get('codigo') ?? '').replace(/\D/g, '')
    const factorId = String(formData.get('factorId') ?? '')

    const supabase = await criarClienteAuth()
    const { data: desafio, error: erroDesafio } = await supabase.auth.mfa.challenge({ factorId })
    if (erroDesafio || !desafio) redirect('/mfa?erro=1')

    const { error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: desafio.id,
      code: codigo,
    })
    if (error) redirect('/mfa?erro=1')

    // O registro da sessão acontece AQUI, e não no login: uma sessão que parou
    // na senha e nunca passou pelo segundo fator não é acesso ao painel, e
    // registrá-la encheria a auditoria de linhas que não significam nada. O
    // que a aba "Sessões" precisa responder é "houve acesso que não fui eu?" —
    // e acesso, aqui, quer dizer aal2.
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      await registrarSessao(
        { id: user.id, email: user.email ?? '', mfaVerificadoEm: new Date() },
        'aal2'
      )
    }

    redirect('/')
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold">Código do autenticador</h1>
        <p className="mt-2 mb-6 text-sm text-[var(--color-muted)]">
          Digite os 6 dígitos do seu app autenticador.
        </p>

        {erro && (
          <div className="mb-4 rounded-[24px] border-[0.5px] border-transparent bg-[var(--color-danger-dim)] px-4 py-3 text-sm text-[var(--color-danger-deep)]">
            Código inválido ou expirado. Tente o próximo.
          </div>
        )}

        <form action={verificar} className="space-y-3">
          <input type="hidden" name="factorId" value={totp.id} />
          <input
            name="codigo"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            autoFocus
            aria-label="Código de 6 dígitos"
            className="tabular w-full rounded-[24px] border-[0.5px] border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3 text-center text-2xl tracking-[0.4em] outline-none focus-visible:border-[var(--color-accent)]"
          />
          <button
            type="submit"
            className="btn-krew-cta w-full rounded-full px-3 py-2.5 text-sm font-semibold transition-transform active:translate-y-px active:scale-[0.98]"
          >
            Verificar
          </button>
        </form>
      </div>
    </main>
  )
}
