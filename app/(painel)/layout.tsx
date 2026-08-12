import Link from 'next/link'
import { redirect } from 'next/navigation'
import { exigirAdmin } from '@/lib/auth'
import { env } from '@/lib/env'
import { criarClienteAuth } from '@/lib/supabase'

/**
 * A casca de tudo que é autenticado.
 *
 * `exigirAdmin()` roda aqui, e roda de novo em cada página e cada server
 * action. Repetição é de propósito: um guard que só existe no layout é um
 * guard que a primeira rota criada fora dele perde silenciosamente.
 */

const NAV = [
  { href: '/', rotulo: 'Visão geral' },
  { href: '/pessoas', rotulo: 'Pessoas' },
  { href: '/assinaturas', rotulo: 'Assinaturas' },
  { href: '/dados', rotulo: 'Dados' },
  { href: '/sql', rotulo: 'SQL' },
  { href: '/auditoria', rotulo: 'Auditoria' },
]

export default async function LayoutPainel({ children }: { children: React.ReactNode }) {
  const admin = await exigirAdmin()

  async function sair() {
    'use server'
    const supabase = await criarClienteAuth()
    await supabase.auth.signOut()
    redirect('/login?motivo=saiu')
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b-[0.5px] border-[var(--color-border)] bg-[var(--color-bg)]/95 shadow-[var(--shadow-float)] backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center gap-6 px-5 py-3">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="font-brand text-[15px] font-bold tracking-[0.08em] text-[var(--color-accent)] uppercase">
              Krew
            </span>
            <span className="text-[11px] tracking-wider text-[var(--color-faint)] uppercase">
              Admin
            </span>
          </Link>

          <nav className="flex items-center gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full px-3 py-1.5 text-[13px] text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]"
              >
                {item.rotulo}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {/* O estado do kill switch fica visível o tempo todo. Descobrir que
                a escrita estava desligada só depois de preencher um formulário
                é uma forma barata de irritação que não precisa existir. */}
            {!env.ADMIN_WRITES_ENABLED && (
              <span className="rounded-full border-[0.5px] border-transparent bg-[var(--color-accent-dim)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-accent)]">
                somente leitura
              </span>
            )}
            <span className="hidden text-xs text-[var(--color-faint)] sm:inline">
              {admin.email}
            </span>
            <form action={sair}>
              <button
                type="submit"
                className="rounded-full border-[0.5px] border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-muted)] transition-colors hover:border-[var(--color-border-strong)]"
              >
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-5 py-6">{children}</main>
    </div>
  )
}
