import { criarClienteAuth } from '@/lib/supabase'
import { redirect } from 'next/navigation'

/**
 * Onde cai quem tem sessão válida mas não é admin.
 *
 * Nenhuma informação sobre o painel, sobre quais listas existem ou sobre o que
 * faltou: quem chegou aqui e não deveria não ganha pista nenhuma de como
 * chegar mais perto.
 */
export default function Negado() {
  async function sair() {
    'use server'
    const supabase = await criarClienteAuth()
    await supabase.auth.signOut()
    redirect('/login?motivo=saiu')
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-sm text-center">
        <h1 className="text-lg font-semibold">Acesso não autorizado</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Esta conta não tem acesso a esta aplicação.
        </p>
        <form action={sair} className="mt-6">
          <button
            type="submit"
            className="rounded-full border-[0.5px] border-[var(--color-border-strong)] px-4 py-2 text-sm transition-transform active:translate-y-px active:scale-[0.98]"
          >
            Sair
          </button>
        </form>
      </div>
    </main>
  )
}
