import { redirect } from 'next/navigation'
import { criarClienteAuth } from '@/lib/supabase'

/**
 * Login. Sem cadastro, sem "esqueci minha senha", sem OAuth.
 *
 * Recuperação de senha acontece no app principal — um fluxo de reset aqui
 * seria uma segunda porta para a mesma casa, e portas são o que se está
 * tentando reduzir. Quem perdeu o acesso resolve no app e volta.
 *
 * A mensagem de erro é sempre a mesma para senha errada e usuário inexistente:
 * um formulário que distingue os dois casos conta a quem tenta se aquele
 * e-mail existe.
 */

const MOTIVOS: Record<string, string> = {
  ocio: 'Sessão encerrada por inatividade.',
  limite: 'Sessão encerrada — limite de 8 horas atingido.',
  credenciais: 'E-mail ou senha incorretos.',
  saiu: 'Você saiu.',
}

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string }>
}) {
  const { motivo } = await searchParams
  const aviso = motivo ? MOTIVOS[motivo] : null

  async function entrar(formData: FormData) {
    'use server'

    const email = String(formData.get('email') ?? '')
    const senha = String(formData.get('senha') ?? '')

    const supabase = await criarClienteAuth()
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })

    // `redirect()` funciona lançando uma exceção — precisa ficar fora de
    // try/catch para não ser engolido.
    if (error) redirect('/login?motivo=credenciais')

    // O destino é sempre a raiz. Quem ainda não passou pelo segundo fator é
    // desviado pelo proxy.ts para /mfa; quem não está nas duas listas de
    // admin, para /negado. Esta função não decide nada disso.
    redirect('/')
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <div className="font-brand text-[13px] font-bold tracking-[0.1em] text-[var(--color-accent)] uppercase">
            Krew
          </div>
          <h1 className="mt-1 text-2xl font-semibold">Administração</h1>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Acesso restrito. Todo acesso é registrado.
          </p>
        </div>

        {aviso && (
          <div className="mb-4 rounded-[24px] border-[0.5px] border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-sm text-[var(--color-muted)]">
            {aviso}
          </div>
        )}

        <form action={entrar} className="space-y-3">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-xs text-[var(--color-muted)]">
              E-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="username"
              className="w-full rounded-[24px] border-[0.5px] border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-sm outline-none focus-visible:border-[var(--color-accent)]"
            />
          </div>

          <div>
            <label htmlFor="senha" className="mb-1.5 block text-xs text-[var(--color-muted)]">
              Senha
            </label>
            <input
              id="senha"
              name="senha"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-[24px] border-[0.5px] border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-sm outline-none focus-visible:border-[var(--color-accent)]"
            />
          </div>

          <button
            type="submit"
            className="btn-krew-cta w-full rounded-full px-3 py-2.5 text-sm font-semibold transition-transform active:translate-y-px active:scale-[0.98]"
          >
            Entrar
          </button>
        </form>

        <p className="mt-6 text-xs leading-relaxed text-[var(--color-faint)]">
          O segundo fator é pedido logo em seguida. Perdeu o autenticador? A saída é
          SQL manual no banco — de propósito.
        </p>
      </div>
    </main>
  )
}
